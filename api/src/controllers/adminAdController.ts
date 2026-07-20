import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import Joi from 'joi';
import {
  createSuccessResponse,
  createPaginatedResponse,
  calculatePagination,
  StandardAd,
  AdStatus,
  AttributeType
} from '../types/api-responses';
import { transformLocationSummary } from '../types/standardized-models';
import {
  queueAdStatusNotification,
  queueNotification
} from '../background/queues/notification.queue';
import { ApiError, asyncHandler } from '../utils/errors';
import { formatISTDate } from '../utils/notifications';

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    phone: string;
  };
}

/**
 * Calculate expiration date at midnight IST (00:00)
 * @param durationDays - Number of days from now
 * @returns Date object (ISO string will be in UTC, but represents midnight IST)
 *
 * Example: If today is Feb 24 and duration is 7 days, returns March 3 00:00 IST
 * Which is stored as March 2 18:30 UTC (since IST = UTC+5:30)
 */
function calculateExpirationDate(durationDays: number): Date {
  const istOffsetHours = 5.5;
  const istOffsetMs = istOffsetHours * 60 * 60 * 1000;

  // Get current date in IST
  const now = new Date();
  const nowIST = new Date(now.getTime() + istOffsetMs);

  // Extract calendar date in IST
  const year = nowIST.getUTCFullYear();
  const month = nowIST.getUTCMonth();
  const day = nowIST.getUTCDate();

  // Create midnight UTC for today in IST
  const todayMidnightUTC = Date.UTC(year, month, day);

  // Add duration days and convert to IST timestamp
  const expirationTimestamp = todayMidnightUTC + (durationDays * 24 * 60 * 60 * 1000) - istOffsetMs;

  return new Date(expirationTimestamp);
}

// Helper function to transform Prisma ad data to StandardAd format
function transformAdToStandard(ad: {
  id: string;
  title: string;
  description: string;
  price: any;
  discountedPrice?: any;
  status: string;
  images: unknown;
  isFeatured: boolean;
  isFlagged: boolean;
  enableBooking?: boolean;
  flagReason: string | null;
  userId: string;
  categoryId: string;
  subcategoryId: string | null;
  // Verbose location fields from Google Maps
  locationLatitude: number | null;
  locationLongitude: number | null;
  locationRoad: string | null;
  locationHouseNumber: string | null;
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string | null;
  locationPostalCode: string | null;
  locationFormatted: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  rejectionReason: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string;
    email?: string | null;
    avatar?: string | null;
    createdAt: Date;
    isVerified: boolean;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
    adPlaceholder?: string | null;
  };
  subcategory?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  attributes?: Record<string, unknown>[];
  subscriptions?: {
    id: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
  }[];
  moderationHistory?: {
    id: string;
    action: string;
    reason: string | null;
    createdAt: Date;
    moderator: {
      id: string;
      firstName: string;
      lastName: string | null;
    };
  }[];
  views?: number;
  moderatedBy?: string | null;
  moderatedAt?: Date | null;
  attachment?: any; // JsonValue from Prisma
  bookingType?: string | null;
  slots?: any; // JsonValue from Prisma
  _count?: {
    images: number;
    views: number;
    likes: number;
  };
}): StandardAd {
  return {
    id: ad.id,
    title: ad.title,
    description: ad.description,
    price: ad.price ? Number(ad.price) : null,
    discountedPrice: ad.discountedPrice ? Number(ad.discountedPrice) : null,
    status: ad.status as AdStatus,
    images: Array.isArray(ad.images) ? ad.images as string[] : [],
    isFeatured: ad.isFeatured,
    enableBooking: ad.enableBooking || false,
    userId: ad.userId,
    categoryId: ad.categoryId,
    subcategoryId: ad.subcategoryId || undefined,
    // Verbose location fields from Google Maps
    locationLatitude: ad.locationLatitude ? Number(ad.locationLatitude) : undefined,
    locationLongitude: ad.locationLongitude ? Number(ad.locationLongitude) : undefined,
    locationRoad: ad.locationRoad || undefined,
    locationHouseNumber: ad.locationHouseNumber || undefined,
    locationCity: ad.locationCity || undefined,
    locationState: ad.locationState || undefined,
    locationCountry: ad.locationCountry || undefined,
    locationPostalCode: ad.locationPostalCode || undefined,
    locationFormatted: ad.locationFormatted || undefined,
    createdAt: ad.createdAt.toISOString(),
    updatedAt: ad.updatedAt.toISOString(),
    expiresAt: ad.expiresAt?.toISOString(),
    rejectionReason: ad.rejectionReason || undefined,
    isFlagged: ad.isFlagged,
    flagReason: ad.flagReason || undefined,
    attachment: Array.isArray(ad.attachment) ? (ad.attachment as string[]) : undefined,
    bookingType: ad.bookingType as 'DEFAULT' | 'SLOTS' | undefined,
    slots: ad.slots || undefined,
    user: ad.user ? {
      id: ad.user.id,
      firstName: ad.user.firstName,
      lastName: ad.user.lastName || undefined,
      phone: ad.user.phone,
      email: ad.user.email || undefined,
      avatar: ad.user.avatar || undefined,
      createdAt: ad.user.createdAt.toISOString(),
      isVerified: ad.user.isVerified || false
    } : undefined,
    category: ad.category ? {
      id: ad.category.id,
      name: ad.category.name,
      slug: ad.category.slug,
      adPlaceholder: ad.category.adPlaceholder || undefined
    } : undefined,
    subcategory: ad.subcategory ? {
      id: ad.subcategory.id,
      name: ad.subcategory.name,
      slug: ad.subcategory.slug
    } : undefined,
    attributes: ad.attributes?.map((attr: any) => ({
      id: attr.id,
      adId: attr.adId,
      attributeId: attr.attributeId,
      value: attr.value,
      attribute: attr.attribute ? {
        id: attr.attribute.id,
        name: attr.attribute.name,
        type: attr.attribute.type as AttributeType,
        options: Array.isArray(attr.attribute.options) ? attr.attribute.options : undefined,
        isRequired: attr.attribute.isRequired || false,
        order: attr.attribute.order || 0,
        subcategoryId: attr.attribute.subcategoryId || ''
      } : undefined
    })),
    subscriptions: ad.subscriptions?.map((sub: any) => ({
      id: sub.id,
      startDate: sub.startDate.toISOString(),
      endDate: sub.endDate.toISOString(),
      isActive: sub.isActive
    })),
    moderationHistory: ad.moderationHistory?.map((history: any) => ({
      id: history.id,
      action: history.action,
      reason: history.reason,
      createdAt: history.createdAt.toISOString(),
      moderator: {
        id: history.moderator.id,
        firstName: history.moderator.firstName,
        lastName: history.moderator.lastName
      }
    })),
    views: ad.views,
    moderatedBy: ad.moderatedBy || undefined,
    moderatedAt: ad.moderatedAt?.toISOString()
  };
}

