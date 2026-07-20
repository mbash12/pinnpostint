import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import Joi from 'joi';
import {
  createPaginatedResponse,
  calculatePagination,
  StandardAd,
  AdStatus
} from '../types/api-responses';
import {
  transformCategory,
  transformSubcategory,
  transformLocation,
  transformAttribute
} from '../types/standardized-models';
import config from '../config/environment';
import { sendNotificationToUser } from '../utils/notifications';

// Helper function to transform Prisma ad data to StandardAd format
function transformAdToStandard(ad: any): StandardAd {
  const bookingRange = ad.bookingType === 'DEFAULT' && ad.slots && typeof ad.slots === 'object' && !Array.isArray(ad.slots)
    ? ad.slots
    : undefined;

  return {
    id: ad.id,
    title: ad.title,
    description: ad.description,
    price: ad.price ? Number(ad.price) : null,
    discountedPrice: ad.discountedPrice ? Number(ad.discountedPrice) : null,
    status: ad.status as AdStatus,
    images: Array.isArray(ad.images) ? ad.images : [],
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
    slug: ad.slug || undefined,
    createdAt: ad.createdAt.toISOString(),
    updatedAt: ad.updatedAt.toISOString(),
    expiresAt: ad.expiresAt?.toISOString(),
    rejectionReason: ad.rejectionReason || undefined,
    isFlagged: ad.isFlagged || false,
    flagReason: ad.flagReason || undefined,
    attachment: Array.isArray(ad.attachment) ? (ad.attachment as string[]) : undefined,
    bookingType: ad.bookingType,
    slots: ad.slots || undefined,
    bookingStartDate: bookingRange?.bookingStartDate || undefined,
    bookingEndDate: bookingRange?.bookingEndDate || undefined,
    user: ad.user ? {
      id: ad.user.id,
      firstName: ad.user.firstName,
      lastName: ad.user.lastName || undefined,
      phone: ad.user.phone,
      email: ad.user.email || undefined,
      avatar: ad.user.avatar || undefined,
      createdAt: ad.user.createdAt?.toISOString(),
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
        type: attr.attribute.type,
        options: Array.isArray(attr.attribute.options) ? attr.attribute.options : undefined
      } : undefined
    }))
  };
}

export const getHeroSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const heroKeys = ['hero_title', 'hero_subtitle', 'hero_image'];
    const settings = await prisma.setting.findMany({
      where: { key: { in: heroKeys } }
    });

    const hero: any = {
      title: 'Find Everything You Need',
      subtitle: 'Discover amazing deals on products and services near you',
      image: 'https://placehold.co/1920x500/CC1614/FFFFFF?text=Hero+Banner'
    };

    settings.forEach(setting => {
      const key = setting.key.replace('hero_', '');
      hero[key] = setting.value;
    });

    res.status(200).json({
      success: true,
      data: hero
    });
  } catch (error) {
    next(error);
  }
};

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    phone: string;
  };
}

// Validation schemas
const getPublicAdsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  categoryId: Joi.string().uuid().optional(),
  subcategoryId: Joi.string().uuid().optional(),
  // Location-based proximity search
  locationLatitude: Joi.number().min(-90).max(90).optional(),
  locationLongitude: Joi.number().min(-180).max(180).optional(),
  locationRadiusKm: Joi.number().min(1).max(500).default(50), // Default 50km radius
  search: Joi.string().max(255).optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  sortBy: Joi.string().valid('createdAt', 'price', 'title').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const getLocationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(255).optional(),
  country: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  city: Joi.string().max(100).optional()
});

/**
 * @swagger
 * /api/v1/public/categories:
 *   get:
 *     summary: Get all active categories with subcategories
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
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
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       slug:
 *                         type: string
 *                       description:
 *                         type: string
 *                       icon:
 *                         type: string
 *                       subcategories:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               format: uuid
 *                             name:
 *                               type: string
 *                             slug:
 *                               type: string
 *                             description:
 *                               type: string
 */
