import { Response } from 'express';
import Joi from 'joi';
import { prisma } from '../utils/database';
import { ApiError, asyncHandler, errorHelpers } from '../utils/errors';
import {
  createSuccessResponse,
  createPaginatedResponse,
  calculatePagination,
} from '../types/api-responses';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config/environment';
import {
  emitNewMessage,
  emitMessageRead,
  emitConversationUpdate,
} from '../socket/socket';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const sendMessageSchema = Joi.object({
  recipientId: Joi.string().uuid().optional(),
  // Allow empty here because we normalize (trim) and validate below.
  text: Joi.string().allow('', null).max(2000).optional(),
  adId: Joi.string().uuid().optional(),
  adSlug: Joi.string().max(255).optional(),
}).or('recipientId', 'adSlug');

const listConversationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

const getMessagesQuerySchema = Joi.object({
  // Cursor-based: load messages older than this message id
  before: Joi.string().uuid().optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

const initiateChatQuerySchema = Joi.object({
  adSlug: Joi.string().max(255).optional(),
  recipientId: Joi.string().uuid().optional(),
}).or('adSlug', 'recipientId');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MESSAGE_AD_SELECT = {
  id: true,
  slug: true,
  title: true,
  price: true,
  images: true,
  locationCity: true,
  locationState: true,
  locationFormatted: true,
  category: { select: { name: true, adPlaceholder: true } },
  subcategory: { select: { name: true } },
} as const;

/**
 * Find or create a 1:1 conversation between two users.
 * Participants are stored in deterministic UUID order so there is only one
 * conversation per pair regardless of who initiates.
 */
async function findOrCreateConversation(
  tx: any,
  userId: string,
  recipientId: string
): Promise<any> {
  // Find existing conversation between these two users
  const existing = await tx.conversation.findFirst({
    where: {
      OR: [
        { userAId: userId, userBId: recipientId },
        { userAId: recipientId, userBId: userId },
      ],
    },
  });

  if (existing) return existing;

  // Create new conversation: store participants in deterministic order.
  const [smallerId, largerId] = [userId, recipientId].sort();
  return tx.conversation.create({
    data: { userAId: smallerId, userBId: largerId },
  });
}

/**
 * Load a conversation and assert the authenticated user participates in it.
 */
async function getAuthorizedConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userAId: true, userBId: true },
  });

  if (!conversation) {
    throw ApiError.notFound('Conversation not found');
  }

  if (conversation.userAId !== userId && conversation.userBId !== userId) {
    throw ApiError.forbidden('Access denied');
  }

  return conversation;
}

/** Admin support chats: may only correspond with app users (USER role). */
function assertAdminChatPeer(recipientRole: string | undefined, senderRole: string): void {
  if (senderRole !== 'ADMIN') return;
  if (recipientRole !== 'USER') {
    throw ApiError.forbidden('Admins can only message app users');
  }
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * Get total unread message count for the authenticated user.
 */
export const getTotalUnreadCount = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const unreadCount = await prisma.message.count({
      where: {
        conversation: {
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        senderId: { not: userId },
        isRead: false,
      },
    });

    res.status(200).json(createSuccessResponse({ unreadCount }));
  }
);

/**
 * Unread incoming message counts per other participant, across all conversations.
 * Unlike GET /conversations, this is not paginated so admin dashboards can badge
 * every user row correctly.
 */
export const getUnreadByPeer = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    // Avoid prisma.message.groupBy + relation filter: Postgres errors with
    // "column reference id is ambiguous" when joining conversations.
    const myConversations = await prisma.conversation.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: { id: true, userAId: true, userBId: true },
    });

    if (myConversations.length === 0) {
      res.status(200).json(
        createSuccessResponse({ unreadByUserId: {} as Record<string, number>, totalUnread: 0 })
      );
      return;
    }

    const convMap = new Map(myConversations.map((c) => [c.id, c]));
    const convIds = myConversations.map((c) => c.id);

    const unreadGroups = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: convIds },
        senderId: { not: userId },
        isRead: false,
      },
      _count: { _all: true },
    });

    const unreadByUserId: Record<string, number> = {};
    let totalUnread = 0;

    for (const g of unreadGroups) {
      const c = convMap.get(g.conversationId);
      if (!c) continue;
      const peerId = c.userAId === userId ? c.userBId : c.userAId;
      const n = g._count._all;
      unreadByUserId[peerId] = (unreadByUserId[peerId] ?? 0) + n;
      totalUnread += n;
    }

    res.status(200).json(createSuccessResponse({ unreadByUserId, totalUnread }));
  }
);

