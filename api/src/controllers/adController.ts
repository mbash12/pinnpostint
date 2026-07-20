import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/database';
import Joi from 'joi';
import {
  createSuccessResponse,
  createPaginatedResponse,
  calculatePagination,
  StandardAd,
  AdStatus,
  ErrorCode
} from '../types/api-responses';
import { transformLocationSummary } from '../types/standardized-models';
import { ApiError, asyncHandler } from '../utils/errors';
import { queueAdStatusNotification } from '../background/queues/notification.queue';
import logger from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    phone: string;
  };
}

// Helper function to generate slug from title
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

// Helper function to transform Prisma ad data to StandardAd format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformAdToStandard(ad: any): StandardAd {
  return {
    id: ad.id,
    title: ad.title,
    description: ad.description,
    price: ad.price ? Number(ad.price) : null,
    discountedPrice: ad.discountedPrice ? Number(ad.discountedPrice) : undefined,
    status: ad.status as AdStatus,
    images: Array.isArray(ad.images) ? ad.images as string[] : [],
    isFeatured: ad.isFeatured,
    enableBooking: ad.enableBooking,
    userId: ad.userId,
    categoryId: ad.categoryId,
    subcategoryId: ad.subcategoryId || undefined,
    // Verbose location fields
    locationLatitude: ad.locationLatitude ? Number(ad.locationLatitude) : undefined,
    locationLongitude: ad.locationLongitude ? Number(ad.locationLongitude) : undefined,
    locationRoad: ad.locationRoad || undefined,
    locationHouseNumber: ad.locationHouseNumber || undefined,
    locationCity: ad.locationCity || undefined,
    locationState: ad.locationState || undefined,
    locationCountry: ad.locationCountry || undefined,
    locationPostalCode: ad.locationPostalCode || undefined,
    locationFormatted: ad.locationFormatted || undefined,
    slug: ad.slug,
    createdAt: ad.createdAt.toISOString(),
    updatedAt: ad.updatedAt.toISOString(),
    expiresAt: ad.expiresAt?.toISOString(),
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
    attributes: ad.attributes?.map((attr: { id: string; adId: string; attributeId: string; value: string; attribute?: { id: string; name: string; type: string; options?: string[] } | null }) => ({
      id: attr.id,
      adId: attr.adId,
      attributeId: attr.attributeId,
      value: attr.value,
      attribute: attr.attribute ? {
        id: attr.attribute.id,
        name: attr.attribute.name,
        type: attr.attribute.type as 'text' | 'number' | 'boolean' | 'select',
        options: Array.isArray(attr.attribute.options) ? attr.attribute.options : undefined
      } : undefined
    })),
    rejectionReason: ad.rejectionReason || undefined,
    attachment: Array.isArray(ad.attachment) ? (ad.attachment as string[]) : undefined,
    bookingType: ad.bookingType,
    slots: ad.slots || undefined,
  };
}

// Validation schemas
const createAdSchema = Joi.object({
  title: Joi.string().required().min(1).max(255),
  description: Joi.string().required().min(1).max(2000),
  price: Joi.number().min(0).precision(2).allow(null),
  discountedPrice: Joi.number().min(0).precision(2).allow(null).optional(),
  categoryId: Joi.string().uuid().required(),
  subcategoryId: Joi.string().uuid().optional(),
  // Verbose location fields from Google Maps
  locationLatitude: Joi.number().min(-90).max(90).optional(),
  locationLongitude: Joi.number().min(-180).max(180).optional(),
  locationRoad: Joi.string().max(255).optional(),
  locationHouseNumber: Joi.string().max(50).optional(),
  locationCity: Joi.string().max(100).optional(),
  locationState: Joi.string().max(100).optional(),
  locationCountry: Joi.string().max(100).optional(),
  locationPostalCode: Joi.string().max(20).optional(),
  locationFormatted: Joi.string().max(500).optional(),
  enableBooking: Joi.boolean().default(false),
  bookingType: Joi.string().valid('SLOTS').default('SLOTS'),
  slots: Joi.array().items(
    Joi.object({
      id: Joi.string().optional(),
      date: Joi.string().isoDate().required(),
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
  ).optional()
});

const updateAdSchema = Joi.object({
  title: Joi.string().min(1).max(255),
  description: Joi.string().min(1).max(2000),
  price: Joi.number().min(0).precision(2).allow(null),
  discountedPrice: Joi.number().min(0).precision(2).allow(null),
  categoryId: Joi.string().uuid(),
  subcategoryId: Joi.string().uuid().allow(null),
  // Verbose location fields from Google Maps
  locationLatitude: Joi.number().min(-90).max(90).allow(null),
  locationLongitude: Joi.number().min(-180).max(180).allow(null),
  locationRoad: Joi.string().max(255).allow(null),
  locationHouseNumber: Joi.string().max(50).allow(null),
  locationCity: Joi.string().max(100).allow(null),
  locationState: Joi.string().max(100).allow(null),
  locationCountry: Joi.string().max(100).allow(null),
  locationPostalCode: Joi.string().max(20).allow(null),
  locationFormatted: Joi.string().max(500).allow(null),
  enableBooking: Joi.boolean(),
  bookingType: Joi.string().valid('SLOTS'),
  slots: Joi.array().items(
    Joi.object({
      id: Joi.string().optional(),
      date: Joi.string().isoDate().required(),
      startTime: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
      endTime: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
      maxBookings: Joi.number().integer().min(1).default(1)
    })
  ).optional().allow(null),
  images: Joi.array().items(Joi.string().uri()).max(10),
  attachment: Joi.array().items(Joi.string().uri()).max(5).optional().allow(null),
  attributes: Joi.array().items(
    Joi.object({
      attributeId: Joi.string().uuid().required(),
      value: Joi.string().required()
    })
  ).optional()
}).min(1);

const getAdsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'ACTIVE').optional(),
  categoryId: Joi.string().uuid().optional(),
  // Location-based proximity search
  locationLatitude: Joi.number().min(-90).max(90).optional(),
  locationLongitude: Joi.number().min(-180).max(180).optional(),
  locationRadiusKm: Joi.number().min(1).max(500).default(50), // Default 50km radius
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  sortBy: Joi.string().valid('createdAt', 'price', 'title').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().max(255).optional()
});

const expiredAdsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  expiredAfter: Joi.date().iso().optional(),
  expiredBefore: Joi.date().iso().optional()
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Ad:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         price:
 *           type: number
 *           format: decimal
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, EXPIRED]
 *         images:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *         isFeatured:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         expiresAt:
 *           type: string
 *           format: date-time
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             firstName:
 *               type: string
 *             lastName:
 *               type: string
 *             phone:
 *               type: string
 *         category:
 *           $ref: '#/components/schemas/Category'
 *         subcategory:
 *           $ref: '#/components/schemas/Subcategory'
 *         location:
 *           $ref: '#/components/schemas/Location'
 */

/**
 * @swagger
 * /api/v1/users/me/ads:
 *   post:
 *     summary: Create a new ad
 *     tags: [Ads]
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
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: 'iPhone 13 Pro Max'
 *               description:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *                 example: 'Excellent condition iPhone 13 Pro Max with original box'
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 999.99
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
 *       404:
 *         description: Category or location not found
 */
export const createAd = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }

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
    bookingType,
    slots,
    images,
    attributes
  } = value;

  if (enableBooking && (!slots || slots.length === 0)) {
    throw ApiError.validation('At least one time slot is required for booking');
  }

  // Validate no backdated slots
  if (enableBooking && slots && slots.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const slot of slots) {
      const slotDate = new Date(slot.date + 'T00:00:00');
      if (slotDate < today) {
        throw ApiError.validation(`Slot date ${slot.date} is in the past. Slot dates must be today or later.`);
      }
    }
  }

  // Verify category exists
  const category = await prisma.category.findUnique({
    where: { id: categoryId, isActive: true }
  });

  if (!category) {
    throw ApiError.categoryNotFound();
  }

  // Verify subcategory exists if provided
  let isServiceSubcategory = false;
  if (subcategoryId) {
    const subcategory = await prisma.subcategory.findUnique({
      where: { id: subcategoryId, categoryId, isActive: true }
    });

    if (!subcategory) {
      throw ApiError.subcategoryNotFound();
    }
    
    // Check if this is the "Services" subcategory within "Services & Jobs"
    if (subcategory.name === 'Services' && category.name === 'Services & Jobs') {
      isServiceSubcategory = true;
    }
  }

  // Enforce specific rules for Services subcategory
  if (isServiceSubcategory) {
    // if (price === null || price === undefined) {
    //   throw ApiError.validation('Price is required for Services');
    // }
    // if (discountedPrice === null || discountedPrice === undefined) {
    //   throw ApiError.validation('Discounted Price is required for Services');
    // }
    // Note: images are already optional in the schema (default [])
  } else {
    // For other categories, images are required (at least 1, though mobile app might require more)
    if (!images || images.length === 0) {
      // Only require images if not a job category (matching mobile logic)
      const isJobCategory = category.name.toLowerCase().includes('job');
      if (!isJobCategory) {
        throw ApiError.validation('At least one image is required');
      }
    }
  }

  // Expiration date is set only when ad is approved, not when created
  const expiresAt = null;

  // Create ad with attributes in a transaction
  const ad = await prisma.$transaction(async (tx) => {
    // Generate slug from title
    const slug = generateSlug(title);

    // Create the ad first
    const createdAd = await tx.ad.create({
      data: {
        title,
        description,
        price,
        discountedPrice,
        categoryId,
        subcategoryId,
        locationLatitude,
        locationLongitude,
        locationRoad,
        locationHouseNumber,
        locationCity,
        locationState,
        locationCountry,
        locationPostalCode,
        locationFormatted,
        userId: req.user!.id,
        enableBooking,
        images,
        bookingType,
        slots: enableBooking ? (slots || []) : null,
        slug,
        status: 'REVIEW', // Explicitly set status to REVIEW when creating new ad
        expiresAt
      }
    });

    // Create ad attributes if provided
    if (attributes && attributes.length > 0) {
      await tx.adAttribute.createMany({
        data: attributes.map((attr: { attributeId: string; value: string }) => ({
          adId: createdAd.id,
          attributeId: attr.attributeId,
          value: attr.value
        }))
      });
    }

    // Return the ad with all relations
    return await tx.ad.findUnique({
      where: { id: createdAd.id },
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
                type: true
              }
            }
          }
        }
      }
    });
  });

  // Notify admins about new ad pending review (fire and forget)
  if (ad) {
    // Queue notification for ad submission (user)
    queueAdStatusNotification(
      ad.userId,
      ad.id,
      ad.title,
      'REVIEW',
      undefined,
      ad.slug || undefined
    ).catch(err => logger.error('Failed to queue ad submission notification:', err));

    const { notifyAdminsNewAdPending } = await import('../utils/admin-notifications');
    notifyAdminsNewAdPending(
      ad.id,
      ad.title,
      `${ad.user?.firstName || ''} ${ad.user?.lastName || ''}`.trim() || ad.user?.phone || 'Unknown'
    );
  }

  const standardAd = transformAdToStandard(ad!);
  const response = createSuccessResponse(standardAd, 'Ad created successfully');
  res.status(201).json(response);
});

