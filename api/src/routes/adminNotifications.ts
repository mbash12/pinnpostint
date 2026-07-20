import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAdminNotifications,
  getNotificationStats,
  markNotificationAsRead,
  deleteNotification
} from '../controllers/adminNotificationController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get admin's notifications
router.get('/', getAdminNotifications);

// Get notification stats
router.get('/stats', getNotificationStats);

// Mark notification as read
router.put('/:notificationId/read', markNotificationAsRead);

// Delete notification
router.delete('/:notificationId', deleteNotification);

export default router;
