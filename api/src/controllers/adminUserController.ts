import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { calculatePagination } from '../types/api-responses';
import Joi from 'joi';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    phone: string;
  };
}

// Validation schemas
const getUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().max(100).allow(''),
  role: Joi.string().valid('USER', 'ADMIN').allow(''),
  isActive: Joi.boolean().allow(''),
  isVerified: Joi.boolean().allow(''),
  sortBy: Joi.string().valid('createdAt', 'firstName', 'lastName', 'email').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const userIdSchema = Joi.object({
  userId: Joi.string().uuid().required(),
});

const updateUserSchema = Joi.object({
  firstName: Joi.string().min(1).max(50),
  lastName: Joi.string().max(50).allow('').allow(null),
  email: Joi.string().email().allow('').allow(null),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow('').allow(null),
  role: Joi.string().valid('USER', 'ADMIN').optional(),
  avatar: Joi.string().uri().allow('').allow(null),
  profile: Joi.object({
    bio: Joi.string().max(500).allow('').allow(null),
    address: Joi.string().max(500).allow('').allow(null),
    cityId: Joi.string().max(36).allow('').allow(null),
    stateId: Joi.string().max(36).allow('').allow(null),
    country: Joi.string().max(100).allow('').allow(null),
    postalCodeId: Joi.string().max(36).allow('').allow(null),
    dob: Joi.date().iso().allow(null),
    gender: Joi.string().valid('male', 'female').allow('').allow(null),
    emailNotifications: Joi.boolean(),
    pushNotifications: Joi.boolean(),
  }).optional(),
}).min(1);

const updateUserStatusSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

const updateUserRoleSchema = Joi.object({
  role: Joi.string().valid('USER', 'ADMIN').required(),
});