/**
 * List all conversations for the authenticated user.
 */
export const listConversations = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { error, value } = listConversationsQuerySchema.validate(req.query, {
      convert: true,
      stripUnknown: true,
    });
    if (error) throw errorHelpers.handleJoiError(error);

    const userId = req.user!.id;
    const { page, limit } = value as { page: number; limit: number };
    const skip = (page - 1) * limit;

    const whereClause = {
      OR: [{ userAId: userId }, { userBId: userId }],
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where: whereClause,
        include: {
          userA: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          userB: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { ad: { select: MESSAGE_AD_SELECT } },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.conversation.count({ where: whereClause }),
    ]);

    const unreadCounts = conversations.length
      ? await prisma.message.groupBy({
          by: ['conversationId'],
          where: {
            conversationId: { in: conversations.map(c => c.id) },
            senderId: { not: userId },
            isRead: false,
          },
          _count: { id: true },
        })
      : [];

    const unreadCountMap = new Map(unreadCounts.map(uc => [uc.conversationId, uc._count.id]));

    const formatted = conversations.map(conv => {
      const isUserA = conv.userAId === userId;
      const otherUser = isUserA ? conv.userB : conv.userA;
      const lastMessage = conv.messages[0];

      return {
        id: conv.id,
        otherUser: {
          id: otherUser.id,
          name: `${otherUser.firstName} ${otherUser.lastName || ''}`.trim(),
          avatar: otherUser.avatar,
        },
        lastMessage: lastMessage ? lastMessage.text || 'Shared an ad' : null,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: unreadCountMap.get(conv.id) || 0,
      };
    });

    res.status(200).json(createPaginatedResponse(formatted, calculatePagination(page, limit, total)));
  }
);

/**
 * Get messages for a specific conversation.
 *
 * Cursor-based pagination: `?before=<messageId>&limit=<n>` returns the `n`
 * messages older than `before` (exclusive). Without `before`, returns the
 * latest `limit` messages. Response is ordered ASC (oldest first) for easy
 * rendering in a chat UI.
 */
export const getMessages = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.id;

    const { error, value } = getMessagesQuerySchema.validate(req.query, {
      convert: true,
      stripUnknown: true,
    });
    if (error) throw errorHelpers.handleJoiError(error);

    const { before, limit } = value as { before?: string; limit: number };

    await getAuthorizedConversation(id, userId);

    // Resolve the cursor message's createdAt if provided.
    let beforeCreatedAt: Date | undefined;
    if (before) {
      const cursor = await prisma.message.findFirst({
        where: { id: before, conversationId: id },
        select: { createdAt: true },
      });
      if (!cursor) {
        throw ApiError.validation('Invalid cursor');
      }
      beforeCreatedAt = cursor.createdAt;
    }

    // Query the newest `limit` messages before the cursor, then reverse to ASC.
    const rows = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...(beforeCreatedAt ? { createdAt: { lt: beforeCreatedAt } } : {}),
      },
      include: { ad: { select: MESSAGE_AD_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // fetch one extra to detect hasMore
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const messages = page.reverse(); // ASC for the client
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    res.status(200).json(
      createSuccessResponse({
        messages,
        hasMore,
        nextCursor,
      })
    );
  }
);

/**
 * Send a message (creates conversation if it doesn't exist).
 *
 * Accepts either `recipientId` or `adSlug`. Requires at least one of a
 * non-empty `text` or an ad reference (`adId` / `adSlug`).
 */
