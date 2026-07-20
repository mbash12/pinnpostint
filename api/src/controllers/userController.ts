import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import Joi from 'joi';
import bcrypt from 'bcrypt';
import { 
  transformNotificationSummary
} from '../types/standardized-models';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse, ErrorCode } from '../utils/response-helpers';

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    phone: string;
  };
}

/**
 * @swagger
 * /api/v1/users/me/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Users]
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
 *           maximum: 50
 *           default: 10
 *         description: Number of notifications per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [BOOKING, AD_STATUS, SYSTEM, PROMOTION]
 *         description: Filter by notification type
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
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
 *                       type:
 *                         type: string
 *                         enum: [BOOKING, AD_STATUS, SYSTEM, PROMOTION]
 *                       title:
 *                         type: string
 *                       message:
 *                         type: string
 *                       isRead:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPrevPage:
 *                       type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getUserNotifications = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(createErrorResponse(ErrorCode.UNAUTHORIZED, 'Authentication required'));
      return;
    }

    const { error, value } = getNotificationsSchema.validate(req.query);
    if (error) {
      res.status(400).json(createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        error.details[0].message
      ));
      return;
    }

    const { page, limit, type, isRead } = value;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { userId: req.user.id };
    if (type) where.type = type;
    if (typeof isRead === 'boolean') where.isRead = isRead;

    // Get total count
    const total = await prisma.notification.count({ where });

    // Get notifications
    const notifications = await prisma.notification.findMany({
      where,
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        data: true,
        sentAt: true,
        scheduledAt: true
      },
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit
    });

    const transformedNotifications = notifications.map(transformNotificationSummary);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json(createPaginatedResponse(
      transformedNotifications,
      {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    ));
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/notifications/{notificationId}/read:
 *   put:
 *     summary: Mark notification as read
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification marked as read successfully
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
 *                   example: 'Notification marked as read'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'NOTIFICATION_NOT_FOUND'
 *                 message: 'Notification not found'
 */
export const markNotificationAsRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(createErrorResponse(ErrorCode.UNAUTHORIZED, 'Authentication required'));
      return;
    }

    const { error, value } = notificationIdSchema.validate(req.params);
    if (error) {
      res.status(400).json(createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        error.details[0].message
      ));
      return;
    }

    const { notificationId } = value;

    // Check if notification exists and belongs to user
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: req.user.id
      }
    });

    if (!notification) {
      res.status(404).json(createErrorResponse(ErrorCode.NOT_FOUND, 'Notification not found'));
      return;
    }

    // Mark as read
    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });

    res.status(200).json(createSuccessResponse(null, 'Notification marked as read'));
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/notifications/mark-all-read:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read successfully
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
 *                   example: 'All notifications marked as read'
 *                 data:
 *                   type: object
 *                   properties:
 *                     updatedCount:
 *                       type: integer
 *                       example: 5
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const markAllNotificationsAsRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(createErrorResponse(ErrorCode.UNAUTHORIZED, 'Authentication required'));
      return;
    }

    // Mark all unread notifications as read
    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false
      },
      data: { isRead: true }
    });

    res.status(200).json(createSuccessResponse(
      { updatedCount: result.count },
      'All notifications marked as read'
    ));
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/notifications/{notificationId}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Notification deleted successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'NOTIFICATION_NOT_FOUND'
 *                 message: 'Notification not found'
 */
export const deleteNotification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(createErrorResponse(ErrorCode.UNAUTHORIZED, 'Authentication required'));
      return;
    }

    const { error, value } = notificationIdSchema.validate(req.params);
    if (error) {
      res.status(400).json(createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        error.details[0].message
      ));
      return;
    }

    const { notificationId } = value;

    // Check if notification exists and belongs to user
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: req.user.id
      }
    });

    if (!notification) {
      res.status(404).json(createErrorResponse(ErrorCode.NOT_FOUND, 'Notification not found'));
      return;
    }

    // Delete notification
    await prisma.notification.delete({
      where: { id: notificationId }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const removeFromWishlistSchema = Joi.object({
  adId: Joi.string().uuid().required()
});

// Validation schemas
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(1).max(50),
  lastName: Joi.string().max(50).allow('').allow(null),
  email: Joi.string().email().allow('').allow(null),
  phone: Joi.string().pattern(/^[0-9]{10}$/).allow('').allow(null),
  avatar: Joi.string().uri().allow('').allow(null),
  bio: Joi.string().max(500).allow('').allow(null),
  address: Joi.string().max(500).allow('').allow(null),
  cityId: Joi.string().max(36).allow('').allow(null),
  stateId: Joi.string().max(36).allow('').allow(null),
  country: Joi.string().max(100).allow('').allow(null),
  postalCodeId: Joi.string().max(36).allow('').allow(null),
  dob: Joi.date().iso().allow(null),
  gender: Joi.string().valid('male', 'female').allow('').allow(null)
}).min(1);