// Validation schemas
const getAdsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED').optional(),
  categoryId: Joi.string().uuid().optional(),
  userId: Joi.string().uuid().optional(),
  search: Joi.string().max(255).optional(),
  isFeatured: Joi.boolean().optional()
});

const moderateAdSchema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED').required(),
  reason: Joi.string().max(500).optional()
});

const updateAdSchema = Joi.object({
  title: Joi.string().min(1).max(255),
  description: Joi.string().min(1).max(2000),
  price: Joi.number().min(0).precision(2).allow(null),
  discountedPrice: Joi.number().min(0).precision(2).allow(null),
  categoryId: Joi.string().uuid(),
  subcategoryId: Joi.string().uuid().allow(null),
  // Verbose location fields
  locationLatitude: Joi.number().allow(null),
  locationLongitude: Joi.number().allow(null),
  locationRoad: Joi.string().max(255).allow(null),
  locationHouseNumber: Joi.string().max(50).allow(null),
  locationCity: Joi.string().max(100).allow(null),
  locationState: Joi.string().max(100).allow(null),
  locationCountry: Joi.string().max(100).allow(null),
  locationPostalCode: Joi.string().max(20).allow(null),
  locationFormatted: Joi.string().max(255).allow(null),
  images: Joi.array().items(Joi.string().uri()).max(10),
  attachment: Joi.array().items(Joi.string().uri()).max(5).optional().allow(null),
  status: Joi.string().valid('REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'),
  isFeatured: Joi.boolean(),
  enableBooking: Joi.boolean(),
  bookingType: Joi.string().valid('DEFAULT', 'SLOTS'),
  slots: Joi.array().items(
    Joi.object({
      id: Joi.string().optional(),
      day: Joi.string().valid('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday').required(),
      startTime: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
      endTime: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
      maxBookings: Joi.number().integer().min(1).default(1)
    })
  ).optional().allow(null),
  userId: Joi.string().uuid().optional(),
  attributes: Joi.array().items(Joi.object({
    attributeId: Joi.string().uuid().required(),
    value: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean()).required()
  })).optional()
}).min(1);

const featureAdSchema = Joi.object({
  isFeatured: Joi.boolean().required()
});

const flagAdSchema = Joi.object({
  flagReason: Joi.string().max(500).required()
});

