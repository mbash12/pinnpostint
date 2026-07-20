import { Response } from 'express';
import Joi from 'joi';
import { prisma } from '../utils/database';
import {
  transformNotificationPreferences
} from '../types/standardized-models';
import { createSuccessResponse, createErrorResponse, ErrorCode } from '../utils/response-helpers';
import type { ValidationError as ApiValidationError } from '../types/api-responses';
import { queueBulkNotifications } from '../background/queues/notification.queue';
import { resolveNotificationChannels } from '../utils/notification-channel-settings';

import { AuthRequest } from '../middleware/auth';
import { Prisma, NotificationType } from '@prisma/client';

const logger = console;

// Validation interfaces
interface SendNotificationInput {
  title?: string;
  message?: string;
  type?: string;
  userIds?: string[];
  userId?: string;
  sendToAll?: boolean;
  data?: Record<string, unknown>;
  channels?: ('push' | 'email' | 'sms')[];
}

interface NotificationPreferencesInput {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
}

// Validation schemas
const sendNotificationSchema = Joi.object({
  title: Joi.string().min(1).required().messages({
    'string.base': 'Title is required',
    'string.empty': 'Title is required'
  }),
  message: Joi.string().min(1).required().messages({
    'string.base': 'Message is required',
    'string.empty': 'Message is required'
  }),
  type: Joi.string()
    .valid('SUBSCRIPTION_EXPIRY', 'AD_APPROVED', 'AD_REJECTED', 'GENERAL', 'BOOKING_UPDATE', 'SYSTEM', 'BOOKING', 'PROMOTION')
    .required(),
  userIds: Joi.array().items(Joi.string()),
  userId: Joi.string(),
  sendToAll: Joi.boolean(),
  data: Joi.object().unknown(true),
  channels: Joi.array().items(Joi.string().valid('push', 'email', 'sms')).max(3)
})
  .prefs({ abortEarly: false, stripUnknown: true })
  .custom((value: SendNotificationInput, helpers) => {
    const normalizedUserIds = [...(value.userIds ?? [])];

    if (value.userId) {
      normalizedUserIds.push(value.userId);
    }

    const defaultSendToAll = value.sendToAll ?? (normalizedUserIds.length === 0);

    if (!defaultSendToAll && normalizedUserIds.length === 0) {
      return helpers.error('any.custom', { message: 'Either userIds, userId or sendToAll must be provided' });
    }

    return {
      ...value,
      userIds: normalizedUserIds,
      sendToAll: defaultSendToAll
    };
  }, 'Recipient Validation');

const notificationPreferencesSchema = Joi.object({
  emailNotifications: Joi.boolean(),
  pushNotifications: Joi.boolean()
}).prefs({ abortEarly: false, stripUnknown: true });

const mapValidationErrors = (details: Joi.ValidationErrorItem[]): ApiValidationError[] =>
  details.map(detail => ({
    field: detail.path.length ? `body.${detail.path.join('.')}` : 'body',
    message: detail.message,
    value: detail.context?.value as unknown
  }));