const addLocationSchema = Joi.object({
  locationId: Joi.string().uuid().required(),
  isPrimary: Joi.boolean().default(false)
});

const updateUserLocationSchema = Joi.object({
  isPrimary: Joi.boolean().required()
});

const updateFcmTokenSchema = Joi.object({
  fcmToken: Joi.string().min(1).max(500).required()
});

const addToWishlistSchema = Joi.object({
  adId: Joi.string().uuid().required()
});

const getNotificationsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  type: Joi.string().valid('SUBSCRIPTION_EXPIRY', 'AD_APPROVED', 'AD_REJECTED', 'GENERAL', 'BOOKING_UPDATE', 'SYSTEM', 'BOOKING', 'PROMOTION').allow(''),
  isRead: Joi.boolean().allow('')
});

const notificationIdSchema = Joi.object({
  notificationId: Joi.string().required()
});

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         phone:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         role:
 *           type: string
 *           enum: [USER, ADMIN]
 *         isActive:
 *           type: boolean
 *         isVerified:
 *           type: boolean
 *         avatar:
 *           type: string
 *         fcmToken:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         profile:
 *           type: object
 *           properties:
 *             bio:
 *               type: string
 *             address:
 *               type: string
 *             city:
 *               type: string
 *             state:
 *               type: string
 *             country:
 *               type: string
 *             postalCodeId:
 *               type: string
 *             dob:
 *               type: string
 *               format: date
 *             gender:
 *               type: string
 *               enum: [male, female, other]
 *         userLocations:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *               isPrimary:
 *                 type: boolean
 *               location:
 *                 $ref: '#/components/schemas/Location'
 */

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Get current user profile (includes Profile data)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getCurrentUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isVerified: true,
        avatar: true,
        fcmToken: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            bio: true,
            address: true,
            city: true,
            state: true,
            country: true,
            postalCodeId: true,
            dob: true,
            gender: true
          }
        },
        userLocations: {
          select: {
            id: true,
            isPrimary: true,
            location: {
              select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                city: true,
                state: true,
                country: true,
                postalCode: true
              }
            }
          },
          orderBy: {
            isPrimary: 'desc'
          }
        }
      }
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

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/wishlist:
 *   post:
 *     summary: Add an ad to wishlist
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - adId
 *             properties:
 *               adId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the ad to add to wishlist
 *     responses:
 *       201:
 *         description: Ad added to wishlist successfully
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
 *                   example: "Ad added to wishlist successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Ad not found
 *       409:
 *         description: Ad already in wishlist
 */