const updateUserVerificationSchema = Joi.object({
  isVerified: Joi.boolean().required(),
});

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get all users with filtering
 *     tags: [Admin - Users]
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
 *         description: Number of users per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, or phone
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [USER, ADMIN]
 *         description: Filter by user role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: isVerified
 *         schema:
 *           type: boolean
 *         description: Filter by verification status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, firstName, lastName, email]
 *           default: createdAt
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
 *         description: Users retrieved successfully
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
 *                     $ref: '#/components/schemas/UserProfile'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getAllUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = getUsersQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
      return;
    }

    const { page, limit, search, role, isActive, isVerified, sortBy, sortOrder } = value;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    if (role) where.role = role;
    if (typeof isActive === 'boolean') where.isActive = isActive;
    if (typeof isVerified === 'boolean') where.isVerified = isVerified;

    // Get total count
    const total = await prisma.user.count({ where });

    // Get users
    const users = await prisma.user.findMany({
      where,
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
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            bio: true,
            country: true,
            stateId: true,
            
            cityId: true,
            postalCodeId: true,
            emailNotifications: true,
            pushNotifications: true,
          },
        },
        _count: {
          select: {
            ads: true,
            userLocations: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    res.status(200).json({
      success: true,
      data: users,
      pagination: calculatePagination(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/{userId}:
 *   get:
 *     summary: Get detailed user information
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User information retrieved successfully
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
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'USER_NOT_FOUND'
 *                 message: 'User not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getUserById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = userIdSchema.validate(req.params);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
      return;
    }

    const { userId } = value;

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
            cityId: true,
            
            stateId: true,
            country: true,
            postalCodeId: true,
            dob: true,
            gender: true,
            emailNotifications: true,
            pushNotifications: true,
          },
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
                cityId: true,
                stateId: true,
                country: true,
              },
            },
          },
          orderBy: {
            isPrimary: 'desc',
          },
        },
        ads: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
          },
          take: 5,
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            ads: true,
            userLocations: true,
            wishlists: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/{userId}:
 *   put:
 *     summary: Update user information
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
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
 *               phone:
 *                 type: string
 *                 pattern: '^\\+?[1-9]\\d{1,14}$'
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN]
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
 *         description: User updated successfully
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
 *                   example: 'User updated successfully'
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'USER_NOT_FOUND'
 *                 message: 'User not found'
 *       409:
 *         description: Email or phone already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'EMAIL_EXISTS'
 *                 message: 'Email already exists'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const updateUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error: paramsError, value: paramsValue } = userIdSchema.validate(req.params);
    if (paramsError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsError.details[0].message,
        },
      });
      return;
    }

    const { error: bodyError, value: bodyValue } = updateUserSchema.validate(req.body);
    if (bodyError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: bodyError.details[0].message,
        },
      });
      return;
    }

    const { userId } = paramsValue;
    const updateData = bodyValue;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    // Check for email/phone conflicts
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: updateData.email,
          id: { not: userId },
        },
      });
      if (emailExists) {
        res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'Email already exists',
          },
        });
        return;
      }
    }

    if (updateData.phone && updateData.phone !== existingUser.phone) {
      const phoneExists = await prisma.user.findFirst({
        where: {
          phone: updateData.phone,
          id: { not: userId },
        },
      });
      if (phoneExists) {
        res.status(409).json({
          success: false,
          error: {
            code: 'PHONE_EXISTS',
            message: 'Phone number already exists',
          },
        });
        return;
      }
    }

    // Separate user fields from profile fields
    const { profile, ...userFields } = updateData;
    const profileFields = profile || {};

    // Remove undefined fields from profile
    Object.keys(profileFields).forEach(key => {
      if (profileFields[key as keyof typeof profileFields] === undefined) {
        delete profileFields[key as keyof typeof profileFields];
      }
    });

    // Update user and profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...userFields,
        ...(Object.keys(profileFields).length > 0 && {
          profile: {
            upsert: {
              create: profileFields,
              update: profileFields,
            },
          },
        }),
      },
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
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            bio: true,
            address: true,
            cityId: true,
            
            stateId: true,
            country: true,
            postalCodeId: true,
            dob: true,
            gender: true,
            emailNotifications: true,
            pushNotifications: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/{userId}:
 *   delete:
 *     summary: Delete a user account
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
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
 *                   example: 'User deleted successfully'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'USER_NOT_FOUND'
 *                 message: 'User not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const deleteUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = userIdSchema.validate(req.params);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
      return;
    }

    const { userId } = value;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    // Delete user and all related records in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete related records first to avoid foreign key constraint violations
      
      // Delete user's ads and related data
      await tx.adAttribute.deleteMany({
        where: { ad: { userId: userId } }
      });
      
      await tx.adRevision.deleteMany({
        where: { ad: { userId: userId } }
      });
      
      await tx.ad.deleteMany({
        where: { userId: userId }
      });
      
      // Delete user's bookings
      await tx.booking.deleteMany({
        where: { userId: userId }
      });
      
      // Delete user's subscriptions and related transactions
      const userSubscriptions = await tx.subscription.findMany({
        where: { userId: userId },
        select: { id: true }
      });
      
      if (userSubscriptions.length > 0) {
        const subscriptionIds = userSubscriptions.map(sub => sub.id);
        await tx.transaction.deleteMany({
          where: { subscriptionId: { in: subscriptionIds } }
        });
      }
      
      await tx.subscription.deleteMany({
        where: { userId: userId }
      });
      
      // Delete user's transactions (not linked to subscriptions)
      await tx.transaction.deleteMany({
        where: { userId: userId }
      });
      
      // Delete user's notifications
      await tx.notification.deleteMany({
        where: { userId: userId }
      });
      
      // Delete user's wishlist items
      await tx.wishlist.deleteMany({
        where: { userId: userId }
      });
      
      // Delete user's locations
      await tx.userLocation.deleteMany({
        where: { userId: userId }
      });
      
      // Delete user's recent locations
      await tx.recentLocation.deleteMany({
        where: { userId: userId }
      });
      
      // Delete user's authored blogs
      await tx.blog.deleteMany({
        where: { authorId: userId }
      });
      
      // Delete user's moderation history
      await tx.moderationHistory.deleteMany({
        where: { moderatorId: userId }
      });
      
      // Delete user's profile
      await tx.profile.deleteMany({
        where: { userId: userId }
      });
      
      // Finally, delete the user
      await tx.user.delete({
        where: { id: userId }
      });
    });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/{userId}/status:
 *   put:
 *     summary: Activate or deactivate a user
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 description: User active status
 *     responses:
 *       200:
 *         description: User status updated successfully
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
 *                   example: 'User status updated successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     isActive:
 *                       type: boolean
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'USER_NOT_FOUND'
 *                 message: 'User not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const updateUserStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error: paramsError, value: paramsValue } = userIdSchema.validate(req.params);
    if (paramsError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsError.details[0].message,
        },
      });
      return;
    }

    const { error: bodyError, value: bodyValue } = updateUserStatusSchema.validate(req.body);
    if (bodyError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: bodyError.details[0].message,
        },
      });
      return;
    }

    const { userId } = paramsValue;
    const { isActive } = bodyValue;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    // Update user status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        isActive: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/{userId}/role:
 *   put:
 *     summary: Promote or demote a user
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN]
 *                 description: User role
 *     responses:
 *       200:
 *         description: User role updated successfully
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
 *                   example: 'User role updated successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     role:
 *                       type: string
 *                       enum: [USER, ADMIN]
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'USER_NOT_FOUND'
 *                 message: 'User not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const updateUserRole = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error: paramsError, value: paramsValue } = userIdSchema.validate(req.params);
    if (paramsError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsError.details[0].message,
        },
      });
      return;
    }

    const { error: bodyError, value: bodyValue } = updateUserRoleSchema.validate(req.body);
    if (bodyError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: bodyError.details[0].message,
        },
      });
      return;
    }

    const { userId } = paramsValue;
    const { role } = bodyValue;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        role: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/{userId}/verification:
 *   put:
 *     summary: Manually verify a user
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isVerified
 *             properties:
 *               isVerified:
 *                 type: boolean
 *                 description: User verification status
 *     responses:
 *       200:
 *         description: User verification status updated successfully
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
 *                   example: 'User verification status updated successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     isVerified:
 *                       type: boolean
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'USER_NOT_FOUND'
 *                 message: 'User not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const updateUserVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error: paramsError, value: paramsValue } = userIdSchema.validate(req.params);
    if (paramsError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsError.details[0].message,
        },
      });
      return;
    }

    const { error: bodyError, value: bodyValue } = updateUserVerificationSchema.validate(req.body);
    if (bodyError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: bodyError.details[0].message,
        },
      });
      return;
    }

    const { userId } = paramsValue;
    const { isVerified } = bodyValue;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    // Update user verification status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isVerified },
      select: {
        id: true,
        isVerified: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'User verification status updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Get user notification preferences (Admin)
 */
export const getUserNotificationPreferences = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error: paramsError, value: paramsValue } = userIdSchema.validate(req.params);
    if (paramsError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsError.details[0].message,
        },
      });
      return;
    }

    const { userId } = paramsValue;

    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: {
        emailNotifications: true,
        pushNotifications: true
      }
    });

    if (!profile) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'User profile not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user notification preferences (Admin)
 */