export const sendMessage = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { error, value } = sendMessageSchema.validate(req.body, {
      stripUnknown: true,
    });
    if (error) throw errorHelpers.handleJoiError(error);

    const userId = req.user!.id;
    let { recipientId, adId } = value as {
      recipientId?: string;
      adId?: string;
      adSlug?: string;
      text?: string | null;
    };
    const { adSlug } = value as { adSlug?: string };
    let text = typeof value.text === 'string' ? value.text.trim() : '';

    // Resolve adSlug to adId + recipient.
    let adSnapshot: { id: string; userId: string; title: string } | null = null;
    if (adSlug) {
      adSnapshot = await prisma.ad.findUnique({
        where: { slug: adSlug },
        select: { id: true, userId: true, title: true },
      });
      if (!adSnapshot) throw ApiError.adNotFound();
      adId = adSnapshot.id;

      // When adSlug is provided, recipient MUST be the ad owner.
      // If client also sent recipientId, enforce consistency to prevent
      // messages being routed to the wrong user.
      if (recipientId && recipientId !== adSnapshot.userId) {
        console.warn(
          `[CHAT] Recipient mismatch: client sent recipientId=${recipientId} but adSlug=${adSlug} owner is ${adSnapshot.userId}. Correcting to ad owner.`
        );
      }
      recipientId = adSnapshot.userId;

      if (!text) {
        text = `Hi, I'm interested in your ad: ${adSnapshot.title}`;
      }
    }

    // Verify adId (when provided directly) references a real ad.
    // adId here is only message context (e.g. "this message is about this ad"),
    // not a routing instruction, so we do NOT validate recipient == ad owner.
    // The adSlug block above already handles routing validation for ad-initiated chats.
    if (adId && !adSnapshot) {
      const ad = await prisma.ad.findUnique({
        where: { id: adId },
        select: { id: true },
      });
      if (!ad) throw ApiError.adNotFound();
    }

    if (!recipientId) {
      throw ApiError.validation('Recipient ID or ad slug is required');
    }

    if (userId === recipientId) {
      throw ApiError.validation('You cannot message yourself');
    }

    if (!text && !adId) {
      throw ApiError.validation('Message must contain text or an ad reference');
    }

    console.log(`[CHAT SEND] senderId=${userId} recipientId=${recipientId} adId=${adId || 'none'} adSlug=${adSlug || 'none'}`);

    // Verify the recipient exists and is active.
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, isActive: true, role: true },
    });
    if (!recipient) throw ApiError.userNotFound('Recipient not found');
    if (!recipient.isActive) throw ApiError.forbidden('Recipient account is unavailable');
    assertAdminChatPeer(recipient.role, req.user!.role);

    // All DB writes in one transaction so message + conversation stay consistent.
    const { message, conversation } = await prisma.$transaction(async tx => {
      const conv = await findOrCreateConversation(tx, userId, recipientId!);

      const msg = await tx.message.create({
        data: {
          conversationId: conv.id,
          senderId: userId,
          text: text || null,
          adId: adId || null,
        },
        include: { ad: { select: MESSAGE_AD_SELECT } },
      });

      const updatedConv = await tx.conversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: new Date() },
      });

      return { message: msg, conversation: updatedConv };
    });

    // Fire-and-forget socket emits; do not let socket errors fail the request.
    try {
      emitNewMessage(conversation.id, message);

      const previewText = message.text || 'Shared an ad';
      const participantIds = [conversation.userAId, conversation.userBId];
      for (const uid of participantIds) {
        emitConversationUpdate(uid, {
          id: conversation.id,
          lastMessage: previewText,
          lastMessageAt: conversation.lastMessageAt,
          // Sender's inbox doesn't gain an unread; recipient's does.
          unreadDelta: uid === message.senderId ? 0 : 1,
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Socket emit failed:', e);
    }

    res.status(201).json(createSuccessResponse(message, 'Message sent'));
  }
);

/**
 * Resolve ad/recipient context for initiating a chat.
 */
export const initiateChat = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { error, value } = initiateChatQuerySchema.validate(req.query, {
      stripUnknown: true,
    });
    if (error) throw errorHelpers.handleJoiError(error);

    const userId = req.user!.id;
    const { adSlug, recipientId } = value as { adSlug?: string; recipientId?: string };

    let targetRecipientId = recipientId;
    let adData: unknown = null;

    if (adSlug) {
      const ad = await prisma.ad.findUnique({
        where: { slug: adSlug },
        select: {
          id: true,
          title: true,
          price: true,
          images: true,
          userId: true,
          locationCity: true,
          category: { select: { name: true, adPlaceholder: true } },
          subcategory: { select: { name: true } },
        },
      });
      if (!ad) throw ApiError.adNotFound();
      adData = ad;
      if (!targetRecipientId) targetRecipientId = ad.userId;
    }

    if (!targetRecipientId) {
      throw ApiError.validation('Recipient ID or ad slug is required');
    }

    if (targetRecipientId === userId) {
      throw ApiError.validation('You cannot start a chat with yourself');
    }

    const peer = await prisma.user.findUnique({
      where: { id: targetRecipientId },
      select: {
        id: true,
        role: true,
        isActive: true,
        firstName: true,
        lastName: true,
        avatar: true,
      },
    });
    if (!peer) throw ApiError.userNotFound('Recipient not found');
    if (!peer.isActive) throw ApiError.forbidden('Recipient account is unavailable');
    assertAdminChatPeer(peer.role, req.user!.role);

    // Find conversation between these two users (flow-based, not ad-scoped)
    console.log(`[CHAT INITIATE] userId=${userId} targetRecipientId=${targetRecipientId} adSlug=${adSlug || 'none'}`);

    const conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { userAId: userId, userBId: targetRecipientId },
          { userAId: targetRecipientId, userBId: userId },
        ],
      },
      include: {
        userA: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        userB: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });

    if (!conversation) {
      console.log(`[CHAT INITIATE] No existing conversation found, returning new chat context`);
      res.status(200).json(
        createSuccessResponse({
          conversation: null,
          recipient: {
            id: peer.id,
            name: `${peer.firstName} ${peer.lastName || ''}`.trim(),
            avatar: peer.avatar,
          },
          ad: adData,
        })
      );
      return;
    }

    const isUserA = conversation.userAId === userId;
    const otherUser = isUserA ? conversation.userB : conversation.userA;

    res.status(200).json(
      createSuccessResponse({
        conversation: {
          id: conversation.id,
          otherUser: {
            id: otherUser.id,
            name: `${otherUser.firstName} ${otherUser.lastName || ''}`.trim(),
            avatar: otherUser.avatar,
          },
        },
        ad: adData,
      })
    );
  }
);

