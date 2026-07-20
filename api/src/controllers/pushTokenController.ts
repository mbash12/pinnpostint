import { Response } from 'express';
import Joi from 'joi';
import { prisma } from '../utils/database';
import { AuthRequest } from '../middleware/auth';

const logger = console;

// Validation schemas
const registerTokenSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'FCM token is required',
    'any.required': 'FCM token is required'
  }),
  platform: Joi.string().valid('web', 'android', 'ios').default('web').messages({
    'string.valid': 'Platform must be web, android, or ios'
  }),
  device: Joi.string().optional().allow('')
});

/**
 * Register a new push token for the current user
 */
export const registerPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const { error: validationError, value } = registerTokenSchema.validate(req.body);
    if (validationError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationError.message,
          details: validationError.details
        }
      });
      return;
    }

    const { token, platform, device } = value;
    const normalizedDevice = typeof device === 'string' ? device.trim() : '';

    // Check if token already exists
    const existingToken = await prisma.pushToken.findUnique({
      where: { token }
    });

    if (existingToken) {
      // If token exists but belongs to different user, update it
      if (existingToken.userId !== req.user.id) {
        await prisma.pushToken.update({
          where: { token },
          data: {
            userId: req.user.id,
            platform,
            device: device || existingToken.device,
            isActive: true,
            lastUsed: new Date()
          }
        });
      } else {
        // Update last used and ensure it's active
        await prisma.pushToken.update({
          where: { token },
          data: {
            platform,
            device: device || existingToken.device,
            isActive: true,
            lastUsed: new Date()
          }
        });
      }

      // Keep only one active token per device (when device info is available)
      if (normalizedDevice) {
        await prisma.pushToken.updateMany({
          where: {
            userId: req.user.id,
            platform,
            device: normalizedDevice,
            token: { not: token },
            isActive: true
          },
          data: {
            isActive: false
          }
        });
      }
    } else {
      // If the same user/device already has active tokens, deactivate old ones first.
      // This avoids duplicate push notifications on a single physical device.
      if (normalizedDevice) {
        await prisma.pushToken.updateMany({
          where: {
            userId: req.user.id,
            platform,
            device: normalizedDevice,
            isActive: true
          },
          data: {
            isActive: false
          }
        });
      }

      // Create new token
      await prisma.pushToken.create({
        data: {
          userId: req.user.id,
          token,
          platform,
          device: normalizedDevice || null,
          isActive: true,
          lastUsed: new Date()
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Push token registered successfully'
    });
  } catch (error) {
    logger.error('Register push token error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to register push token' }
    });
  }
};

/**
 * Unregister a push token
 */
export const unregisterPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const { token } = req.params;

    // Find the token and ensure it belongs to the current user
    const existingToken = await prisma.pushToken.findFirst({
      where: {
        token,
        userId: req.user.id
      }
    });

    if (!existingToken) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Token not found' }
      });
      return;
    }

    // Soft delete - mark as inactive
    await prisma.pushToken.update({
      where: { token },
      data: { isActive: false }
    });

    res.status(200).json({
      success: true,
      message: 'Push token unregistered successfully'
    });
  } catch (error) {
    logger.error('Unregister push token error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to unregister push token' }
    });
  }
};

/**
 * Get all push tokens for the current user
 */
export const getUserPushTokens = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const tokens = await prisma.pushToken.findMany({
      where: {
        userId: req.user.id,
        isActive: true
      },
      select: {
        id: true,
        platform: true,
        device: true,
        lastUsed: true,
        createdAt: true
      },
      orderBy: {
        lastUsed: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      data: tokens
    });
  } catch (error) {
    logger.error('Get user push tokens error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch push tokens' }
    });
  }
};

/**
 * Update token last used timestamp (heartbeat)
 */
export const updateTokenLastUsed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const { token } = req.params;

    // Update last used timestamp
    await prisma.pushToken.updateMany({
      where: {
        token,
        userId: req.user.id
      },
      data: {
        lastUsed: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Token heartbeat updated'
    });
  } catch (error) {
    logger.error('Update token heartbeat error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update token heartbeat' }
    });
  }
};