export const updateUserNotificationPreferences = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error: paramsError, value: paramsValue } = userIdSchema.validate(req.params);
    if (paramsError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsError.details[0].message,
        },
      });
      return;
    }

    const preferencesSchema = Joi.object({
      emailNotifications: Joi.boolean(),
      pushNotifications: Joi.boolean()
    });

    const { error: bodyError, value: bodyValue } = preferencesSchema.validate(req.body);
    if (bodyError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: bodyError.details[0].message,
        },
      });
      return;
    }

    const { userId } = paramsValue;

    const updatedProfile = await prisma.profile.update({
      where: { userId },
      data: bodyValue,
      select: {
        emailNotifications: true,
        pushNotifications: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
};

// Validation schema for creating users
const createUserSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().max(50).allow('').allow(null),
  email: Joi.string().email().allow('').allow(null),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('USER', 'ADMIN').default('USER'),
  isVerified: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
  profile: Joi.object({
    bio: Joi.string().max(500).allow('').allow(null),
    address: Joi.string().max(500).allow('').allow(null),
    cityId: Joi.string().max(36).allow('').allow(null),
    stateId: Joi.string().max(36).allow('').allow(null),
    country: Joi.string().max(100).allow('').allow(null),
    postalCodeId: Joi.string().max(36).allow('').allow(null),
    dob: Joi.date().iso().allow(null),
    gender: Joi.string().valid('male', 'female', 'other').allow('').allow(null),
    emailNotifications: Joi.boolean().default(true),
    pushNotifications: Joi.boolean().default(true),
  }).optional(),
});

