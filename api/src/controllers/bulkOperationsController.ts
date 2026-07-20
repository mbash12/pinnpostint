import { Request, Response } from 'express';
import { PrismaClient, Prisma, NotificationType } from '@prisma/client';
import Joi from 'joi';
import { queueBulkNotifications } from '../background/queues/notification.queue';
import { resolveNotificationChannels, USER_ANNOUNCEMENT_CHANNELS } from '../utils/notification-channel-settings';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

// Validation schemas
const bulkUpdateAdsSchema = Joi.object({
  adIds: Joi.array().items(Joi.string()).min(1).required(),
  status: Joi.string().valid('REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED').required()
});

const NOTIFICATION_TYPE_VALUES = [
  'SYSTEM',
  'PROMOTION',
  'GENERAL',
  'BOOKING',
  'BOOKING_UPDATE',
  'AD_APPROVED',
  'AD_REJECTED',
  'SUBSCRIPTION_EXPIRY'
] as const;

const announcementTapDataSchema = Joi.object({
  deepLink: Joi.string().trim().max(500).allow('', null),
  url: Joi.string().trim().max(2000).allow('', null)
}).custom((value) => {
  if (!value || typeof value !== 'object') return undefined;
  const deep = typeof value.deepLink === 'string' ? value.deepLink.trim() : '';
  const url = typeof value.url === 'string' ? value.url.trim() : '';
  if (!deep && !url) return undefined;
  const out: { deepLink?: string; url?: string } = {};
  if (deep) out.deepLink = deep;
  if (url) out.url = url;
  return out;
});

const bulkNotificationSchema = Joi.object({
  criteria: Joi.object({
    isVerified: Joi.boolean().optional(),
    hasActiveAds: Joi.boolean().optional()
  }).required(),
  notification: Joi.object({
    title: Joi.string().min(1).max(255).required(),
    message: Joi.string().min(1).max(2000).required(),
    type: Joi.string()
      .valid(
        ...NOTIFICATION_TYPE_VALUES,
        ...NOTIFICATION_TYPE_VALUES.map((t) => t.toLowerCase())
      )
      .required(),
    data: announcementTapDataSchema.optional()
  }).required(),
  channels: Joi.array().items(Joi.string().valid('push', 'email')).max(2).optional()
});

const notificationCleanupSchema = Joi.object({
  olderThanDays: Joi.number().integer().min(1).max(365).required()
});

/**
 * @swagger
 * /api/v1/admin/bulk-operations/ads/status:
 *   put:
 *     summary: Bulk update ad status
 *     tags: [Admin - Bulk Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               status:
 *                 type: string
 *                 enum: [review, approved, rejected, active, inactive]
 *     responses:
 *       200:
 *         description: Ads status updated successfully
 */