const createAdSchema = Joi.object({
  title: Joi.string().required().min(1).max(255),
  description: Joi.string().required().min(1).max(2000),
  price: Joi.number().min(0).precision(2).allow(null),
  discountedPrice: Joi.number().min(0).precision(2).allow(null).optional(),
  categoryId: Joi.string().uuid().required(),
  subcategoryId: Joi.string().uuid().optional(),
  // Verbose location fields
  locationLatitude: Joi.number().allow(null),
  locationLongitude: Joi.number().allow(null),
  locationRoad: Joi.string().max(255).allow(null),
  locationHouseNumber: Joi.string().max(50).allow(null),
  locationCity: Joi.string().max(100).allow(null),
  locationState: Joi.string().max(100).allow(null),
  locationCountry: Joi.string().max(100).allow(null),
  locationPostalCode: Joi.string().max(20).allow(null),
  locationFormatted: Joi.string().max(255).allow(null),
  enableBooking: Joi.boolean().default(false),
  bookingType: Joi.string().valid('DEFAULT', 'SLOTS').default('DEFAULT'),
  slots: Joi.array().items(
    Joi.object({
      id: Joi.string().optional(),
      day: Joi.string().valid('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday').required(),
      startTime: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
      endTime: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
      maxBookings: Joi.number().integer().min(1).default(1)
    })
  ).optional().allow(null),
  images: Joi.array().items(Joi.string().uri()).max(10).default([]),
  attachment: Joi.array().items(Joi.string().uri()).max(5).optional().allow(null),
  attributes: Joi.array().items(
    Joi.object({
      attributeId: Joi.string().uuid().required(),
      value: Joi.string().required()
    })
  ).optional(),
  status: Joi.string().valid('REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED').default('APPROVED'),
  isFeatured: Joi.boolean().default(false),
  userId: Joi.string().uuid().required()
});