/**
 * @swagger
 * /api/v1/admin/users:
 *   post:
 *     summary: Create a new user (Admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - phone
 *               - password
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
 *               phone:
 *                 type: string
 *                 pattern: '^\\+?[1-9]\\d{1,14}$'
 *               password:
 *                 type: string
 *                 minLength: 8
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN]
 *                 default: USER
 *               isVerified:
 *                 type: boolean
 *                 default: false
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               profile:
 *                 type: object
 *                 properties:
 *                   bio:
 *                     type: string
 *                     maxLength: 500
 *                   address:
 *                     type: string
 *                     maxLength: 500
 *                   cityId:
 *                     type: string
 *                     maxLength: 36
 *                   stateId:
 *                     type: string
 *                     maxLength: 36
 *                   country:
 *                     type: string
 *                     maxLength: 100
 *                   postalCodeId:
 *                     type: string
 *                     maxLength: 36
 *                   dob:
 *                     type: string
 *                     format: date
 *                   gender:
 *                     type: string
 *                     enum: [male, female, other]
 *                   emailNotifications:
 *                     type: boolean
 *                     default: true
 *                   pushNotifications:
 *                     type: boolean
 *                     default: true
 *     responses:
 *       201:
 *         description: User created successfully
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
 *                   example: 'User created successfully'
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       409:
 *         description: Email or phone already exists
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
export const createUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = createUserSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
      return;
    }

    const { firstName, lastName, email, phone, password, role, isVerified, isActive, profile } = value;

    // Check if user with phone already exists
    const existingUserByPhone = await prisma.user.findUnique({
      where: { phone }
    });

    if (existingUserByPhone) {
      res.status(409).json({
        success: false,
        error: {
          code: 'PHONE_EXISTS',
          message: 'User with this phone number already exists',
        },
      });
      return;
    }

    // Check if user with email already exists (if email provided)
    if (email) {
      const existingUserByEmail = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUserByEmail) {
        res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'User with this email already exists',
          },
        });
        return;
      }
    }

    // Convert empty string lastName to null for database
    const processedLastName = lastName && lastName.trim() ? lastName.trim() : null;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with profile
    const user = await prisma.user.create({
      data: {
        phone,
        password: hashedPassword,
        firstName,
        lastName: processedLastName,
        email,
        role: role || 'USER',
        isVerified: isVerified !== undefined ? isVerified : false,
        isActive: isActive !== undefined ? isActive : true,
        profile: {
          create: {
            bio: profile?.bio || null,
            address: profile?.address || null,
            cityId: profile?.cityId || null,
            stateId: profile?.stateId || null,
            country: profile?.country || null,
            postalCodeId: profile?.postalCodeId || null,
            dob: profile?.dob || null,
            gender: profile?.gender || null,
            emailNotifications: profile?.emailNotifications ?? true,
            pushNotifications: profile?.pushNotifications ?? true,
          }
        }
      },
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
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            bio: true,
            address: true,
            cityId: true,
            stateId: true,
            country: true,
            postalCodeId: true,
            dob: true,
            gender: true,
            emailNotifications: true,
            pushNotifications: true,
          },
        },
      }
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};;
