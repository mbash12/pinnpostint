import { Router } from 'express';
import {
  getCurrentUser,
  updateCurrentUser,
  updateFcmToken,
  deleteFcmToken,
  addUserLocation,
  getUserLocations,
  updateUserLocation,
  removeUserLocation,
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  changeUserPassword,
  deleteAccount
} from '../controllers/userController';
import { 
  getNotificationPreferences, 
  updateNotificationPreferences 
} from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// User profile routes
router.get('/me', getCurrentUser);
router.put('/me', updateCurrentUser);
router.delete('/me', deleteAccount);
router.put('/me/fcm-token', updateFcmToken);
router.delete('/me/fcm-token', deleteFcmToken);
router.put('/change-password', changeUserPassword);

// User location routes
router.post('/me/locations', addUserLocation);
router.get('/me/locations', getUserLocations);
router.put('/me/locations/:locationId', updateUserLocation);
router.delete('/me/locations/:locationId', removeUserLocation);

// User wishlist routes
router.post('/me/wishlist', addToWishlist);
router.get('/me/wishlist', getWishlist);
router.delete('/me/wishlist/:adId', removeFromWishlist);

// User notification routes
router.get('/me/notifications', getUserNotifications);
router.put('/me/notifications/:notificationId/read', markNotificationAsRead);
router.put('/me/notifications/mark-all-read', markAllNotificationsAsRead);
router.delete('/me/notifications/:notificationId', deleteNotification);

// User notification preferences routes
router.get('/me/notification-preferences', getNotificationPreferences);
router.put('/me/notification-preferences', updateNotificationPreferences);

export default router;