/**
 * @swagger
 * /api/v1/admin/ads/pending:
 *   get:
 *     summary: Get pending ads for moderation
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 255
 *     responses:
 *       200:
 *         description: Pending ads retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ad'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const getPendingAds = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { error, value } = getAdsQuerySchema.validate(req.query);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { page, limit, categoryId, search } = value;
  const skip = (page - 1) * limit;

  // Build where clause for pending/review ads
  const where: Prisma.AdWhereInput = {};
  const andConditions: Prisma.AdWhereInput[] = [
    { status: { in: ['REVIEW'] } },
    {
      OR: [
        { expiresAt: { gte: new Date() } },
        { expiresAt: null }
      ]
    }
  ];

  if (categoryId) where.categoryId = categoryId;
  if (search) {
    andConditions.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  // Get pending ads with pagination
  const [ads, total] = await Promise.all([
    prisma.ad.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            email: true,
            createdAt: true,
            isVerified: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        attributes: {
          include: {
            attribute: {
              select: {
                id: true,
                name: true,
                type: true,
                options: true,
                isRequired: true,
                order: true,
                subcategoryId: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc' // Oldest first for moderation queue
      },
      skip,
      take: limit
    }),
    prisma.ad.count({ where })
  ]);

  // Transform ads to standard format
  const standardAds = ads.map(transformAdToStandard);

  const pagination = calculatePagination(page, limit, total);
  const response = createPaginatedResponse(standardAds, pagination);

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/admin/ads/{adId}/status:
 *   put:
 *     summary: Moderate an ad (approve/reject)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: 'Reason for rejection (optional)'
 *     responses:
 *       200:
 *         description: Ad moderated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Ad approved successfully'
 *                 data:
 *                   $ref: '#/components/schemas/Ad'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
export const moderateAd = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { error, value } = moderateAdSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { adId } = req.params;
  const { status, reason } = value;

  // Check if ad exists
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          avatar: true,
          createdAt: true,
          isVerified: true
        }
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          supportsBooking: true,
          adPlaceholder: true
        }
      },
      subcategory: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      subscriptions: {
        select: {
          id: true,
          isActive: true
        }
      }
    }
  });

  if (!ad) {
    throw ApiError.adNotFound();
  }

  // Check if ad is in review, approved, or rejected status
  // Allow: REVIEW -> APPROVED/REJECTED, APPROVED -> REJECTED, REJECTED -> APPROVED
  if (ad.status === 'EXPIRED') {
    throw ApiError.validation('Expired ads cannot be moderated. Please create a new ad.');
  }

  // If unpublishing (Approved -> Rejected), ensure reason is provided
  if (ad.status === 'APPROVED' && status === 'REJECTED' && !reason) {
    throw ApiError.validation('Reason is required when unpublishing an ad');
  }

  // If re-approving (Rejected -> Approved), no reason needed
  if (ad.status === 'REJECTED' && status === 'APPROVED') {
    // Allow re-approval
  }

  // Update ad status and create notification in a transaction
  const updatedAd = await prisma.$transaction(async (tx) => {
    // Get duration from settings if approving
    let expiresAt: Date | null = null;
    if (status === 'APPROVED') {
      // Check if ad has an active subscription (paid ad)
      const hasActiveSubscription = ad.subscriptions && ad.subscriptions.some(sub => sub.isActive);

      const settingKey = hasActiveSubscription ? 'subscription_duration' : 'free_ad_duration';
      const durationSetting = await tx.setting.findUnique({
        where: { key: settingKey },
        select: { value: true }
      });

      const duration = parseInt(typeof durationSetting?.value === 'object'
        ? JSON.stringify(durationSetting.value)
        : String(durationSetting?.value ?? '7'), 10);
      expiresAt = calculateExpirationDate(duration);
    }

    // Update ad status
    const updatedAd = await tx.ad.update({
      where: { id: adId },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? reason : null,
        expiresAt,
        updatedAt: new Date()
      },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        price: true,
        discountedPrice: true,
        status: true,
        images: true,
        // Verbose location fields
        locationLatitude: true,
        locationLongitude: true,
        locationRoad: true,
        locationHouseNumber: true,
        locationCity: true,
        locationState: true,
        locationCountry: true,
        locationPostalCode: true,
        locationFormatted: true,
        categoryId: true,
        subcategoryId: true,
        userId: true,
        isFeatured: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
        rejectionReason: true,
        isFlagged: true,
        flagReason: true,
        enableBooking: true,
        views: true,
        shares: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            avatar: true,
            createdAt: true,
            isVerified: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    // Handle subscriptions based on status change
    if (status === 'APPROVED') {
      // Check if subscription already exists (active or inactive)
      const existingSubscription = await tx.subscription.findFirst({
        where: { adId: updatedAd.id }
      });

      if (existingSubscription) {
        // Reactivate existing subscription (for re-approval after unpublish)
        await tx.subscription.update({
          where: { id: existingSubscription.id },
          data: {
            isActive: true,
            updatedAt: new Date()
          }
        });
      } else if (expiresAt) {
        // Create new subscription only for first-time approval
        await tx.subscription.create({
          data: {
            userId: updatedAd.userId,
            adId: updatedAd.id,
            startDate: new Date(),
            endDate: expiresAt,
            isActive: true
          }
        });
      }
    } else if (status === 'REJECTED') {
      // Deactivate subscription when unpublishing
      await tx.subscription.updateMany({
        where: { adId: updatedAd.id, isActive: true },
        data: { isActive: false, updatedAt: new Date() }
      });
    }

    // Create moderation history entry
    await tx.moderationHistory.create({
      data: {
        adId: updatedAd.id,
        moderatorId: req.user!.id,
        action: status,
        reason: reason || null
      }
    });

    return updatedAd;
  });

  // Send push notification to user about ad status change (async - non-blocking)
  try {
    queueAdStatusNotification(
      updatedAd.userId,
      updatedAd.id,
      updatedAd.title,
      status,
      reason || undefined,
      updatedAd.slug || undefined,
      updatedAd.expiresAt ? formatISTDate(updatedAd.expiresAt) : undefined
    ).catch(err => console.error('Failed to queue ad status notification:', err));
  } catch (error) {
    console.error('Failed to send notifications for ad status change:', error);
    // Don't fail the request if notification fails
  }

  // Catch up any pre-expiry tiers the ad already sits in (e.g. approved
  // after the morning cron window would have sent the 15-day SMS).
  if (status === 'APPROVED' && updatedAd.expiresAt) {
    import('../utils/pre-expiry-reminders')
      .then(({ queueDuePreExpiryRemindersForAd }) =>
        queueDuePreExpiryRemindersForAd(updatedAd.id)
      )
      .catch(err => console.error('Failed to queue due pre-expiry reminders:', err));
  }

  const message = status === 'APPROVED' ? 'Ad approved successfully' : 'Ad rejected successfully';
  const standardAd = transformAdToStandard(updatedAd);
  const response = createSuccessResponse(standardAd, message);

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/admin/ads:
 *   get:
 *     summary: Get all ads with filtering
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [REVIEW, APPROVED, REJECTED, EXPIRED]
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 255
 *       - in: query
 *         name: isFeatured
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Ads retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ad'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const getAllAds = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { error, value } = getAdsQuerySchema.validate(req.query);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { page, limit, status, categoryId, userId, search, isFeatured } = value;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Prisma.AdWhereInput = {};
  const andConditions: Prisma.AdWhereInput[] = [];

  if (categoryId) where.categoryId = categoryId;
  if (userId) where.userId = userId;
  if (isFeatured !== undefined) where.isFeatured = isFeatured;

  if (status === 'EXPIRED') {
    andConditions.push({
      OR: [
        { status: 'EXPIRED' },
        {
          status: { in: ['REVIEW', 'APPROVED'] },
          expiresAt: { lt: new Date() }
        }
      ]
    });
  } else if (status) {
    andConditions.push({ status });
    if (status === 'APPROVED' || status === 'REVIEW') {
      andConditions.push({
        OR: [
          { expiresAt: { gte: new Date() } },
          { expiresAt: null }
        ]
      });
    }
  }

  if (search) {
    andConditions.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  // Get ads with pagination
  const [ads, total] = await Promise.all([
    prisma.ad.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            email: true,
            createdAt: true,
            isVerified: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        attributes: {
          include: {
            attribute: {
              select: {
                id: true,
                name: true,
                type: true,
                options: true,
                isRequired: true,
                order: true,
                subcategoryId: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    }),
    prisma.ad.count({ where })
  ]);

  // Transform ads to standard format
  const standardAds = ads.map(transformAdToStandard);

  const pagination = calculatePagination(page, limit, total);
  const response = createPaginatedResponse(standardAds, pagination);

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/admin/ads/{adId}:
 *   get:
 *     summary: Get detailed ad information
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ad details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Ad'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
export const getAdDetails = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { adId } = req.params;

  const ad = await prisma.ad.findUnique({
    where: { id: adId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          avatar: true,
          createdAt: true,
          isVerified: true
        }
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          supportsBooking: true,
          adPlaceholder: true
        }
      },
      subcategory: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      attributes: {
        include: {
          attribute: {
            select: {
              id: true,
              name: true,
              type: true,
              options: true,
              isRequired: true,
              order: true,
              subcategoryId: true
            }
          }
        }
      },
      subscriptions: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          isActive: true
        }
      },
      moderationHistory: {
        select: {
          id: true,
          action: true,
          reason: true,
          createdAt: true,
          moderator: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50 // Limit to most recent 50 entries
      }
    }
  });

  if (!ad) {
    throw ApiError.adNotFound();
  }

  console.log('[getAdDetails] Ad from DB, enableBooking:', ad.enableBooking);

  const standardAd = transformAdToStandard(ad);
  console.log('[getAdDetails] Transformed ad, enableBooking:', standardAd.enableBooking);

  const response = createSuccessResponse(standardAd);
  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/admin/ads/{adId}:
 *   put:
 *     summary: Edit any ad (Admin override)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *               price:
 *                 type: number
 *                 minimum: 0
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               subcategoryId:
 *                 type: string
 *                 format: uuid
 *               locationId:
 *                 type: string
 *                 format: uuid
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 maxItems: 10
 *               status:
 *                 type: string
 *                 enum: [REVIEW, APPROVED, REJECTED, EXPIRED]
 *               isFeatured:
 *                 type: boolean
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: 'Optional: User ID to transfer ad ownership'
 *     responses:
 *       200:
 *         description: Ad updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Ad updated successfully'
 *                 data:
 *                   $ref: '#/components/schemas/Ad'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
export const updateAd = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = updateAdSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
      return;
    }

    const { adId } = req.params;

    // Check if ad exists
    const existingAd = await prisma.ad.findUnique({
      where: { id: adId }
    });

    if (!existingAd) {
      res.status(404).json({
        success: false,
        error: {
          code: 'AD_NOT_FOUND',
          message: 'Ad not found'
        }
      });
      return;
    }

    const { categoryId, subcategoryId, userId } = value;

    // Verify user exists if userId is being updated
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
        return;
      }
    }

    // Verify category exists if being updated
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId, isActive: true }
      });

      if (!category) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CATEGORY_NOT_FOUND',
            message: 'Category not found'
          }
        });
        return;
      }
    }

    // Verify subcategory exists if being updated
    if (subcategoryId) {
      const subcategory = await prisma.subcategory.findUnique({
        where: {
          id: subcategoryId,
          categoryId: categoryId || existingAd.categoryId,
          isActive: true
        }
      });

      if (!subcategory) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SUBCATEGORY_NOT_FOUND',
            message: 'Subcategory not found'
          }
        });
        return;
      }
    }

    // Prepare update data, excluding userId if not provided
    const updateData: Record<string, unknown> = { ...value };
    if (!userId) {
      delete updateData.userId;
    }
    // Remove attributes from updateData as they are handled separately
    delete updateData.attributes;

    // Debug logging
    console.log('[updateAd] Updating ad with enableBooking:', updateData.enableBooking);
    console.log('[updateAd] Full updateData:', JSON.stringify(updateData, null, 2));

    // Update ad and attributes in a transaction
    const updatedAd = await prisma.$transaction(async (tx) => {
      // 1. Update main ad details
      await tx.ad.update({
        where: { id: adId },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });

      // 2. Verify the update - fetch the ad again to confirm
      const verifyAd = await tx.ad.findUnique({
        where: { id: adId },
        select: {
          id: true,
          title: true,
          enableBooking: true
        }
      });
      console.log('[updateAd] Verification after update - enableBooking:', verifyAd?.enableBooking);

      // 2. Handle attributes if provided
      if (value.attributes) {
        // Delete existing attributes
        await tx.adAttribute.deleteMany({
          where: { adId: adId }
        });

        // Create new attributes
        if (value.attributes.length > 0) {
          await tx.adAttribute.createMany({
            data: value.attributes.map((attr: { attributeId: string; value: string | number | boolean }) => ({
              adId: adId,
              attributeId: attr.attributeId,
              value: String(attr.value) // Ensure value is stored as string
            }))
          });
        }
      }

      // 3. Return updated ad with all relations
      const finalAd = await tx.ad.findUnique({
        where: { id: adId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              avatar: true,
              createdAt: true,
              isVerified: true
            }
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              supportsBooking: true,
              adPlaceholder: true
            }
          },
          subcategory: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          attributes: {
            include: {
              attribute: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  options: true,
                  isRequired: true,
                  order: true,
                  subcategoryId: true
                }
              }
            }
          }
        }
      });

      console.log('[updateAd] Final ad from DB - enableBooking:', finalAd?.enableBooking);
      return finalAd;
    });

    if (!updatedAd) {
      throw new Error('Failed to retrieve updated ad');
    }

    console.log('[updateAd] Updated ad from DB, enableBooking:', updatedAd.enableBooking);
    console.log('[updateAd] Raw updatedAd object:', JSON.stringify({
      id: updatedAd.id,
      title: updatedAd.title,
      enableBooking: updatedAd.enableBooking,
      category: updatedAd.category
    }, null, 2));

    const standardAd = transformAdToStandard(updatedAd);
    console.log('[updateAd] Transformed ad, enableBooking:', standardAd.enableBooking);

    const response = createSuccessResponse(standardAd, 'Ad updated successfully');
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/ads/{adId}/featured:
 *   put:
 *     summary: Feature or unfeature an ad
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isFeatured
 *             properties:
 *               isFeatured:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Ad featured status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Ad featured successfully'
 *                 data:
 *                   $ref: '#/components/schemas/Ad'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
export const featureAd = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = featureAdSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
      return;
    }

    const { adId } = req.params;
    const { isFeatured } = value;

    // Check if ad exists
    const ad = await prisma.ad.findUnique({
      where: { id: adId }
    });

    if (!ad) {
      res.status(404).json({
        success: false,
        error: {
          code: 'AD_NOT_FOUND',
          message: 'Ad not found'
        }
      });
      return;
    }

    // Only approved ads can be featured
    if (ad.status !== 'APPROVED' && isFeatured) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Only approved ads can be featured'
        }
      });
      return;
    }

    // Update featured status
    const updatedAd = await prisma.ad.update({
      where: { id: adId },
      data: {
        isFeatured,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            avatar: true,
            createdAt: true,
            isVerified: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    const message = isFeatured ? 'Ad featured successfully' : 'Ad unfeatured successfully';
    const standardAd = transformAdToStandard(updatedAd);
    const response = createSuccessResponse(standardAd, message);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/ads/{adId}:
 *   delete:
 *     summary: Delete an ad
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Ad deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
export const deleteAd = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { adId } = req.params;

  // Check if ad exists
  const ad = await prisma.ad.findUnique({
    where: { id: adId }
  });

  if (!ad) {
    throw ApiError.adNotFound();
  }

  // Delete ad (this will cascade delete related records)
  await prisma.ad.delete({
    where: { id: adId }
  });

  const response = createSuccessResponse(null, 'Ad deleted successfully');
  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/admin/ads/{adId}/flag:
 *   put:
 *     summary: Flag an ad
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - flagReason
 *             properties:
 *               flagReason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Ad flagged successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Ad flagged successfully'
 *                 data:
 *                   $ref: '#/components/schemas/Ad'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
export const flagAd = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { error, value } = flagAdSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { adId } = req.params;
  const { flagReason } = value;

  // Check if ad exists
  const ad = await prisma.ad.findUnique({
    where: { id: adId }
  });

  if (!ad) {
    throw ApiError.adNotFound();
  }

  // Update ad with flag
  const updatedAd = await prisma.ad.update({
    where: { id: adId },
    data: {
      isFlagged: true,
      flagReason,
      updatedAt: new Date()
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          avatar: true,
          createdAt: true,
          isVerified: true
        }
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          supportsBooking: true,
          adPlaceholder: true
        }
      },
      subcategory: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  const standardAd = transformAdToStandard(updatedAd);
  const response = createSuccessResponse(standardAd, 'Ad flagged successfully');
  res.status(200).json(response);
});

/**
 * Get ad stats for admin (views, favorites, shares, bookings)
 */