export const bulkUpdateAdStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { error, value } = bulkUpdateAdsSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const { adIds, status } = value;

    // Update ads
    const result = await prisma.ad.updateMany({
      where: {
        id: {
          in: adIds
        }
      },
      data: {
        status
      }
    });

    res.json({
      success: true,
      message: `Successfully updated ${result.count} ads`,
      data: {
        updatedCount: result.count,
        status
      }
    });
  } catch (error) {
    console.error('Error in bulkUpdateAdStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/v1/admin/bulk-operations/users/notifications:
 *   post:
 *     summary: Send notification to users matching criteria
 *     tags: [Admin - Bulk Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               criteria:
 *                 type: object
 *                 properties:
 *                   role:
 *                     type: string
 *                     enum: [user, admin]
 *                   isVerified:
 *                     type: boolean
 *                   locationId:
 *                     type: integer
 *                   hasActiveAds:
 *                     type: boolean
 *               notification:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                   message:
 *                     type: string
 *                   type:
 *                     type: string
 *                     enum: [system, promotion, warning, info]
 *     responses:
 *       200:
 *         description: Notifications sent successfully
 */
export const bulkSendNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { error, value } = bulkNotificationSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const { criteria, notification, channels } = value;

    const normalizedType = String(notification.type).toUpperCase() as NotificationType;
    if (!NOTIFICATION_TYPE_VALUES.includes(normalizedType as (typeof NOTIFICATION_TYPE_VALUES)[number])) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: ['Invalid notification type']
      });
      return;
    }

    // Bulk announcements: app users only (never admin accounts); outbound is push + email only (no SMS).
    const whereClause: Prisma.UserWhereInput = {
      role: 'USER',
      ...(criteria.isVerified !== undefined ? { isVerified: criteria.isVerified } : {})
    };

    // Get users matching criteria
    let users = await prisma.user.findMany({
      where: whereClause,
      select: { id: true }
    });

    // Filter by hasActiveAds if specified
    if (criteria.hasActiveAds !== undefined) {
      const candidateIds = users.map((user: { id: string }) => user.id);
      const usersWithAds = await prisma.ad.findMany({
        where: {
          userId: { in: candidateIds },
          status: 'APPROVED'
        },
        select: { userId: true },
        distinct: ['userId']
      });

      const usersWithActiveAds = usersWithAds.map((ad: { userId: string }) => ad.userId);
      
      if (criteria.hasActiveAds) {
        users = users.filter((user: { id: string }) => usersWithActiveAds.includes(user.id));
      } else {
        users = users.filter((user: { id: string }) => !usersWithActiveAds.includes(user.id));
      }
    }

    const userIds = users.map((user: { id: string }) => user.id);

    const tap = notification.data as { deepLink?: string; url?: string } | undefined;
    const prismaData =
      tap && (tap.deepLink || tap.url)
        ? ({
            ...(tap.deepLink ? { deepLink: tap.deepLink } : {}),
            ...(tap.url ? { url: tap.url } : {})
          } as Prisma.InputJsonValue)
        : undefined;
    const pushTapPayload =
      tap && (tap.deepLink || tap.url)
        ? {
            ...(tap.deepLink ? { deepLink: tap.deepLink } : {}),
            ...(tap.url ? { url: tap.url } : {})
          }
        : undefined;

    // Create notifications for all matching users (in-app feed)
    const notifications = userIds.map((userId: string) => ({
      userId,
      title: notification.title,
      message: notification.message,
      type: normalizedType,
      isRead: false,
      ...(prismaData !== undefined ? { data: prismaData } : {})
    }));

    await prisma.notification.createMany({
      data: notifications
    });

    const pushEmailRequest = (
      (channels as unknown as string[] | undefined)?.filter(
        (c): c is 'push' | 'email' => c === 'push' || c === 'email'
      ) ?? []
    );

    const resolvedChannels =
      userIds.length > 0
        ? (await resolveNotificationChannels(
            pushEmailRequest.length > 0 ? pushEmailRequest : [...USER_ANNOUNCEMENT_CHANNELS],
            false
          )).filter((c): c is 'push' | 'email' => c === 'push' || c === 'email')
        : [];

    if (userIds.length > 0) {
      queueBulkNotifications(
        userIds,
        notification.title,
        notification.message,
        normalizedType,
        pushTapPayload,
        { channels: resolvedChannels }
      ).catch((err) => console.error('Failed to queue bulk announcement delivery:', err));
    }

    res.json({
      success: true,
      message: `Notifications sent to ${users.length} users`,
      data: {
        sentCount: users.length,
        criteria,
        notification: { ...notification, type: normalizedType },
        channelsQueued: resolvedChannels
      }
    });
  } catch (error) {
    console.error('Error in bulkSendNotifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/v1/admin/bulk-operations/cleanup/expired:
 *   post:
 *     summary: Clean up expired ads and subscriptions
 *     tags: [Admin - Bulk Operations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cleanup completed successfully
 */
export const cleanupExpired = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();

    // Clean up expired ads
    const expiredAdsResult = await prisma.ad.updateMany({
      where: {
        expiresAt: {
          lt: now
        },
        status: {
          in: ['APPROVED', 'REVIEW']
        }
      },
      data: {
        status: 'EXPIRED'
      }
    });

    // Clean up expired subscriptions
    const expiredSubscriptionsResult = await prisma.subscription.updateMany({
      where: {
        endDate: {
          lt: now
        },
        isActive: true
      },
      data: {
        isActive: false
      }
    });

    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      data: {
        expiredAdsCount: expiredAdsResult.count,
        expiredSubscriptionsCount: expiredSubscriptionsResult.count,
        cleanupDate: now
      }
    });
  } catch (error) {
    console.error('Error in cleanupExpired:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/v1/admin/bulk-operations/notifications/cleanup:
 *   post:
 *     summary: Clean up old read notifications
 *     tags: [Admin - Bulk Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               olderThanDays:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *     responses:
 *       200:
 *         description: Notification cleanup completed successfully
 */
export const cleanupNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { error, value } = notificationCleanupSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const { olderThanDays } = value;
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    // Delete old read notifications
    const result = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        sentAt: {
          lt: cutoffDate
        }
      }
    });

    res.json({
      success: true,
      message: `Cleaned up ${result.count} old notifications`,
      data: {
        deletedCount: result.count,
        olderThanDays,
        cutoffDate
      }
    });
  } catch (error) {
    console.error('Error in cleanupNotifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};