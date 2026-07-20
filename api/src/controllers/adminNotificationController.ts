import { Response } from 'express';
import Joi from 'joi';
import { prisma } from '../utils/database';
import { AuthRequest } from '../middleware/auth';
import { Prisma, NotificationType } from '@prisma/client';

const logger = console;

// Validation schemas
const getNotificationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  type: Joi.string().valid(
    'SUBSCRIPTION_EXPIRY',
    'AD_APPROVED',
    'AD_REJECTED',
    'GENERAL',
    'BOOKING_UPDATE',
    'SYSTEM',
    'BOOKING',
    'PROMOTION'
  ).allow(''),
  isRead: Joi.boolean().allow(''),
  startDate: Joi.date().iso().allow(''),
  endDate: Joi.date().iso().allow(''),
  sortBy: Joi.string().valid('sentAt').default('sentAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

/**
 * Get notifications for the current admin user
 */
export const getAdminNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const { error: validationError, value } = getNotificationsQuerySchema.validate(req.query);
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

    const { page, limit, type, isRead, startDate, endDate, sortBy, sortOrder } = value;
    const skip = (page - 1) * limit;

    // Build where clause - get notifications for current user
    const where: Prisma.NotificationWhereInput = {
      userId: req.user.id
    };

    if (type) where.type = type as NotificationType;
    if (isRead !== '' && isRead !== undefined) where.isRead = isRead;
    if (startDate || endDate) {
      where.sentAt = {};
      if (startDate) where.sentAt.gte = new Date(startDate);
      if (endDate) where.sentAt.lte = new Date(endDate);
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder }
      }),
      prisma.notification.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    logger.error('Get admin notifications error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notifications' }
    });
  }
};

/**
 * Get notification statistics for the current admin
 */
export const getNotificationStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const where = { userId: req.user.id };

    const [total, unread, today] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, isRead: false } }),
      prisma.notification.count({
        where: {
          ...where,
          sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: { total, unread, today }
    });
  } catch (error) {
    logger.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notification statistics' }
    });
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const { notificationId } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId: req.user.id }
    });

    if (!notification) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' }
      });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: updated
    });
  } catch (error) {
    logger.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notification as read' }
    });
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const { notificationId } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId: req.user.id }
    });

    if (!notification) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' }
      });
      return;
    }

    await prisma.notification.delete({ where: { id: notificationId } });

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete notification' }
    });
  }
};