export const addToWishlist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = addToWishlistSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    const { adId } = value;

    // Check if ad exists (allow favoriting even if expired)
    const ad = await prisma.ad.findFirst({
      where: {
        id: adId
      }
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

    // Check if already in wishlist
    const existingWishlist = await prisma.wishlist.findUnique({
      where: {
        userId_adId: {
          userId: req.user!.id,
          adId
        }
      }
    });

    if (existingWishlist) {
      res.status(409).json({
        success: false,
        error: {
          code: 'AD_ALREADY_IN_WISHLIST',
          message: 'Ad is already in your wishlist'
        }
      });
      return;
    }

    // Add to wishlist
    await prisma.wishlist.create({
      data: {
        userId: req.user!.id,
        adId
      }
    });

    res.status(201).json({
      success: true,
      message: 'Ad added to wishlist successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/wishlist:
 *   get:
 *     summary: Get user's wishlist
 *     tags: [User]
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
 *           maximum: 50
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Wishlist retrieved successfully
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
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       ad:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           price:
 *                             type: number
 *                           images:
 *                             type: array
 *                             items:
 *                               type: string
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getWishlist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const skip = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();

    // Build base where clause — include ALL wishlist items regardless of ad status
    const where: any = { 
      userId: req.user!.id
    };

    // If search is provided, first find matching ad IDs, then filter wishlist
    let matchingAdIds: string[] = [];
    if (search) {
      const searchTerm = search;

      // Find ads that match the search criteria
      const matchingAds = await prisma.ad.findMany({
        where: {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { category: { name: { contains: searchTerm, mode: 'insensitive' } } },
          ]
        },
        select: { id: true }
      });

      matchingAdIds = matchingAds.map(ad => ad.id);

      // If no ads match, return empty result
      if (matchingAdIds.length === 0) {
        res.status(200).json({
          success: true,
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limit,
            hasNextPage: false,
            hasPreviousPage: false
          }
        });
        return;
      }

      // Filter wishlist by matching ad IDs
      where.adId = { in: matchingAdIds };
    }

    const [wishlistItems, totalCount] = await Promise.all([
      prisma.wishlist.findMany({
        where,
        include: {
          ad: {
            select: {
              id: true,
              slug: true,
              title: true,
              description: true,
              price: true,
              images: true,
              status: true,
              createdAt: true,
              locationLatitude: true,
              locationLongitude: true,
              locationRoad: true,
              locationHouseNumber: true,
              locationCity: true,
              locationState: true,
              locationCountry: true,
              locationPostalCode: true,
              locationFormatted: true,
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
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.wishlist.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      data: wishlistItems,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/wishlist/{adId}:
 *   delete:
 *     summary: Remove an ad from wishlist
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the ad to remove from wishlist
 *     responses:
 *       204:
 *         description: Ad removed from wishlist successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Ad not found in wishlist
 */
export const removeFromWishlist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = removeFromWishlistSchema.validate(req.params);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    const { adId } = value;

    // Check if item exists in wishlist
    const wishlistItem = await prisma.wishlist.findUnique({
      where: {
        userId_adId: {
          userId: req.user!.id,
          adId
        }
      }
    });

    if (!wishlistItem) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WISHLIST_ITEM_NOT_FOUND',
          message: 'Ad not found in your wishlist'
        }
      });
      return;
    }

    // Remove from wishlist
    await prisma.wishlist.delete({
      where: {
        userId_adId: {
          userId: req.user!.id,
          adId
        }
      }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/fcm-token:
 *   put:
 *     summary: Update FCM token for push notifications
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fcmToken
 *             properties:
 *               fcmToken:
 *                 type: string
 *                 description: Firebase Cloud Messaging token
 *                 example: "dGhpcyBpcyBhIGZha2UgZmNtIHRva2Vu"
 *     responses:
 *       200:
 *         description: FCM token updated successfully
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
 *                   example: "FCM token updated successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const updateFcmToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = updateFcmTokenSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    const { fcmToken } = value;

    // Update user's FCM token (legacy field for backward compatibility)
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { fcmToken }
    });

    // Also register in PushToken table for multi-device support
    // Determine platform based on user agent or default to mobile
    const platform = req.headers['x-platform'] === 'web' ? 'web' : 
                     req.headers['x-platform'] === 'ios' ? 'ios' : 'android';
    
    await prisma.pushToken.upsert({
      where: { token: fcmToken },
      update: {
        userId: req.user!.id,
        platform,
        isActive: true,
        lastUsed: new Date()
      },
      create: {
        userId: req.user!.id,
        token: fcmToken,
        platform,
        isActive: true,
        lastUsed: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'FCM token updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/fcm-token:
 *   delete:
 *     summary: Delete FCM token (unregister from push notifications)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: FCM token deleted successfully
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
 *                   example: "FCM token deleted successfully"
 *       401:
 *         description: Unauthorized
 */
export const deleteFcmToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    // Clear legacy FCM token from User model
    await prisma.user.update({
      where: { id: req.user.id },
      data: { fcmToken: null }
    });

    // Deactivate all push tokens for this user (or current platform if header provided)
    const platform = req.headers['x-platform'] as string | undefined;
    const whereClause: any = {
      userId: req.user.id,
      isActive: true
    };

    // If platform specified, only deactivate tokens for that platform
    if (platform && ['web', 'ios', 'android'].includes(platform)) {
      whereClause.platform = platform;
    }

    const result = await prisma.pushToken.updateMany({
      where: whereClause,
      data: { isActive: false }
    });

    res.status(200).json({
      success: true,
      message: 'FCM token deleted successfully',
      data: {
        deactivatedTokens: result.count
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me:
 *   put:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *               lastName:
 *                 type: string
 *                 maxLength: 50
 *               email:
 *                 type: string
 *                 format: email
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *               address:
 *                 type: string
 *                 maxLength: 500
 *               cityId:
 *                 type: string
 *                 maxLength: 36
 *               stateId:
 *                 type: string
 *                 maxLength: 36
 *               country:
 *                 type: string
 *                 maxLength: 100
 *               postalCodeId:
 *                 type: string
 *                 maxLength: 36
 *               dob:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                   example: 'Profile updated successfully'
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       409:
 *         description: Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'EMAIL_EXISTS'
 *                 message: 'Email already exists'
 */
export const updateCurrentUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const { error, value } = updateProfileSchema.validate(req.body);
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
      firstName,
      lastName,
      email,
      phone,
      avatar,
      bio,
      address,
      cityId,
      stateId,
      country,
      postalCodeId,
      dob,
      gender
    } = value;

    // Normalize email to lowercase for case-insensitive comparison
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    // Check if email already exists (if email is being updated)
    if (normalizedEmail) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          id: { not: req.user.id }
        }
      });

      if (existingUser) {
        res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'Email already exists'
          }
        });
        return;
      }
    }

    // Check if phone already exists (if phone is being updated)
    if (phone) {
      const existingUserByPhone = await prisma.user.findFirst({
        where: {
          phone,
          id: { not: req.user.id }
        }
      });

      if (existingUserByPhone) {
        res.status(409).json({
          success: false,
          error: {
            code: 'PHONE_EXISTS',
            message: 'Phone number already exists'
          }
        });
        return;
      }
    }

    // Prepare user data update
    const userUpdateData: any = {};
    if (firstName !== undefined) userUpdateData.firstName = firstName;
    if (lastName !== undefined) userUpdateData.lastName = lastName;
    if (email !== undefined) userUpdateData.email = normalizedEmail;
    if (phone !== undefined) userUpdateData.phone = phone || null;
    if (avatar !== undefined) userUpdateData.avatar = avatar || null;

    // Prepare profile data update
    const profileUpdateData: any = {};
    if (bio !== undefined) profileUpdateData.bio = bio || null;
    if (address !== undefined) profileUpdateData.address = address || null;
    if (cityId !== undefined) profileUpdateData.cityId = cityId || null;
    if (stateId !== undefined) profileUpdateData.stateId = stateId || null;
    if (country !== undefined) profileUpdateData.country = country || null;
    if (postalCodeId !== undefined) profileUpdateData.postalCodeId = postalCodeId || null;
    if (dob !== undefined) profileUpdateData.dob = dob || null;
    if (gender !== undefined) profileUpdateData.gender = gender || null;

    // Update user and profile in a transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update user data if there are changes
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: req.user!.id },
          data: userUpdateData
        });
      }

      // Update or create profile if there are changes
      if (Object.keys(profileUpdateData).length > 0) {
        await tx.profile.upsert({
          where: { userId: req.user!.id },
          update: profileUpdateData,
          create: {
            userId: req.user!.id,
            ...profileUpdateData
          }
        });
      }

      // Return updated user with profile
      return await tx.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          phone: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isVerified: true,
          avatar: true,
          fcmToken: true,
          createdAt: true,
          updatedAt: true,
          profile: {
            select: {
              bio: true,
              address: true,
              city: true,
              state: true,
              country: true,
              postalCodeId: true,
              dob: true,
              gender: true
            }
          },
          userLocations: {
            select: {
              id: true,
              isPrimary: true,
              location: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  latitude: true,
                  longitude: true,
                  city: true,
                  state: true,
                  country: true,
                  postalCode: true
                }
              }
            },
            orderBy: {
              isPrimary: 'desc'
            }
          }
        }
      });
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/locations:
 *   post:
 *     summary: Add a location for the user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - locationId
 *             properties:
 *               locationId:
 *                 type: string
 *                 format: uuid
 *               isPrimary:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Location added successfully
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
 *                   example: 'Location added successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     isPrimary:
 *                       type: boolean
 *                     location:
 *                       $ref: '#/components/schemas/Location'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Location not found
 *       409:
 *         description: Location already added
 */