/**
 * @swagger
 * /api/v1/notifications/send:
 *   post:
 *     summary: Send notification to users (Admin only)
 *     description: Broadcasts notifications to all active users or to specific recipients. At least one of `sendToAll`, `userId`, or `userIds` must be provided.
 *     tags: [Notifications]
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
 *               - message
 *               - type
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 description: Notification title.
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 description: Notification message body.
 *               type:
 *                 type: string
 *                 enum: [SUBSCRIPTION_EXPIRY, AD_APPROVED, AD_REJECTED, GENERAL, BOOKING_UPDATE, SYSTEM, BOOKING, PROMOTION]
 *                 description: Notification category.
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: Target a single user (merged internally into `userIds`).
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Explicit list of user IDs to receive the notification.
 *               sendToAll:
 *                 type: boolean
 *                 description: When true, sends to all active users. Defaults to true if no recipients are provided.
 *               data:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Optional metadata payload.
 *           example:
 *             title: Maintenance Notice
 *             message: Platform will be offline tonight from 1-3 AM UTC.
 *             type: SYSTEM
 *             sendToAll: true
 *     responses:
 *       201:
 *         description: Notification sent successfully
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
 *                   example: Notification sent successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     sentCount:
 *                       type: integer
 *                       example: 42
 *       400:
 *         description: Validation error (missing recipients or invalid payload)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingRecipients:
 *                 summary: Recipients not provided
 *                 value:
 *                   success: false
 *                   error:
 *                     code: NO_RECIPIENTS
 *                     message: Either userIds or sendToAll must be provided
 *               validationFailure:
 *                 summary: Joi validation failure
 *                 value:
 *                   success: false
 *                   error:
 *                     code: VALIDATION_ERROR
 *                     message: Title is required
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: FORBIDDEN
 *                 message: Admin access required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const sendNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Validate admin role
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required'
        }
      });
      return;
    }

    const { error: validationError, value } = sendNotificationSchema.validate(req.body) as { error?: Joi.ValidationError; value: SendNotificationInput & { userIds: string[]; sendToAll: boolean; title: string; message: string; type: string; data?: Record<string, unknown> } };

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

    const { title, message, type, userIds, sendToAll, data, channels } = value;

    let targetUserIds: string[] = [];

    if (sendToAll) {
      // Get all active users
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true }
      });
      targetUserIds = users.map(user => user.id);
    } else if (userIds) {
      targetUserIds = userIds;
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_RECIPIENTS',
          message: 'Either userIds or sendToAll must be provided'
        }
      });
      return;
    }

    // Create notifications for all target users
    const notifications = targetUserIds.map(userId => ({
      userId,
      title,
      message,
      type: type as NotificationType,
      data: (data ?? undefined) as Prisma.InputJsonValue,
      sentAt: new Date()
    }));

    await prisma.notification.createMany({
      data: notifications as Prisma.NotificationCreateManyInput[]
    });

    const resolvedChannels = await resolveNotificationChannels(channels, false);

    // Send notifications via queue (non-blocking): push / email / SMS from system settings and optional body.channels
    queueBulkNotifications(
      targetUserIds,
      title,
      message,
      type as NotificationType,
      data as Record<string, any> || undefined,
      { channels: resolvedChannels }
    ).catch((error) => {
      console.error('Failed to queue notifications:', error);
    });

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      data: {
        sentCount: targetUserIds.length
      }
    });
  } catch (error) {
    logger.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to send notifications'
      }
    });
  }
};

/**
 * @swagger
 * /api/v1/users/me/notification-preferences:
 *   get:
 *     summary: Get user notification preferences
 *     tags: [User Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification preferences retrieved successfully
 *       404:
 *         description: User profile not found
 */
export const getNotificationPreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(createErrorResponse(ErrorCode.UNAUTHORIZED, 'Authentication required'));
      return;
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
      select: {
        emailNotifications: true,
        pushNotifications: true
      }
    });

    if (!profile) {
      res.status(404).json(createErrorResponse(ErrorCode.USER_NOT_FOUND, 'User profile not found'));
      return;
    }

    const preferences = transformNotificationPreferences(profile);
    res.status(200).json(createSuccessResponse(preferences));
  } catch (error) {
    logger.error('Error getting notification preferences:', error);
    res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to get notification preferences'));
  }
};

/**
 * @swagger
 * /api/v1/users/me/notification-preferences:
 *   put:
 *     summary: Update user notification preferences
 *     tags: [User Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailNotifications:
 *                 type: boolean
 *               pushNotifications:
 *                 type: boolean
 *               smsNotifications:
 *                 type: boolean
 *               bookingNotifications:
 *                 type: boolean
 *               adStatusNotifications:
 *                 type: boolean
 *               systemNotifications:
 *                 type: boolean
 *               promotionNotifications:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Notification preferences updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: User profile not found
 */
export const updateNotificationPreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(createErrorResponse(ErrorCode.UNAUTHORIZED, 'Authentication required'));
      return;
    }

    const { error: validationError, value } = notificationPreferencesSchema.validate(req.body) as { error?: Joi.ValidationError; value: NotificationPreferencesInput };
    if (validationError) {
      res.status(400).json(createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        validationError.message,
        mapValidationErrors(validationError.details)
      ));
      return;
    }

    const updatedProfile = await prisma.profile.update({
      where: { userId: req.user.id },
      data: value,
      select: {
        emailNotifications: true,
        pushNotifications: true
      }
    });

    const preferences = transformNotificationPreferences(updatedProfile);
    res.status(200).json(createSuccessResponse(preferences, 'Notification preferences updated successfully'));
  } catch (error) {
    logger.error('Error updating notification preferences:', error);
    res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to update notification preferences'));
  }
};
