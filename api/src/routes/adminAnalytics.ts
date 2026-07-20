import { Router } from 'express';
import {
  getDashboardStats,
  getUserAnalytics,
  getAdAnalytics,
  getRevenueAnalytics,
  getLocationAnalytics,
  getWishlistAnalytics
} from '../controllers/adminAnalyticsController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Apply authentication and admin middleware to all routes
router.use(authenticate);
router.use(requireAdmin);

// Analytics routes
router.get('/dashboard', getDashboardStats);
router.get('/users', getUserAnalytics);
router.get('/ads', getAdAnalytics);
router.get('/revenue', getRevenueAnalytics);
router.get('/locations', getLocationAnalytics);
router.get('/wishlists', getWishlistAnalytics);

export default router;