export const addUserLocation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const { error, value } = addLocationSchema.validate(req.body);
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

    const { locationId, isPrimary } = value;

    // Check if location exists
    const location = await prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!location) {
      res.status(404).json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'Location not found'
        }
      });
      return;
    }

    // Check if user already has this location
    const existingUserLocation = await prisma.userLocation.findUnique({
      where: {
        userId_locationId: {
          userId: req.user.id,
          locationId
        }
      }
    });

    if (existingUserLocation) {
      res.status(409).json({
        success: false,
        error: {
          code: 'LOCATION_ALREADY_ADDED',
          message: 'Location already added to user'
        }
      });
      return;
    }

    // If setting as primary, unset other primary locations
    if (isPrimary) {
      await prisma.userLocation.updateMany({
        where: {
          userId: req.user.id,
          isPrimary: true
        },
        data: {
          isPrimary: false
        }
      });
    }

    // Add user location
    const userLocation = await prisma.userLocation.create({
      data: {
        userId: req.user.id,
        locationId,
        isPrimary
      },
      include: {
        location: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Location added successfully',
      data: userLocation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/locations:
 *   get:
 *     summary: Get user's saved locations
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User locations retrieved successfully
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
 *                       isPrimary:
 *                         type: boolean
 *                       location:
 *                         $ref: '#/components/schemas/Location'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getUserLocations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const userLocations = await prisma.userLocation.findMany({
      where: { userId: req.user.id },
      include: {
        location: true
      },
      orderBy: {
        isPrimary: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      data: userLocations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/locations/{locationId}:
 *   put:
 *     summary: Update user location (e.g., set as primary)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: locationId
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
 *               - isPrimary
 *             properties:
 *               isPrimary:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User location updated successfully
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
 *                   example: 'Location updated successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     isPrimary:
 *                       type: boolean
 *                     location:
 *                       $ref: '#/components/schemas/Location'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: User location not found
 */
export const updateUserLocation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const { error, value } = updateUserLocationSchema.validate(req.body);
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

    const { locationId } = req.params;
    const { isPrimary } = value;

    // Check if user location exists
    const userLocation = await prisma.userLocation.findUnique({
      where: {
        userId_locationId: {
          userId: req.user.id,
          locationId
        }
      }
    });

    if (!userLocation) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_LOCATION_NOT_FOUND',
          message: 'User location not found'
        }
      });
      return;
    }

    // If setting as primary, unset other primary locations
    if (isPrimary) {
      await prisma.userLocation.updateMany({
        where: {
          userId: req.user.id,
          isPrimary: true
        },
        data: {
          isPrimary: false
        }
      });
    }

    // Update user location
    const updatedUserLocation = await prisma.userLocation.update({
      where: {
        userId_locationId: {
          userId: req.user.id,
          locationId
        }
      },
      data: {
        isPrimary
      },
      include: {
        location: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: updatedUserLocation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/locations/{locationId}:
 *   delete:
 *     summary: Remove user location
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: locationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Location removed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: User location not found
 */
export const changeUserPassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const changePasswordSchema = Joi.object({
      currentPassword: Joi.string().required().min(6),
      newPassword: Joi.string().required().min(8).max(128),
      confirmPassword: Joi.string().required().valid(Joi.ref('newPassword'))
    });

    const { error, value } = changePasswordSchema.validate(req.body);
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

    // Get user ID from auth middleware
    const userId = req.user!.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: {
        id: userId
      }
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

    // Verify current password
    const isPasswordValid = await bcrypt.compare(value.currentPassword, user.password);
    if (!isPasswordValid) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Current password is incorrect'
        }
      });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(value.newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        updatedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};
/**
 * @swagger
 * /api/v1/users/me/locations/{locationId}:
 *   delete:
 *     summary: Remove user location
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: locationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Location removed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: User location not found
 */
export const removeUserLocation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(createErrorResponse(ErrorCode.UNAUTHORIZED, 'Authentication required'));
      return;
    }

    const { locationId } = req.params;

    if (!locationId) {
      res.status(400).json(createErrorResponse(ErrorCode.VALIDATION_ERROR, 'Location ID is required'));
      return;
    }

    // Check if location belongs to user
    const location = await prisma.userLocation.findUnique({
      where: {
        userId_locationId: {
          userId: req.user.id,
          locationId
        }
      }
    });

    if (!location) {
      res.status(404).json(createErrorResponse(ErrorCode.NOT_FOUND, 'Location not found'));
      return;
    }

    // Delete user location
    await prisma.userLocation.delete({
      where: {
        userId_locationId: {
          userId: req.user.id,
          locationId
        }
      }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me:
 *   delete:
 *     summary: Delete user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Account deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const deleteAccount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(createErrorResponse(ErrorCode.UNAUTHORIZED, 'Authentication required'));
      return;
    }

    await prisma.user.delete({
      where: { id: req.user.id }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/:userId/stats:
 *   get:
 *     summary: Get public stats for a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User stats retrieved successfully
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
 *                     activeAds:
 *                       type: integer
 *                     memberSince:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: User not found
 */
export const getUserPublicStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Get user basic info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
      }
    });

    if (!user) {
      res.status(404).json(createErrorResponse(ErrorCode.NOT_FOUND, 'User not found'));
      return;
    }

    // Count active APPROVED ads (non-expired)
    const activeAdsCount = await prisma.ad.count({
      where: {
        userId: userId,
        status: 'APPROVED',
        expiresAt: {
          gt: new Date()
        }
      }
    });

    const data = {
      activeAds: activeAdsCount,
      memberSince: user.createdAt
    };

    res.status(200).json(createSuccessResponse(data));
  } catch (error) {
    next(error);
  }
};