export const getPublicCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        adPlaceholder: true,
        isActive: true,
        isFeatured: true,
        order: true,
        createdAt: true,
        updatedAt: true,
        subcategories: {
          where: {
            isActive: true
          },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            image: true,
            categoryId: true,
            supportsBooking: true,
            isActive: true,
            order: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: {
            order: 'asc'
          }
        }
      },
      orderBy: {
        order: 'asc'
      }
    });

    // Transform categories and update image URLs to include the API base URL
    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;

    const transformedCategories = categories.map(category => {
      const transformedCategory = transformCategory(category);

      // Update category image URL if it's a relative path
      if (transformedCategory.image && (transformedCategory.image.startsWith('/uploads/') || transformedCategory.image.startsWith('/public/'))) {
        transformedCategory.image = `${baseUrl}${transformedCategory.image}`;
      }

      // Update subcategory image URLs if they are relative paths
      if (transformedCategory.subcategories) {
        transformedCategory.subcategories = transformedCategory.subcategories.map(subcategory => {
          if (subcategory.image && (subcategory.image.startsWith('/uploads/') || subcategory.image.startsWith('/public/'))) {
            subcategory.image = `${baseUrl}${subcategory.image}`;
          }
          return subcategory;
        });
      }

      return transformedCategory;
    });

    res.status(200).json({
      success: true,
      data: transformedCategories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/settings:
 *   get:
 *     summary: Get public system settings
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Public settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     siteName:
 *                       type: string
 *                     siteDescription:
 *                       type: string
 *                     contactEmail:
 *                       type: string
 *                     customerCareEmail:
 *                       type: string
 *                     contactPhone:
 *                       type: string
 *                     socialLinks:
 *                       type: object
 *                     maintenanceMode:
 *                       type: boolean
 *                     allowRegistration:
 *                       type: boolean
 *       500:
 *         description: Internal server error
 */
export const getPublicSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Define which settings are safe to expose publicly
    const publicSettingKeys = [
      'siteName',
      'siteDescription',
      'contactEmail',
      'customerCareEmail',
      'contactPhone',
      'socialLinks',
      'maintenanceMode',
      'allowRegistration',
      'termsOfService',
      'privacyPolicy',
      'supportHours',
      'currency',
      'timezone'
    ];

    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: publicSettingKeys
        }
      },
      select: {
        key: true,
        value: true
      }
    });

    // Transform array to object for easier consumption
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    res.status(200).json({
      success: true,
      data: settingsObject
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/system-settings:
 *   get:
 *     summary: Get public system settings
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Public system settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookingPrice:
 *                       type: number
 *                       description: Price for booking feature
 *                     reminderExpirationDays:
 *                       type: number
 *                       description: Number of days before reminder to extend subscription
 *                     subscriptionPrice:
 *                       type: number
 *                       description: Price for subscription
 *                     subscriptionDuration:
 *                       type: number
 *                       description: Duration of subscription in days
 *                     freeAdDuration:
 *                       type: number
 *                       description: Number of days ads are free
 *       500:
 *         description: Internal server error
 */
export const getPublicSystemSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Define which system settings are safe to expose publicly
    const publicSystemSettingKeys = [
      'booking_price',
      'reminder_expiration_days',
      'auto_refund_days',
      'auto_complete_booking_days',
      'auto_cancel_booking_days',
      'subscription_price',
      'subscription_duration',
      'free_ad_duration',
      'service_fee_fixed',
      'customer_care_email',
      'terms_of_service',
      'privacy_policy',
      'site_name'
    ];

    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: publicSystemSettingKeys
        }
      },
      select: {
        key: true,
        value: true
      }
    });

    // Transform array to object and convert snake_case to camelCase
    const settingsObject: any = {};

    settings.forEach(setting => {
      // Convert snake_case key to camelCase
      const camelCaseKey = setting.key
        .replace(/_([a-z])/g, (g) => g[1].toUpperCase());

      settingsObject[camelCaseKey] = setting.value;
    });

    // Ensure all expected keys exist with default values if not found
    const defaults = {
      bookingPrice: 0,
      reminderExpirationDays: [7, 3, 1],
      subscriptionPrice: 0,
      subscriptionDuration: 0,
      freeAdDuration: 7,
      serviceFeeFixed: 0,
      customerCareEmail: 'info@pinnpost.com',
      termsOfService: '',
      privacyPolicy: '',
      siteName: 'PinNPost'
    };

    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (settingsObject[key] === undefined) {
        settingsObject[key] = defaultValue;
      }
    }

    // Include Razorpay Key ID from environment configuration
    // This ensures client uses the same key that created the order
    settingsObject.razorpayKeyId = config.razorpay.keyId;

    res.status(200).json({
      success: true,
      data: settingsObject
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/locations:
 *   get:
 *     summary: Get available locations
 *     tags: [Public]
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
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 255
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *           maxLength: 100
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *           maxLength: 100
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *           maxLength: 100
 *     responses:
 *       200:
 *         description: Locations retrieved successfully
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
 *                     $ref: '#/components/schemas/Location'
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
 */
export const getPublicLocations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = getLocationsQuerySchema.validate(req.query);
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

    const { page, limit, search, country, state, city } = value;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { city: { is: { name: { contains: search, mode: 'insensitive' as const } } } },
        { state: { is: { name: { contains: search, mode: 'insensitive' as const } } } },
        { country: { contains: search, mode: 'insensitive' as const } }
      ];
    }

    if (country) where.country = { contains: country, mode: 'insensitive' as const };
    if (state) where.state = { is: { name: { contains: state, mode: 'insensitive' as const } } };
    if (city) where.city = { is: { name: { contains: city, mode: 'insensitive' as const } } };

    // Always filter out inactive locations for public API
    where.isActive = true;

    // Get locations with pagination
    const [locations, total] = await Promise.all([
      prisma.location.findMany({
        where,
        include: {
          state: true,  // Include related state to access its name
          city: true    // Include related city to access its name
        },
        orderBy: [
          { country: 'asc' },
          { state: { name: 'asc' } },
          { city: { name: 'asc' } },
          { name: 'asc' }
        ],
        skip,
        take: limit
      }),
      prisma.location.count({
        where,
        // Note: For count, we don't need to include relations
      })
    ]);

    const pages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: locations.map(transformLocation),
      pagination: {
        page,
        limit,
        total,
        totalPages: pages,
        hasNextPage: page < pages,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/categories/{categoryId}/subcategories:
 *   get:
 *     summary: Get subcategories for a specific category
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Subcategories retrieved successfully
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
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       slug:
 *                         type: string
 *                       description:
 *                         type: string
 *                       image:
 *                         type: string
 *                       categoryId:
 *                         type: string
 *                         format: uuid
 *                       isActive:
 *                         type: boolean
 *                       order:
 *                         type: integer
 *                       adCount:
 *                         type: integer
 *       404:
 *         description: Category not found
 */
export const getCategorySubcategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { categoryId } = req.params;

    // Check if category exists and is active
    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
        isActive: true
      }
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

    // Get subcategories for the category
    const subcategories = await prisma.subcategory.findMany({
      where: {
        categoryId: categoryId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        categoryId: true,
        supportsBooking: true,
        isActive: true,
        order: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        order: 'asc'
      }
    });

    // Transform subcategories and update image URLs to include the API base URL
    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;

    const transformedSubcategories = subcategories.map(subcategory => {
      const transformedSubcategory = transformSubcategory(subcategory);

      // Update subcategory image URL if it's a relative path
      if (transformedSubcategory.image && (transformedSubcategory.image.startsWith('/uploads/') || transformedSubcategory.image.startsWith('/public/'))) {
        transformedSubcategory.image = `${baseUrl}${transformedSubcategory.image}`;
      }

      return transformedSubcategory;
    });

    res.status(200).json({
      success: true,
      data: transformedSubcategories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/categories/{categoryId}/attributes:
 *   get:
 *     summary: Get attributes for a category
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Category attributes retrieved successfully
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
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [TEXT, NUMBER, SELECT, MULTISELECT, BOOLEAN, DATE]
 *                       options:
 *                         type: array
 *                         items:
 *                           type: string
 *                       isRequired:
 *                         type: boolean
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
export const getCategoryAttributes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { categoryId } = req.params;

    // Check if category exists and is active
    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
        isActive: true
      }
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

    // Get attributes for all subcategories of the category
    const attributes = await prisma.attribute.findMany({
      where: {
        subcategory: {
          categoryId: categoryId
        }
      },
      select: {
        id: true,
        name: true,
        type: true,
        options: true,
        isRequired: true,
        subcategory: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      data: attributes.map(transformAttribute)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get attributes for a specific subcategory
 */
export const getSubcategoryAttributes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subcategoryId } = req.params;

    const subcategory = await prisma.subcategory.findUnique({
      where: {
        id: subcategoryId,
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

    const attributes = await prisma.attribute.findMany({
      where: {
        subcategoryId: subcategoryId
      },
      orderBy: {
        order: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      data: attributes.map(transformAttribute)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/ads:
 *   get:
 *     summary: List, search, and filter public ads (only APPROVED status)
 *     tags: [Public]
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
 *           maximum: 50
 *           default: 10
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: subcategoryId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 255
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *           minimum: 0
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *           minimum: 0
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, price, title]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Public ads retrieved successfully
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
 */
export const getPublicAds = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = getPublicAdsQuerySchema.validate(req.query);
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

    const {
      page,
      limit,
      categoryId,
      subcategoryId,
      locationLatitude,
      locationLongitude,
      locationRadiusKm,
      search,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder
    } = value;

    const skip = (page - 1) * limit;

    // Get user ID from auth if available
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    // If location coordinates are provided, use proximity search
    if (locationLatitude !== undefined && locationLongitude !== undefined) {
      const radius = locationRadiusKm || 50; // Default 50km radius

      // Build WHERE clauses
      const whereConditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Status parameter - cast text to AdStatus enum
      whereConditions.push('"status" = ANY(ARRAY[$1::"AdStatus", $2::"AdStatus"])');
      params.push('APPROVED', 'EXPIRED');
      paramIndex = 3;

      whereConditions.push('"locationLatitude" IS NOT NULL');
      whereConditions.push('"locationLongitude" IS NOT NULL');
      whereConditions.push('"isFlagged" = false');

      if (categoryId) {
        whereConditions.push(`"categoryId" = $${paramIndex++}::text`);
        params.push(categoryId);
      }
      if (subcategoryId) {
        whereConditions.push(`"subcategoryId" = $${paramIndex++}::text`);
        params.push(subcategoryId);
      }
      if (minPrice !== undefined) {
        whereConditions.push(`("price" IS NULL OR "price" >= $${paramIndex++})`);
        params.push(minPrice);
      }
      if (maxPrice !== undefined) {
        whereConditions.push(`("price" IS NULL OR "price" <= $${paramIndex++})`);
        params.push(maxPrice);
      }
      if (search) {
        const searchParam = '%' + search + '%';
        whereConditions.push(`("title" ILIKE $${paramIndex++} OR "description" ILIKE $${paramIndex++})`);
        params.push(searchParam, searchParam);
      }

      const whereClause = whereConditions.join(' AND ');

      // Note: location params come after the WHERE params
      const locationParamIndex = paramIndex;
      const limitParamIndex = paramIndex + 3;
      const skipParamIndex = paramIndex + 4;

      // Fetch ad IDs first with proximity search
      const adsResult = await prisma.$queryRawUnsafe(`
        SELECT id
        FROM "ads"
        WHERE ${whereClause}
          AND (
            6371 * acos(
              cos(radians($${locationParamIndex})) *
              cos(radians("locationLatitude")) *
              cos(radians("locationLongitude") - radians($${locationParamIndex + 1})) +
              sin(radians($${locationParamIndex})) *
              sin(radians("locationLatitude"))
            ) <= $${locationParamIndex + 2}
          )
        ORDER BY ${sortBy === 'createdAt' ? '"createdAt"' : sortBy === 'price' ? '"price"' : '"title"'} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}${sortBy === 'price' ? ' NULLS LAST' : ''}
        LIMIT $${limitParamIndex} OFFSET $${skipParamIndex}
      `, ...params, locationLatitude, locationLongitude, radius, limit, skip);

      const adIds = (adsResult as any[]).map(a => a.id);

      // Get total count
      const totalCountResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count
        FROM "ads"
        WHERE ${whereClause}
          AND (
            6371 * acos(
              cos(radians($${locationParamIndex})) *
              cos(radians("locationLatitude")) *
              cos(radians("locationLongitude") - radians($${locationParamIndex + 1})) +
              sin(radians($${locationParamIndex})) *
              sin(radians("locationLatitude"))
            ) <= $${locationParamIndex + 2}
          )
      `, ...params, locationLatitude, locationLongitude, radius);

      const total = Number((totalCountResult as any)[0]?.count || 0);

      // Fetch all ads with relations in a SINGLE query
      let ads: any[] = [];
      if (adIds.length > 0) {
        const findManyArgs: any = {
          where: {
            id: { in: adIds }
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
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
            }
          }
        };

        if (userId) {
          findManyArgs.include.wishlistItems = {
            where: { userId },
            select: { id: true }
          };
        }

        ads = await prisma.ad.findMany(findManyArgs);

        // Sort by the original order from proximity search
        const adOrderMap = new Map(adIds.map((id, index) => [id, index]));
        ads.sort((a, b) => (adOrderMap.get(a.id) || 0) - (adOrderMap.get(b.id) || 0));
      }

      // Transform ads
      const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;

      const transformedAds = ads.map(ad => {
        const transformedAd = transformAdToStandard(ad);

        // Update image URLs
        let updatedAd = { ...transformedAd };
        if (updatedAd.images && Array.isArray(updatedAd.images)) {
          updatedAd.images = updatedAd.images.map((img: any) => {
            if (typeof img === 'string' && (img.startsWith('/uploads/') || img.startsWith('/public/'))) {
              return `${baseUrl}${img}`;
            }
            return img;
          });
        }

        return {
          ...updatedAd,
          isFavorite: userId ? ((ad as any).wishlistItems?.length || 0) > 0 : false
        };
      });

      const pagination = calculatePagination(page, limit, total);
      const response = createPaginatedResponse(transformedAds, pagination);

      res.status(200).json(response);
      return;
    }

    // Regular query without location filter
    const where: any = {
      status: {
        in: ['APPROVED', 'EXPIRED']
      }
    };

    if (categoryId) where.categoryId = categoryId;
    if (subcategoryId) where.subcategoryId = subcategoryId;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { name: { contains: search, mode: 'insensitive' } } },
        { subcategory: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    // Build orderBy clause
    const orderBy: any = {};
    if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    } else if (sortBy === 'price') {
      orderBy.price = sortOrder;
    } else if (sortBy === 'title') {
      orderBy.title = sortOrder;
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
              // Don't expose phone/email in public API
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
          wishlistItems: userId ? {
            where: { userId },
            select: { id: true }
          } : false
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.ad.count({ where })
    ]);

    // Add isFavorite flag to each ad and update image URLs
    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;

    let adsWithFavorite = ads.map((ad: any) => {
      const transformedAd = transformAdToStandard(ad);

      // Update image URLs if they are relative paths
      let updatedAd = { ...transformedAd };
      if (updatedAd.images && Array.isArray(updatedAd.images)) {
        updatedAd.images = updatedAd.images.map((img: any) => {
          if (typeof img === 'string' && (img.startsWith('/uploads/') || img.startsWith('/public/'))) {
            return `${baseUrl}${img}`;
          }
          return img;
        });
      }

      return {
        ...updatedAd,
        isFavorite: userId ? ((ad as any).wishlistItems?.length || 0) > 0 : false
      };
    });

    const pagination = calculatePagination(page, limit, total);
    const response = createPaginatedResponse(adsWithFavorite, pagination);

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/ads/{adId}:
 *   get:
 *     summary: Get public ad details (only APPROVED ads)
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: adId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Public ad details retrieved successfully
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
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
export const getPublicAdDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adId, slug } = req.params;

    // Get user ID from auth if available
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    // Try to find approved or expired ad first (public view)
    let whereClause: any = slug
      ? { slug: slug, status: { in: ['APPROVED', 'EXPIRED'] } }
      : { id: adId, status: { in: ['APPROVED', 'EXPIRED'] } };

    // Build user select based on authentication
    const userSelect: any = {
      id: true,
      firstName: true,
      lastName: true,
      avatar: true,
      createdAt: true, // Include for "Member since" display
    };

    // Include phone and email only for authenticated users (for contact functionality)
    if (userId) {
      userSelect.phone = true;
      userSelect.email = true;
    }

    let ad: any = await prisma.ad.findFirst({
      where: whereClause,
      include: {
        user: {
          select: userSelect
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            adPlaceholder: true
          }
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true
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
        },
        wishlistItems: userId ? {
          where: { userId },
          select: { id: true }
        } : false
      }
    });

    // If not found and user is authenticated, try to find user's own ad
    if (!ad && userId) {
      // Build user select with phone/email for authenticated users
      const userSelectWithContact: any = {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        phone: true,
        email: true,
        createdAt: true, // Include for "Member since" display
      };

      ad = await prisma.ad.findFirst({
        where: slug
          ? { slug: slug, userId: userId }
          : { id: adId, userId: userId },
        include: {
          user: {
            select: userSelectWithContact
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              adPlaceholder: true
            }
          },
          subcategory: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true
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
          },
          wishlistItems: {
            where: { userId },
            select: { id: true }
          }
        }
      });
    }

    if (!ad) {
      res.status(404).json({
        success: false,
        error: {
          code: 'AD_NOT_FOUND',
          message: 'Ad not found or not available'
        }
      });
      return;
    }

    // Add isFavorite flag and update image URLs
    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;

    let updatedAd = { ...ad };
    if (updatedAd.images && Array.isArray(updatedAd.images)) {
      updatedAd.images = updatedAd.images.map((img: any) => {
        if (typeof img === 'string' && (img.startsWith('/uploads/') || img.startsWith('/public/'))) {
          return `${baseUrl}${img}`;
        }
        return img;
      });
    }

    // Enrich slots with current booking counts
    if (updatedAd.slots && Array.isArray(updatedAd.slots) && updatedAd.slots.length > 0) {
      const enrichedSlots = await Promise.all(
        updatedAd.slots.map(async (slot: any) => {
          const bookedCount = await prisma.booking.count({
            where: {
              adId: updatedAd.id,
              slotId: slot.id,
              status: { not: 'CANCELLED' }
            }
          });
          return { ...slot, bookedCount };
        })
      );
      updatedAd.slots = enrichedSlots;
    }

    const adWithFavorite = {
      ...updatedAd,
      isFavorite: userId ? ((updatedAd as any).wishlistItems?.length || 0) > 0 : false,
      wishlistItems: undefined
    };

    res.status(200).json({
      success: true,
      data: adWithFavorite
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/ads/featured:
 *   get:
 *     summary: Get featured ads
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 10
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Featured ads retrieved successfully
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
 */
export const getFeaturedAds = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
    const categoryId = req.query.categoryId as string;

    // Get user ID from auth if available
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    // Build where clause
    const where: any = {
      status: {
        in: ['APPROVED', 'EXPIRED']
      },
      isFeatured: true
    };

    if (categoryId) where.categoryId = categoryId;

    const featuredAds = await prisma.ad.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
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
        wishlistItems: userId ? {
          where: { userId },
          select: { id: true }
        } : false
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // Add isFavorite flag to each ad and update image URLs
    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;

    const adsWithFavorite = featuredAds.map(ad => {
      // Update image URLs if they are relative paths
      let updatedAd = { ...ad };
      if (updatedAd.images && Array.isArray(updatedAd.images)) {
        updatedAd.images = updatedAd.images.map(img => {
          if (typeof img === 'string' && (img.startsWith('/uploads/') || img.startsWith('/public/'))) {
            return `${baseUrl}${img}`;
          }
          return img;
        });
      }

      return {
        ...updatedAd,
        isFavorite: userId ? ((updatedAd as any).wishlistItems?.length || 0) > 0 : false,
        wishlistItems: undefined
      };
    });

    res.status(200).json({
      success: true,
      data: adsWithFavorite
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/ads/recommended:
 *   get:
 *     summary: Get recommended ads (sorted by relevance)
 *     description: Returns recommended ads with sorting options. For authenticated users, personalized recommendations are calculated but results are sorted, not filtered.
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 10
 *         description: Maximum number of ads to return
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, price, title, relevance]
 *           default: relevance
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Recommended ads retrieved successfully
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
 */
export const getRecommendedAds = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
    const sortBy = (req.query.sortBy as string) || 'relevance';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    // Validate sortBy
    const validSortBy = ['createdAt', 'price', 'title', 'relevance'];
    const validSortOrder = ['asc', 'desc'];

    if (!validSortBy.includes(sortBy) || !validSortOrder.includes(sortOrder)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid sortBy or sortOrder parameter'
        }
      });
      return;
    }

    // For all users, return approved or expired ads (no category filtering)
    const where: any = {
      status: {
        in: ['APPROVED', 'EXPIRED']
      }
    };

    // If user is authenticated, exclude their own ads only
    if (req.user) {
      where.userId = {
        not: req.user.id
      };
    }

    // Build sorting logic
    let orderBy: any;

    if (sortBy === 'relevance') {
      // Default relevance: most recent first
      orderBy = { createdAt: 'desc' };
    } else {
      // Explicit sorting by user-specified field
      if (sortBy === 'createdAt') {
        orderBy = { createdAt: sortOrder };
      } else if (sortBy === 'price') {
        orderBy = { price: sortOrder };
      } else if (sortBy === 'title') {
        orderBy = { title: sortOrder };
      }
    }

    const recommendedAds = await prisma.ad.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
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
        wishlistItems: req.user ? {
          where: { userId: req.user.id },
          select: { id: true }
        } : false
      },
      orderBy,
      take: limit
    });

    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;

    // Update image URLs for recommended ads
    const updatedRecommendedAds = recommendedAds.map(ad => {
      let updatedAd = { ...ad };
      if (updatedAd.images && Array.isArray(updatedAd.images)) {
        updatedAd.images = updatedAd.images.map(img => {
          if (typeof img === 'string' && (img.startsWith('/uploads/') || img.startsWith('/public/'))) {
            return `${baseUrl}${img}`;
          }
          return img;
        });
      }
      return {
        ...updatedAd,
        isFavorite: req.user ? ((ad as any).wishlistItems?.length || 0) > 0 : false,
        wishlistItems: undefined
      };
    });

    res.status(200).json({
      success: true,
      data: updatedRecommendedAds
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/categories/featured:
 *   get:
 *     summary: Get featured categories
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 8
 *     responses:
 *       200:
 *         description: Featured categories retrieved successfully
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
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       slug:
 *                         type: string
 *                       description:
 *                         type: string
 *                       icon:
 *                         type: string
 *                       adCount:
 *                         type: integer
 */
export const getFeaturedCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 8, 20);

    // Get featured categories using the isFeatured field
    const featuredCategories = await prisma.category.findMany({
      where: {
        isActive: true,
        isFeatured: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        adPlaceholder: true,
        isFeatured: true,
        order: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        order: 'asc'
      },
      take: limit
    });

    // Transform categories and update image URLs to include the API base URL
    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;

    const transformedCategories = featuredCategories.map(category => {
      const transformedCategory = transformCategory(category);

      // Update category image URL if it's a relative path
      if (transformedCategory.image && (transformedCategory.image.startsWith('/uploads/') || transformedCategory.image.startsWith('/public/'))) {
        transformedCategory.image = `${baseUrl}${transformedCategory.image}`;
      }

      return transformedCategory;
    });

    res.status(200).json({
      success: true,
      data: transformedCategories
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        createdAt: true
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      });
      return;
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const getPublicUserAds = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 50);
    const skip = (pageNum - 1) * limitNum;

    const [ads, total] = await Promise.all([
      prisma.ad.findMany({
        where: { 
          userId, 
          status: { in: ['APPROVED', 'EXPIRED'] }
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true, avatar: true } },
          category: { select: { id: true, name: true, slug: true, adPlaceholder: true } },
          subcategory: { select: { id: true, name: true, slug: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.ad.count({ 
        where: { 
          userId, 
          status: { in: ['APPROVED', 'EXPIRED'] }
        } 
      })
    ]);

    // Update image URLs for user ads
    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;

    const updatedAds = ads.map(ad => {
      let updatedAd = { ...ad };
      if (updatedAd.images && Array.isArray(updatedAd.images)) {
        updatedAd.images = updatedAd.images.map(img => {
          if (typeof img === 'string' && (img.startsWith('/uploads/') || img.startsWith('/public/'))) {
            return `${baseUrl}${img}`;
          }
          return img;
        });
      }
      return updatedAd;
    });

    res.status(200).json(createPaginatedResponse(updatedAds, calculatePagination(total, pageNum, limitNum)));
  } catch (error) {
    next(error);
  }
};

// ========== LOCATION DATA ENDPOINTS ==========

/**
 * @swagger
 * /api/v1/public/states:
 *   get:
 *     summary: Get all active states
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Search term for state name
 *     responses:
 *       200:
 *         description: States retrieved successfully
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
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       code:
 *                         type: string
 *                       country:
 *                         type: string
 */
export const getPublicStates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search } = req.query;

    const where: any = {
      isActive: true
    };

    if (search) {
      where.name = {
        contains: search as string,
        mode: 'insensitive'
      };
    }

    const states = await prisma.state.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true
      },
      orderBy: {
        name: 'asc'
      },
      take: 100
    });

    res.status(200).json({
      success: true,
      data: states
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/cities:
 *   get:
 *     summary: Get cities by state
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: stateId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: State ID to filter cities
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Search term for city name
 *     responses:
 *       200:
 *         description: Cities retrieved successfully
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
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       code:
 *                         type: string
 *                       stateId:
 *                         type: string
 *                         format: uuid
 *                       state:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 */
export const getPublicCities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { stateId, search } = req.query;

    const where: any = {
      isActive: true
    };

    if (stateId) {
      where.stateId = stateId;
    }

    if (search) {
      where.name = {
        contains: search as string,
        mode: 'insensitive'
      };
    }

    const cities = await prisma.city.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        stateId: true,
        state: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      },
      take: 100
    });

    res.status(200).json({
      success: true,
      data: cities
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/postal-codes:
 *   get:
 *     summary: Get postal codes by city
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: cityId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: City ID to filter postal codes
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Search term for postal code
 *     responses:
 *       200:
 *         description: Postal codes retrieved successfully
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
 *                         format: uuid
 *                       code:
 *                         type: string
 *                       cityId:
 *                         type: string
 *                         format: uuid
 *                       city:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 */
/**
 * @swagger
 * /api/v1/public/categories/{categoryId}:
 *   get:
 *     summary: Get a specific category by ID
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     slug:
 *                       type: string
 *                     description:
 *                       type: string
 *                     image:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     isFeatured:
 *                       type: boolean
 *                     order:
 *                       type: integer
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Category not found
 */
export const getPublicCategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { categoryId } = req.params;

    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        adPlaceholder: true,
        isActive: true,
        isFeatured: true,
        supportsBooking: true,
        order: true,
        createdAt: true,
        updatedAt: true,
        subcategories: {
          where: {
            isActive: true
          },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            image: true,
            categoryId: true,
            supportsBooking: true,
            isActive: true,
            order: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    if (!category) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route /api/v1/public/categories/${categoryId} not found`
        }
      });
      return;
    }

    // Transform category and update image URLs to include the API base URL
    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;

    const transformedCategory = transformCategory(category);

    // Update category image URL if it's a relative path
    if (transformedCategory.image && (transformedCategory.image.startsWith('/uploads/') || transformedCategory.image.startsWith('/public/'))) {
      transformedCategory.image = `${baseUrl}${transformedCategory.image}`;
    }

    // Update subcategory image URLs if they are relative paths
    if (transformedCategory.subcategories) {
      transformedCategory.subcategories = transformedCategory.subcategories.map(subcategory => {
        if (subcategory.image && (subcategory.image.startsWith('/uploads/') || subcategory.image.startsWith('/public/'))) {
          subcategory.image = `${baseUrl}${subcategory.image}`;
        }
        return subcategory;
      });
    }

    res.status(200).json({
      success: true,
      data: transformedCategory
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicPostalCodes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { cityId, search } = req.query;

    const where: any = {
      isActive: true
    };

    if (cityId) {
      where.cityId = cityId;
    }

    if (search) {
      where.code = {
        contains: search as string,
        mode: 'insensitive'
      };
    }

    const postalCodes = await prisma.postalCode.findMany({
      where,
      select: {
        id: true,
        code: true,
        cityId: true,
        city: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        code: 'asc'
      },
      take: 100
    });

    res.status(200).json({
      success: true,
      data: postalCodes
    });
    } catch (error) {
    next(error);
    }
    };

    /**
    * Proxy for Google Places Autocomplete to avoid CORS issues on Web
    */
    export const googlePlacesAutocomplete = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
    const { input } = req.query;
    const apiKey = config.googleMaps.apiKey;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Google Maps API key not configured'
      });
    }

    if (!input || typeof input !== 'string') {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const params = new URLSearchParams({
      input,
      key: apiKey,
      language: 'en',
      components: 'country:in'
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
    );

    const data: any = await response.json();

    return res.status(200).json({
      success: true,
      data: data.predictions || []
    });
    } catch (error) {
    return next(error);
    }
    };

    /**
    * Proxy for Google Place Details to avoid CORS issues on Web
    */
    export const getGooglePlaceDetails = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
    const { placeId } = req.query;
    const apiKey = config.googleMaps.apiKey;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Google Maps API key not configured'
      });
    }

    if (!placeId || typeof placeId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Place ID is required'
      });
    }

    const params = new URLSearchParams({
      place_id: placeId,
      key: apiKey,
      fields: 'geometry,formatted_address,address_components,name'
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
    );

    const data: any = await response.json();

    return res.status(200).json({
      success: true,
      data: data.result || null
    });
    } catch (error) {
    return next(error);
    }
    };

    /**
    * Proxy for Google Reverse Geocoding to avoid CORS issues on Web
    */
    export const googleReverseGeocode = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
    const { lat, lng } = req.query;
    const apiKey = config.googleMaps.apiKey;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Google Maps API key not configured'
      });
    }

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and Longitude are required'
      });
    }

    const params = new URLSearchParams({
      latlng: `${lat},${lng}`,
      key: apiKey,
      language: 'en'
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );

    const data: any = await response.json();

    return res.status(200).json({
      success: true,
      data: data.results || []
    });
    } catch (error) {
    return next(error);
    }
    };