/**
 * @swagger
 * /api/v1/users/me/ads:
 *   get:
 *     summary: Get my ads (all statuses)
 *     tags: [Ads]
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
 *           enum: [PENDING, APPROVED, REJECTED, EXPIRED]
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
 *         description: User ads retrieved successfully
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
 */
export const getMyAds = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }

  const { error, value } = getAdsQuerySchema.validate(req.query);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { page, limit, status, categoryId, locationLatitude, locationLongitude, locationRadiusKm, minPrice, maxPrice, sortBy, sortOrder, search, startDate, endDate } = value;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Prisma.AdWhereInput = {
    userId: req.user.id
  };

  if (status) {
    if (status === 'ACTIVE') {
      // Active means: APPROVED and not expired
      where.status = 'APPROVED';
      where.OR = [
        { expiresAt: null }, // No expiry date
        { expiresAt: { gte: new Date() } } // Not expired yet
      ];
    } else {
      where.status = status;
      // Automatically filter out expired ads for APPROVED status
      if (status === 'APPROVED') {
        where.OR = [
          { expiresAt: null }, // No expiry date
          { expiresAt: { gte: new Date() } } // Not expired yet
        ];
      }
    }
  }
  if (categoryId) where.categoryId = categoryId;
  
  // Date range filtering
  if (startDate || endDate) {
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }
    where.createdAt = dateFilter;
  }

  // Location-based proximity search
  if (locationLatitude !== undefined && locationLongitude !== undefined) {
    // Using raw query for proximity search with Haversine formula
    const radius = locationRadiusKm || 50; // Default 50km radius

    // Build WHERE clauses
    const whereConditions: string[] = [];
    const paramsArray: any[] = [];
    let paramIndex = 1;

    whereConditions.push(`"userId" = $${paramIndex++}::text`);
    paramsArray.push(req.user.id);

    if (status) {
      if (status === 'ACTIVE') {
        // Active means: APPROVED and not expired
        whereConditions.push(`"status" = 'APPROVED'`);
        whereConditions.push(`("expiresAt" IS NULL OR "expiresAt" >= NOW())`);
      } else {
        whereConditions.push(`"status" = $${paramIndex++}::"AdStatus"`);
        paramsArray.push(status);
        // Also filter out expired ads for APPROVED status
        if (status === 'APPROVED') {
          whereConditions.push(`("expiresAt" IS NULL OR "expiresAt" >= NOW())`);
        }
      }
    }
    if (categoryId) {
      whereConditions.push(`"categoryId" = $${paramIndex++}::text`);
      paramsArray.push(categoryId);
    }
    if (minPrice !== undefined) {
      whereConditions.push(`("price" IS NULL OR "price" >= $${paramIndex++})`);
      paramsArray.push(minPrice);
    }
    if (maxPrice !== undefined) {
      whereConditions.push(`("price" IS NULL OR "price" <= $${paramIndex++})`);
      paramsArray.push(maxPrice);
    }
    if (startDate) {
      whereConditions.push(`"createdAt" >= $${paramIndex++}::timestamp`);
      paramsArray.push(new Date(startDate));
    }
    if (endDate) {
      whereConditions.push(`"createdAt" <= $${paramIndex++}::timestamp`);
      paramsArray.push(new Date(endDate));
    }
    if (search) {
      const searchParam = '%' + search + '%';
      whereConditions.push(`("title" ILIKE $${paramIndex++} OR "description" ILIKE $${paramIndex++})`);
      paramsArray.push(searchParam, searchParam);
    }

    const whereClause = whereConditions.join(' AND ');

    // Proximity parameters will follow the whereClause parameters
    const locationParamIndex = paramIndex;
    const limitParamIndex = paramIndex + 3;
    const skipParamIndex = paramIndex + 4;

    // Fetch ad IDs first with proximity search
    const adsResult = await prisma.$queryRawUnsafe(`
      SELECT id
      FROM "ads"
      WHERE "locationLatitude" IS NOT NULL
        AND "locationLongitude" IS NOT NULL
        AND (
          6371 * acos(
            cos(radians($${locationParamIndex})) *
            cos(radians("locationLatitude")) *
            cos(radians("locationLongitude") - radians($${locationParamIndex + 1})) +
            sin(radians($${locationParamIndex})) *
            sin(radians("locationLatitude"))
          ) <= $${locationParamIndex + 2}
        )
        AND ${whereClause}
      ORDER BY ${sortBy === 'createdAt' ? '"createdAt"' : sortBy === 'price' ? 'COALESCE("price", 0)' : '"title"'} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}
      LIMIT $${limitParamIndex} OFFSET $${skipParamIndex}
    `, ...paramsArray, locationLatitude, locationLongitude, radius, limit, skip);

    const adIds = (adsResult as any[]).map(a => a.id);

    // Get total count
    const totalCountResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM "ads"
      WHERE "locationLatitude" IS NOT NULL
        AND "locationLongitude" IS NOT NULL
        AND (
          6371 * acos(
            cos(radians($${locationParamIndex})) *
            cos(radians("locationLatitude")) *
            cos(radians("locationLongitude") - radians($${locationParamIndex + 1})) +
            sin(radians($${locationParamIndex})) *
            sin(radians("locationLatitude"))
          ) <= $${locationParamIndex + 2}
        )
        AND ${whereClause}
    `, ...paramsArray, locationLatitude, locationLongitude, radius);

    const total = Number((totalCountResult as any)[0]?.count || 0);

    // Fetch all ads with relations in a SINGLE query
    let ads: any[] = [];
    if (adIds.length > 0) {
      ads = await prisma.ad.findMany({
        where: {
          id: { in: adIds }
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
              slug: true,
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
                  options: true
                }
              }
            }
          }
        }
      });

      // Sort by the original order from proximity search
      const adOrderMap = new Map(adIds.map((id, index) => [id, index]));
      ads.sort((a, b) => (adOrderMap.get(a.id) || 0) - (adOrderMap.get(b.id) || 0));
    }

    // Transform ads to StandardAd format
    const transformedAds = ads.map(ad => transformAdToStandard(ad));

    const pagination = calculatePagination(page, limit, total);

    res.status(200).json(createPaginatedResponse(transformedAds, pagination));
    return;
  }

  // Regular query without location filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) where.price.gte = minPrice;
    if (maxPrice !== undefined) where.price.lte = maxPrice;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { category: { name: { contains: search, mode: 'insensitive' } } },
      { subcategory: { name: { contains: search, mode: 'insensitive' } } }
    ];
  }

  // Get ads with pagination
  const [adsResult, total] = await Promise.all([
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
            slug: true,
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
                options: true
              }
            }
          }
        }
      },
      skip,
      take: limit
    }),
    prisma.ad.count({ where })
  ]);

  // Sort by price treating null as 0
  if (sortBy === 'price') {
    adsResult.sort((a, b) => {
      const priceA = Number(a.price ?? 0);
      const priceB = Number(b.price ?? 0);
      return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
    });
  } else {
    // For other sort fields, use default ordering
    adsResult.sort((a, b) => {
      const valueA = a[sortBy];
      const valueB = b[sortBy];
      if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Transform ads to standard format
  const standardAds = adsResult.map(transformAdToStandard);

  const pagination = calculatePagination(page, limit, total);
  const response = createPaginatedResponse(standardAds, pagination);

  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/users/me/ads/{adId}:
 *   get:
 *     summary: Get my ad details (any status)
 *     tags: [Ads]
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
export const getMyAdDetails = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }

  const { adId } = req.params;

  // Try to find by slug first, then by ID
  let ad = await prisma.ad.findFirst({
    where: {
      slug: adId,
      userId: req.user.id
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
      },
      attributes: {
        include: {
          attribute: {
            select: {
              id: true,
              name: true,
              type: true,
              options: true
            }
          }
        }
      }
    }
  });

  // If not found by slug, try by ID
  if (!ad) {
    ad = await prisma.ad.findFirst({
      where: {
        id: adId,
        userId: req.user.id
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
        },
        attributes: {
          include: {
            attribute: {
              select: {
                id: true,
                name: true,
                type: true,
                options: true
              }
            }
          }
        }
      }
    });
  }

  if (!ad) {
    throw ApiError.adNotFound();
  }

  const standardAd = transformAdToStandard(ad);
  const response = createSuccessResponse(standardAd);
  res.status(200).json(response);
});

/**
 * Critical fields that trigger re-approval when edited on APPROVED ads
 */
const CRITICAL_FIELDS = [
  'title',
  'description',
  'images',
  'categoryId',
  'subcategoryId',
];

const SIGNIFICANT_PRICE_CHANGE_THRESHOLD = 0.5; // 50%

/**
 * Check if updates require re-approval (critical fields or significant price change)
 */
function requiresReapproval(
  currentAd: { price: Decimal | null;[key: string]: unknown },
  updates: Record<string, unknown>
): boolean {
  // Check critical fields
  const hasCriticalChanges = CRITICAL_FIELDS.some(field =>
    updates[field] !== undefined &&
    JSON.stringify(updates[field]) !== JSON.stringify(currentAd[field])
  );

  if (hasCriticalChanges) return true;

  // Check significant price change (>50%)
  if (updates.price !== undefined && currentAd.price !== null) {
    const oldPrice = Number(currentAd.price);
    const newPrice = Number(updates.price);
    if (oldPrice > 0) {
      const changeRatio = Math.abs(newPrice - oldPrice) / oldPrice;
      if (changeRatio > SIGNIFICANT_PRICE_CHANGE_THRESHOLD) {
        return true;
      }
    }
  }

  return false;
}

/**
 * @swagger
 * /api/v1/users/me/ads/{adId}:
 *   put:
 *     summary: Update my ad
 *     tags: [Ads]
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
 *                 unpublished:
 *                   type: boolean
 *                   description: True if ad was unpublished due to critical changes
 *                 hasRevision:
 *                   type: boolean
 *                   description: True if changes are pending admin review
 *                 autoApplyAt:
 *                   type: string
 *                   format: date-time
 *                   description: When pending changes will auto-apply
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
export const updateMyAd = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }

  const { error, value } = updateAdSchema.validate(req.body);
  if (error) {
    throw ApiError.validation('Validation failed', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { adId } = req.params;
  const userId = req.user.id;

  // Check if ad exists and user owns it
  const existingAd = await prisma.ad.findUnique({
    where: { id: adId }
  });

  if (!existingAd) {
    throw ApiError.adNotFound();
  }

  if (existingAd.userId !== userId) {
    throw ApiError.forbidden('Access denied');
  }

  const { categoryId, subcategoryId, locationId, attributes, enableBooking, bookingType, slots } = value;
  const nextEnableBooking = enableBooking ?? existingAd.enableBooking;
  const bookingFieldsTouched = enableBooking !== undefined || bookingType !== undefined;

  const buildBookingUpdateData = () => {
    if (!bookingFieldsTouched && !slots) {
      return {};
    }
    return {
      slots: nextEnableBooking ? (slots || existingAd.slots || []) : null,
      bookingType: 'SLOTS',
    };
  };

  if (bookingFieldsTouched && nextEnableBooking && (!slots || (Array.isArray(slots) && slots.length === 0))) {
    if (!existingAd.slots || (Array.isArray(existingAd.slots) && existingAd.slots.length === 0)) {
      throw ApiError.validation('At least one time slot is required for booking');
    }
  }

  // Validate no backdated slots
  const slotsToCheck = (slots || existingAd.slots || []) as any[];
  if (nextEnableBooking && slotsToCheck.length > 0 && slots) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const slot of slotsToCheck) {
      const slotDate = new Date(slot.date + 'T00:00:00');
      if (slotDate < today) {
        throw ApiError.validation(`Slot date ${slot.date} is in the past. Slot dates must be today or later.`);
      }
    }
  }

  // Verify category exists if being updated
  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId, isActive: true }
    });

    if (!category) {
      throw ApiError.categoryNotFound();
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
      throw ApiError.subcategoryNotFound();
    }
  }

  // Verify location exists if being updated
  if (locationId) {
    const location = await prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!location) {
      throw ApiError.locationNotFound();
    }
  }

  // Handle based on ad status
  switch (existingAd.status) {
    case 'REVIEW': {
      // Update directly, still in review
      const { attributes: _, ...updateData } = value;
      const normalizedUpdateData = {
        ...updateData,
        ...buildBookingUpdateData()
      };
      const updatedData = { ...normalizedUpdateData, updatedAt: new Date() };

      const updatedAd = await prisma.$transaction(async (tx) => {
        // Update ad
        const ad = await tx.ad.update({
          where: { id: adId },
          data: updatedData,
        });

        // Handle attributes if provided
        if (attributes !== undefined) {
          // Delete existing attributes
          await tx.adAttribute.deleteMany({
            where: { adId }
          });

          // Create new attributes if any
          if (attributes.length > 0) {
            await tx.adAttribute.createMany({
              data: attributes.map((attr: { attributeId: string; value: string }) => ({
                adId,
                attributeId: attr.attributeId,
                value: attr.value
              }))
            });
          }
        }

        // Return ad with relations
        return await tx.ad.findUnique({
          where: { id: adId },
          include: {
            user: {
              select: {
                id: true, firstName: true, lastName: true, phone: true,
                avatar: true, email: true, createdAt: true, isVerified: true
              }
            },
            category: { select: { id: true, name: true, slug: true, adPlaceholder: true } },
            subcategory: { select: { id: true, name: true, slug: true } },
            attributes: {
              include: {
                attribute: { select: { id: true, name: true, type: true, options: true } }
              }
            }
          }
        });
      });

      const standardAd = transformAdToStandard(updatedAd);
      res.status(200).json(createSuccessResponse(standardAd, 'Ad updated successfully'));
      return;
    }

    case 'UNPUBLISHED': {
      // Edit → goes back to REVIEW for admin approval
      const { attributes: _, ...updateData } = value;
      const normalizedUpdateData = {
        ...updateData,
        ...buildBookingUpdateData()
      };
      const updatedData = { ...normalizedUpdateData, updatedAt: new Date(), status: 'REVIEW' };

      const updatedAd = await prisma.$transaction(async (tx) => {
        // Update ad
        const ad = await tx.ad.update({
          where: { id: adId },
          data: updatedData,
        });

        // Handle attributes if provided
        if (attributes !== undefined) {
          // Delete existing attributes
          await tx.adAttribute.deleteMany({
            where: { adId }
          });

          // Create new attributes if any
          if (attributes.length > 0) {
            await tx.adAttribute.createMany({
              data: attributes.map((attr: { attributeId: string; value: string }) => ({
                adId,
                attributeId: attr.attributeId,
                value: attr.value
              }))
            });
          }
        }

        // Return ad with relations
        return await tx.ad.findUnique({
          where: { id: adId },
          include: {
            user: {
              select: {
                id: true, firstName: true, lastName: true, phone: true,
                avatar: true, email: true, createdAt: true, isVerified: true
              }
            },
            category: { select: { id: true, name: true, slug: true, adPlaceholder: true } },
            subcategory: { select: { id: true, name: true, slug: true } },
            attributes: {
              include: {
                attribute: { select: { id: true, name: true, type: true, options: true } }
              }
            }
          }
        });
      });

      const standardAd = transformAdToStandard(updatedAd);
      res.status(200).json(createSuccessResponse(standardAd, 'Ad updated and resubmitted for review'));
      return;
    }

    case 'REJECTED': {
      // Edit → goes back to REVIEW
      const { attributes: _, ...updateData } = value;
      const normalizedUpdateData = {
        ...updateData,
        ...buildBookingUpdateData()
      };
      const updatedData = { ...normalizedUpdateData, updatedAt: new Date(), status: 'REVIEW', rejectionReason: null };

      const updatedAd = await prisma.$transaction(async (tx) => {
        // Update ad
        const ad = await tx.ad.update({
          where: { id: adId },
          data: updatedData,
        });

        // Handle attributes if provided
        if (attributes !== undefined) {
          // Delete existing attributes
          await tx.adAttribute.deleteMany({
            where: { adId }
          });

          // Create new attributes if any
          if (attributes.length > 0) {
            await tx.adAttribute.createMany({
              data: attributes.map((attr: { attributeId: string; value: string }) => ({
                adId,
                attributeId: attr.attributeId,
                value: attr.value
              }))
            });
          }
        }

        // Return ad with relations
        return await tx.ad.findUnique({
          where: { id: adId },
          include: {
            user: {
              select: {
                id: true, firstName: true, lastName: true, phone: true,
                avatar: true, email: true, createdAt: true, isVerified: true
              }
            },
            category: { select: { id: true, name: true, slug: true, adPlaceholder: true } },
            subcategory: { select: { id: true, name: true, slug: true } },
            attributes: {
              include: {
                attribute: { select: { id: true, name: true, type: true, options: true } }
              }
            }
          }
        });
      });

      const standardAd = transformAdToStandard(updatedAd);
      res.status(200).json(createSuccessResponse(standardAd, 'Ad updated and resubmitted for review'));
      return;
    }

    case 'APPROVED': {
      // Check if changes require re-approval
      if (requiresReapproval(existingAd, value)) {
        // Critical changes: unpublish and go to REVIEW
        const { attributes: _, ...updateData } = value;
        const normalizedUpdateData = {
          ...updateData,
          ...buildBookingUpdateData()
        };
        const updatedData = { ...normalizedUpdateData, updatedAt: new Date(), status: 'REVIEW', hasRevision: false };

        const updatedAd = await prisma.$transaction(async (tx) => {
          // Update ad
          const ad = await tx.ad.update({
            where: { id: adId },
            data: updatedData,
          });

          // Handle attributes if provided
          if (attributes !== undefined) {
            // Delete existing attributes
            await tx.adAttribute.deleteMany({
              where: { adId }
            });

            // Create new attributes if any
            if (attributes.length > 0) {
              await tx.adAttribute.createMany({
                data: attributes.map((attr: { attributeId: string; value: string }) => ({
                  adId,
                  attributeId: attr.attributeId,
                  value: attr.value
                }))
              });
            }
          }

          // Return ad with relations
          return await tx.ad.findUnique({
            where: { id: adId },
            include: {
              user: {
                select: {
                  id: true, firstName: true, lastName: true, phone: true,
                  avatar: true, email: true, createdAt: true, isVerified: true
                }
              },
              category: { select: { id: true, name: true, slug: true, adPlaceholder: true } },
              subcategory: { select: { id: true, name: true, slug: true } },
              attributes: {
                include: {
                  attribute: { select: { id: true, name: true, type: true, options: true } }
                }
              }
            }
          });

          // Create moderation history entry
          await tx.moderationHistory.create({
            data: {
              adId,
              moderatorId: userId,
              action: 'USER_EDIT_CRITICAL',
              reason: 'Critical fields modified, sent for review'
            }
          });

          return ad;
        });

        const standardAd = transformAdToStandard(updatedAd);
        res.status(200).json({
          ...createSuccessResponse(standardAd, 'Ad sent for review due to significant changes'),
          unpublished: true
        });
        return;
      }

      // Safe changes: create AdRevision, keep ad visible
      const autoApplyAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await prisma.$transaction(async (tx) => {
        // Create revision
        await tx.adRevision.create({
          data: {
            adId,
            changes: value,
            createdBy: userId,
            autoApplyAt,
            status: 'REVIEW'
          }
        });

        // Update ad
        await tx.ad.update({
          where: { id: adId },
          data: {
            hasRevision: true,
            revisionCount: { increment: 1 },
            updatedAt: new Date()
          }
        });
      });

      // Get updated ad with relations
      const updatedAd = await prisma.ad.findUnique({
        where: { id: adId },
        include: {
          user: {
            select: {
              id: true, firstName: true, lastName: true, phone: true,
              avatar: true, email: true, createdAt: true, isVerified: true
            }
          },
          category: { select: { id: true, name: true, slug: true, adPlaceholder: true } },
          subcategory: { select: { id: true, name: true, slug: true } },
          attributes: {
            include: {
              attribute: { select: { id: true, name: true, type: true, options: true } }
            }
          }
        }
      });

      const standardAd = transformAdToStandard(updatedAd);
      res.status(200).json({
        ...createSuccessResponse(standardAd, 'Changes submitted for review (24h auto-apply)'),
        hasRevision: true,
        autoApplyAt
      });
      return;
    }

    case 'EXPIRED': {
      throw ApiError.validation('Expired ads cannot be edited. Please renew your ad first.');
    }

    default: {
      throw ApiError.validation('Invalid ad status');
    }
  }
});

/**
 * @swagger
 * /api/v1/users/me/ads/{adId}:
 *   delete:
 *     summary: Delete my ad
 *     tags: [Ads]
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
export const deleteMyAd = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }

  const { adId } = req.params;

  // Check if ad exists and user owns it
  const ad = await prisma.ad.findUnique({
    where: { id: adId }
  });

  if (!ad) {
    throw ApiError.adNotFound();
  }

  if (ad.userId !== req.user.id) {
    throw ApiError.forbidden('Access denied');
  }

  // Some related tables use RESTRICT foreign keys (subscriptions/bookings/wishlists),
  // so clean them first inside a transaction before deleting the ad.
  await prisma.$transaction(async (tx) => {
    await tx.wishlist.deleteMany({
      where: { adId }
    });

    await tx.booking.deleteMany({
      where: { adId }
    });

    await tx.subscription.deleteMany({
      where: { adId }
    });

    await tx.ad.delete({
      where: { id: adId }
    });
  });

  const response = createSuccessResponse(null, 'Ad deleted successfully');
  res.status(200).json(response);
});

export const getAdBookings = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { adId } = req.params;
  const userId = req.user!.id;

  // Verify ad belongs to user
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
    select: { userId: true }
  });

  if (!ad || ad.userId !== userId) {
    throw new ApiError(403, ErrorCode.FORBIDDEN, 'You can only view bookings for your own ads');
  }

  // Get bookings for this ad
  const bookings = await prisma.booking.findMany({
    where: { adId },
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
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  const response = createSuccessResponse(bookings);
  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/admin/ads/expired:
 *   get:
 *     summary: Get expired ads
 *     tags: [Admin - Ads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: expiredAfter
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter ads expired after this date
 *       - in: query
 *         name: expiredBefore
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter ads expired before this date
 *     responses:
 *       200:
 *         description: Expired ads retrieved successfully
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
export const getExpiredAds = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { error, value } = expiredAdsQuerySchema.validate(req.query);
  if (error) {
    throw ApiError.validation('Invalid query parameters', error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    })));
  }

  const { page, limit, expiredAfter, expiredBefore } = value;
  const skip = (page - 1) * limit;
  const now = new Date();

  // Build where clause for expired ads
  const whereClause: Prisma.AdWhereInput = {
    expiresAt: {
      lt: now
    }
  };

  // Add date range filters if provided
  if (expiredAfter || expiredBefore) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (expiredAfter) dateFilter.gte = new Date(expiredAfter);
    if (expiredBefore) dateFilter.lte = new Date(expiredBefore);
    whereClause.expiresAt = dateFilter;
  }

  // Get expired ads with pagination
  const [ads, total] = await Promise.all([
    prisma.ad.findMany({
      where: whereClause,
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
                options: true
              }
            }
          }
        }
      },
      orderBy: {
        expiresAt: 'desc'
      },
      skip,
      take: limit
    }),
    prisma.ad.count({
      where: whereClause
    })
  ]);

  // Transform ads to standard format
  const standardAds = ads.map(transformAdToStandard);

  const pagination = calculatePagination(page, limit, total);
  const response = createPaginatedResponse(standardAds, pagination);

  res.status(200).json(response);
});

/**
 * Get ad stats (views, favorites, shares, bookings)
 */
export const getAdStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }

  const { adId } = req.params;

  const ad = await prisma.ad.findFirst({
    where: { id: adId, userId: req.user.id },
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

/**
 * Record ad view
 */
export const recordAdView = asyncHandler(async (req: Request, res: Response) => {
  const { adId } = req.params;

  await prisma.ad.update({
    where: { id: adId },
    data: { views: { increment: 1 } }
  });

  const response = createSuccessResponse(null, 'View recorded');
  res.status(200).json(response);
});

/**
 * Record ad share
 */
export const recordAdShare = asyncHandler(async (req: Request, res: Response) => {
  const { adId } = req.params;

  await prisma.ad.update({
    where: { id: adId },
    data: { shares: { increment: 1 } }
  });

  const response = createSuccessResponse(null, 'Share recorded');
  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/users/me/ads/{adId}/unpublish:
 *   post:
 *     summary: Unpublish an approved ad
 *     tags: [Ads]
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
 *         description: Ad unpublished successfully
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
 *                   example: 'Ad unpublished successfully'
 *                 data:
 *                   $ref: '#/components/schemas/Ad'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       400:
 *         description: Only approved ads can be unpublished
 */
export const unpublishAd = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }

  const { adId } = req.params;
  const userId = req.user.id;

  // Check if ad exists and user owns it
  const ad = await prisma.ad.findUnique({
    where: { id: adId }
  });

  if (!ad) {
    throw ApiError.adNotFound();
  }

  if (ad.userId !== userId) {
    throw ApiError.forbidden('Access denied');
  }

  // Only approved ads can be unpublished
  if (ad.status !== 'APPROVED') {
    throw ApiError.validation('Only approved ads can be unpublished');
  }

  // Update ad status to UNPUBLISHED
  const updatedAd = await prisma.ad.update({
    where: { id: adId },
    data: {
      status: 'UNPUBLISHED',
      updatedAt: new Date()
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
      category: { select: { id: true, name: true, slug: true, adPlaceholder: true } },
      subcategory: { select: { id: true, name: true, slug: true } },
      attributes: {
        include: {
          attribute: { select: { id: true, name: true, type: true, options: true } }
        }
      }
    }
  });

  const standardAd = transformAdToStandard(updatedAd);
  const response = createSuccessResponse(standardAd, 'Ad unpublished successfully');
  res.status(200).json(response);
});

/**
 * @swagger
 * /api/v1/users/me/ads/{adId}/republish:
 *   post:
 *     summary: Republish an unpublished ad
 *     tags: [Ads]
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
 *         description: Ad republished successfully
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
 *                   example: 'Ad republished successfully'
 *                 data:
 *                   $ref: '#/components/schemas/Ad'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       400:
 *         description: Only unpublished ads can be republished
 */
export const republishAd = asyncHandler(async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }

  const { adId } = req.params;
  const userId = req.user.id;

  // Check if ad exists and user owns it
  const ad = await prisma.ad.findUnique({
    where: { id: adId }
  });

  if (!ad) {
    throw ApiError.adNotFound();
  }

  if (ad.userId !== userId) {
    throw ApiError.forbidden('Access denied');
  }

  // Only unpublished ads can be republished
  if (ad.status !== 'UNPUBLISHED') {
    throw ApiError.validation('Only unpublished ads can be republished');
  }

  // Check if ad has expired
  if (ad.expiresAt && new Date(ad.expiresAt) < new Date()) {
    throw ApiError.validation('Ad has expired. Please renew your subscription first.');
  }

  // Update ad status back to APPROVED
  const updatedAd = await prisma.ad.update({
    where: { id: adId },
    data: {
      status: 'APPROVED',
      updatedAt: new Date()
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
      category: { select: { id: true, name: true, slug: true, adPlaceholder: true } },
      subcategory: { select: { id: true, name: true, slug: true } },
      attributes: {
        include: {
          attribute: { select: { id: true, name: true, type: true, options: true } }
        }
      }
    }
  });

  const standardAd = transformAdToStandard(updatedAd);
  const response = createSuccessResponse(standardAd, 'Ad republished successfully');
  res.status(200).json(response);
});