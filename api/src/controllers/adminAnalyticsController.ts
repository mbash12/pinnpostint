import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import Joi from 'joi';
import {
  getOptimizedDashboardStats,
  getOptimizedUserAnalytics,
  getOptimizedAdAnalytics,
  getOptimizedRevenueAnalytics,
  getOptimizedLocationAnalytics,
  getOptimizedWishlistAnalytics
} from '../utils/analytics-optimized';

// Validation schemas
const analyticsQuerySchema = Joi.object({
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  period: Joi.string().valid('7d', '30d', '90d', '1y').default('30d')
});

/*
const locationAnalyticsSchema = Joi.object({
  country: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  city: Joi.string().max(100).optional(),
  ...analyticsQuerySchema.describe().keys
});
*/

/**
 * @swagger
 * /api/v1/admin/analytics/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time period for analytics
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
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
 *                     totalUsers:
 *                       type: integer
 *                     totalAds:
 *                       type: integer
 *                     totalRevenue:
 *                       type: number
 *                     totalBookings:
 *                       type: integer
 *                     activeSubscriptions:
 *                       type: integer
 *                     pendingAds:
 *                       type: integer
 *                     recentActivity:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = analyticsQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const { period } = value;

    // Use optimized query with caching
    const dashboardStats = await getOptimizedDashboardStats(period);

    res.status(200).json({
      success: true,
      data: dashboardStats
    });
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/analytics/users:
 *   get:
 *     summary: Get user analytics
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *     responses:
 *       200:
 *         description: User analytics retrieved successfully
 */
export const getUserAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = analyticsQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const { period } = value;

    // Use optimized query with caching
    const userAnalytics = await getOptimizedUserAnalytics(period);

    res.status(200).json({
      success: true,
      data: userAnalytics
    });
  } catch (error) {
    console.error('Error in getUserAnalytics:', error);
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/analytics/ads:
 *   get:
 *     summary: Get ad analytics
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Ad analytics retrieved successfully
 */
export const getAdAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { period = '30d' } = req.query;

    // Validate period
    const validPeriods = ['7d', '30d', '90d', '1y'];
    if (!validPeriods.includes(period as string)) {
      res.status(400).json({
        success: false,
        message: 'Invalid period. Must be one of: 7d, 30d, 90d, 1y'
      });
      return;
    }

    // Use optimized query with caching
    const adAnalytics = await getOptimizedAdAnalytics(period as string);

    res.status(200).json({
      success: true,
      data: adAnalytics
    });
  } catch (error) {
    console.error('Error in getAdAnalytics:', error);
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/analytics/revenue:
 *   get:
 *     summary: Get revenue analytics
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Revenue analytics retrieved successfully
 */
export const getRevenueAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { period = '30d' } = req.query;

    // Validate period
    const validPeriods = ['7d', '30d', '90d', '1y'];
    if (!validPeriods.includes(period as string)) {
      res.status(400).json({
        success: false,
        message: 'Invalid period. Must be one of: 7d, 30d, 90d, 1y'
      });
      return;
    }

    // Use optimized query with caching
    const revenueAnalytics = await getOptimizedRevenueAnalytics(period as string);

    res.status(200).json({
      success: true,
      data: revenueAnalytics
    });
  } catch (error) {
    console.error('Error in getRevenueAnalytics:', error);
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/analytics/locations:
 *   get:
 *     summary: Get location-based analytics
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Location analytics retrieved successfully
 */
export const getLocationAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { period = '30d', country, state, city } = req.query;
    
    // Validate period
    const validPeriods = ['7d', '30d', '90d', '1y'];
    if (!validPeriods.includes(period as string)) {
      res.status(400).json({
        success: false,
        message: 'Invalid period. Valid periods are: 7d, 30d, 90d, 1y'
      });
      return;
    }

    // Use optimized query with caching
    const locationAnalytics = await getOptimizedLocationAnalytics(
      period as string,
      country as string,
      state as string,
      city as string
    );

    res.status(200).json({
      success: true,
      data: locationAnalytics
    });
  } catch (error) {
    console.error('Error in getLocationAnalytics:', error);
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/analytics/wishlists:
 *   get:
 *     summary: Get wishlist analytics
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Wishlist analytics retrieved successfully
 */
export const getWishlistAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { period = '30d' } = req.query;
    
    // Validate period
    const validPeriods = ['7d', '30d', '90d', '1y'];
    if (!validPeriods.includes(period as string)) {
      res.status(400).json({
        success: false,
        message: 'Invalid period. Must be one of: 7d, 30d, 90d, 1y'
      });
      return;
    }

    // Use optimized query with caching
    const wishlistAnalytics = await getOptimizedWishlistAnalytics(period as string);

    res.status(200).json({
      success: true,
      data: wishlistAnalytics
    });
  } catch (error) {
    console.error('Error in getWishlistAnalytics:', error);
    next(error);
  }
};