export const getAdStatsAdmin = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { adId } = req.params;

  // Check if ad exists
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
    select: { id: true, views: true, shares: true }
  });

  if (!ad) {
    throw ApiError.adNotFound();
  }

  const [favoritesCount, bookingsCount] = await Promise.all([
    prisma.wishlist.count({ where: { adId } }),
    prisma.booking.count({ where: { adId } })
  ]);

  const response = createSuccessResponse({
    views: ad.views || 0,
    favorites: favoritesCount,
    shares: ad.shares || 0,
    bookings: bookingsCount
  });

  res.status(200).json(response);
});

// Validation schema for reviewing revisions
const reviewRevisionSchema = Joi.object({
  action: Joi.string().valid('APPROVE', 'REJECT').required(),
  note: Joi.string().max(500).when('action', {
    is: 'REJECT',
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

/**
 * @swagger
 * /api/v1/admin/ads/revisions:
 *   get:
 *     summary: Get all ads with pending revisions (safe field changes)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Ads with pending revisions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       status:
 *                         type: string
 *                       hasRevision:
 *                         type: boolean
 *                       pendingChanges:
 *                         type: object
 *                       revisionCreatedAt:
 *                         type: string
 *                         format: date-time
 *                       autoApplyAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const getAdsWithPendingRevisions = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { error, value } = getAdsQuerySchema.validate(req.query);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { page, limit } = value;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Prisma.AdWhereInput = {
    hasRevision: true
  };

  // Get ads with pending revisions
  const [ads, total] = await Promise.all([
    prisma.ad.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        revisions: {
          where: { status: 'REVIEW' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.ad.count({ where })
  ]);

  // Transform ads
  const data = ads.map(ad => ({
    ...transformAdToStandard(ad as any),
    pendingChanges: ad.revisions[0]?.changes,
    revisionCreatedAt: ad.revisions[0]?.createdAt?.toISOString(),
    autoApplyAt: ad.revisions[0]?.autoApplyAt?.toISOString()
  }));

  const pagination = calculatePagination(page, limit, total);
  const response = createPaginatedResponse(data, pagination);

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/admin/ads/{adId}/revisions/{revisionId}:
 *   put:
 *     summary: Review and approve/reject ad revision
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: revisionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [APPROVE, REJECT]
 *               note:
 *                 type: string
 *                 maxLength: 500
 *                 description: Required when rejecting
 *     responses:
 *       200:
 *         description: Revision reviewed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Changes approved and applied'
 *                 data:
 *                   $ref: '#/components/schemas/Ad'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
export const reviewRevision = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { error, value } = reviewRevisionSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { adId, revisionId } = req.params;
  const { action, note } = value;
  const adminId = req.user!.id;

  // Find revision
  const revision = await prisma.adRevision.findFirst({
    where: { id: revisionId, adId, status: 'REVIEW' },
    include: { ad: true }
  });

  if (!revision) {
    throw ApiError.notFound('Revision not found or already reviewed');
  }

  if (action === 'APPROVE') {
    // Apply changes to ad
    const updatedAd = await prisma.$transaction(async (tx) => {
      // Update ad with changes
      const ad = await tx.ad.update({
        where: { id: adId },
        data: {
          ...revision.changes as any,
          hasRevision: false,
          updatedAt: new Date()
        },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          price: true,
          discountedPrice: true,
          status: true,
          images: true,
          // Verbose location fields
          locationLatitude: true,
          locationLongitude: true,
          locationRoad: true,
          locationHouseNumber: true,
          locationCity: true,
          locationState: true,
          locationCountry: true,
          locationPostalCode: true,
          locationFormatted: true,
          categoryId: true,
          subcategoryId: true,
          userId: true,
          isFeatured: true,
          createdAt: true,
          updatedAt: true,
          expiresAt: true,
          rejectionReason: true,
          isFlagged: true,
          flagReason: true,
          enableBooking: true,
          views: true,
          shares: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              avatar: true,
              createdAt: true,
              isVerified: true
            }
          },
          category: { select: { id: true, name: true, slug: true, adPlaceholder: true } },
          subcategory: { select: { id: true, name: true, slug: true } },
          attributes: {
            include: {
              attribute: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  options: true,
                  isRequired: true,
                  order: true,
                  subcategoryId: true
                }
              }
            }
          }
        }
      });

      // Update revision status
      await tx.adRevision.update({
        where: { id: revisionId },
        data: {
          status: 'APPROVED',
          reviewedBy: adminId,
          reviewedAt: new Date()
        }
      });

      // Create moderation history
      await tx.moderationHistory.create({
        data: {
          adId,
          moderatorId: adminId,
          action: 'REVISION_APPROVED',
          reason: 'Pending changes approved by admin'
        }
      });

      return ad;
    });

    // Notify user (async - non-blocking)
    queueAdStatusNotification(
      revision.ad.userId,
      adId,
      updatedAd.title,
      'APPROVED',
      'Your changes have been approved and are now live',
      updatedAd.slug || undefined
    ).catch(err => console.error('Failed to queue ad status notification:', err));

    const standardAd = transformAdToStandard(updatedAd);
    res.status(200).json(createSuccessResponse(standardAd, 'Changes approved and applied'));

  } else {
    // Reject: discard changes
    await prisma.$transaction([
      prisma.ad.update({
        where: { id: adId },
        data: { hasRevision: false }
      }),
      prisma.adRevision.update({
        where: { id: revisionId },
        data: {
          status: 'REJECTED',
          reviewedBy: adminId,
          reviewedAt: new Date(),
          reviewNote: note
        }
      }),
      prisma.moderationHistory.create({
        data: {
          adId,
          moderatorId: adminId,
          action: 'REVISION_REJECTED',
          reason: note
        }
      })
    ]);

    // Notify user (async - non-blocking)
    queueNotification(
      revision.ad.userId,
      'Changes Rejected',
      `Your changes to "${revision.ad.title}" were rejected. ${note || ''}`,
      'AD_REJECTED',
      { adId, reason: note }
    ).catch(err => console.error('Failed to queue notification:', err));

    res.status(200).json(createSuccessResponse(null, 'Changes rejected'));
  }
});

/**
 * @swagger
 * /api/v1/admin/ads:
 *   post:
 *     summary: Create a new ad (Admin override)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - categoryId
 *               - userId
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *               price:
 *                 type: number
 *                 minimum: 0
 *               discountedPrice:
 *                 type: number
 *                 minimum: 0
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               subcategoryId:
 *                 type: string
 *                 format: uuid
 *               locationId:
 *                 type: string
 *                 format: uuid
 *               enableBooking:
 *                 type: boolean
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 maxItems: 10
 *               status:
 *                 type: string
 *                 enum: [REVIEW, APPROVED, REJECTED, EXPIRED]
 *                 default: APPROVED
 *               isFeatured:
 *                 type: boolean
 *                 default: false
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID to assign the ad to
 *               attributes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - attributeId
 *                     - value
 *                   properties:
 *                     attributeId:
 *                       type: string
 *                       format: uuid
 *                     value:
 *                       type: string
 *     responses:
 *       201:
 *         description: Ad created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Ad created successfully'
 *                 data:
 *                   $ref: '#/components/schemas/Ad'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
export const createAd = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { error, value } = createAdSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const {
    title,
    description,
    price,
    discountedPrice,
    categoryId,
    subcategoryId,
    // Verbose location fields
    locationLatitude,
    locationLongitude,
    locationRoad,
    locationHouseNumber,
    locationCity,
    locationState,
    locationCountry,
    locationPostalCode,
    locationFormatted,
    enableBooking,
    images,
    status = 'APPROVED',
    isFeatured = false,
    userId,
    attributes
  } = value;

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw ApiError.userNotFound();
  }

  // Verify category exists
  const category = await prisma.category.findUnique({
    where: { id: categoryId, isActive: true }
  });

  if (!category) {
    throw ApiError.categoryNotFound();
  }

  // Verify subcategory exists if provided
  if (subcategoryId) {
    const subcategory = await prisma.subcategory.findUnique({
      where: { id: subcategoryId, categoryId, isActive: true }
    });

    if (!subcategory) {
      throw ApiError.subcategoryNotFound();
    }
  }

  // Generate slug from title
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

  // Get free ad duration from settings (admin-created ads start as free)
  const durationSetting = await prisma.setting.findUnique({
    where: { key: 'free_ad_duration' },
    select: { value: true }
  });
  const freeAdDuration = parseInt(typeof durationSetting?.value === 'object'
    ? JSON.stringify(durationSetting.value)
    : String(durationSetting?.value ?? '7'), 10);
  const expiresAt = calculateExpirationDate(freeAdDuration);

  // Create ad in a transaction
  const createdAd = await prisma.$transaction(async (tx) => {
    // Create the ad
    const ad = await tx.ad.create({
      data: {
        title,
        description,
        price: price ? new Prisma.Decimal(price) : null,
        discountedPrice: discountedPrice ? new Prisma.Decimal(discountedPrice) : null,
        status,
        images: images || [],
        isFeatured,
        enableBooking: enableBooking || false,
        slug,
        userId,
        categoryId,
        subcategoryId: subcategoryId || null,
        // Verbose location fields
        locationLatitude: locationLatitude || null,
        locationLongitude: locationLongitude || null,
        locationRoad: locationRoad || null,
        locationHouseNumber: locationHouseNumber || null,
        locationCity: locationCity || null,
        locationState: locationState || null,
        locationCountry: locationCountry || null,
        locationPostalCode: locationPostalCode || null,
        locationFormatted: locationFormatted || null,
        expiresAt: status === 'APPROVED' ? expiresAt : null
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            email: true,
            createdAt: true,
            isVerified: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    // Create attributes if provided
    if (attributes && attributes.length > 0) {
      await Promise.all(
        attributes.map((attr: any) =>
          tx.adAttribute.create({
            data: {
              adId: ad.id,
              attributeId: attr.attributeId,
              value: attr.value
            }
          })
        )
      );
    }

    // Create subscription if status is APPROVED
    if (status === 'APPROVED') {
      await tx.subscription.create({
        data: {
          userId: ad.userId,
          adId: ad.id,
          startDate: new Date(),
          endDate: expiresAt,
          isActive: true
        }
      });
    }

    // If status is APPROVED, create notification for the user
    if (status === 'APPROVED') {
      // Queue notification for ad approval
      queueAdStatusNotification(
        ad.userId,
        ad.id,
        ad.title,
        'APPROVED',
        undefined,
        ad.slug || undefined,
        expiresAt ? formatISTDate(expiresAt) : undefined
      ).catch(err => console.error('Failed to queue ad approval notification:', err));

      // Create moderation history entry
      await tx.moderationHistory.create({
        data: {
          adId: ad.id,
          moderatorId: req.user!.id,
          action: 'CREATED',
          reason: 'Ad created by admin'
        }
      });
    }

    return ad;
  });

  if (status === 'APPROVED' && createdAd.expiresAt) {
    import('../utils/pre-expiry-reminders')
      .then(({ queueDuePreExpiryRemindersForAd }) =>
        queueDuePreExpiryRemindersForAd(createdAd.id)
      )
      .catch(err => console.error('Failed to queue due pre-expiry reminders:', err));
  }

  const standardAd = transformAdToStandard(createdAd);
  const response = createSuccessResponse(standardAd, 'Ad created successfully');

  res.status(201).json(response);
});