/**
 * @swagger
 * /api/v1/public/ads/{adId}/notify-renewal-interest:
 *   post:
 *     summary: Notify seller that someone is interested in their expired ad
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: adId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       404:
 *         description: Ad not found
 */
export const notifyAdRenewalInterest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adId } = req.params;

    const ad = await prisma.ad.findFirst({
      where: { id: adId, status: { in: ['APPROVED', 'EXPIRED'] } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            phone: true
          }
        }
      }
    });

    if (!ad || !ad.user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'AD_NOT_FOUND',
          message: 'Ad not found'
        }
      });
      return;
    }

    // Check if ad is actually expired
    const isExpired = ad.status === 'EXPIRED' || (ad.expiresAt ? new Date(ad.expiresAt) < new Date() : false);
    if (!isExpired) {
      res.status(400).json({
        success: false,
        error: {
          code: 'AD_NOT_EXPIRED',
          message: 'Ad is not expired'
        }
      });
      return;
    }

    // Send notification to seller
    await sendNotificationToUser(
      ad.user.id,
      'Someone is interested in your expired ad!',
      `A buyer tried to contact you about "${ad.title}". Renew your ad to connect with potential buyers.`,
      'GENERAL',
      { adId: ad.id, adSlug: ad.slug, adTitle: ad.title }
    );

    res.status(200).json({
      success: true,
      message: 'Seller has been notified'
    });
  } catch (error) {
    next(error);
  }
};