/**
 * Mark all unread messages in a conversation as read.
 * Only the other participant's messages become read.
 */
export const markAsRead = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Authorization: only a participant may call this.
    await getAuthorizedConversation(id, userId);

    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId: id,
        senderId: { not: userId },
        isRead: false,
      },
      select: { id: true },
    });

    if (unreadMessages.length === 0) {
      res.status(200).json(createSuccessResponse({ updated: 0 }, 'No unread messages'));
      return;
    }

    const { count } = await prisma.message.updateMany({
      where: {
        conversationId: id,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    try {
      emitMessageRead(
        id,
        unreadMessages.map(m => m.id),
        userId
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Socket emit failed:', e);
    }

    res.status(200).json(createSuccessResponse({ updated: count }, 'Messages marked as read'));
  }
);

/**
 * Delete all conversations for the authenticated user.
 *
 * Dangerous — intentionally restricted to non-production environments.
 */
export const deleteAllConversations = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    await prisma.$transaction(async tx => {
      await tx.message.deleteMany({
        where: {
          conversation: {
            OR: [{ userAId: userId }, { userBId: userId }],
          },
        },
      });

      await tx.conversation.deleteMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
        },
      });
    });

    res.status(200).json(createSuccessResponse(null, 'All conversations deleted'));
  }
);
