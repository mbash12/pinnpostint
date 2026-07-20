import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateUserStatus,
  updateUserRole,
  updateUserVerification,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  createUser
} from '../controllers/adminUserController';
import { adminAuth } from '../middleware/auth';

const router = Router();

// All admin user routes require admin authentication
router.use(adminAuth);

// Admin user management routes
router.post('/users', createUser);
router.get('/users', getAllUsers);
router.get('/users/:userId', getUserById);
router.put('/users/:userId', updateUser);
router.delete('/users/:userId', deleteUser);
router.put('/users/:userId/status', updateUserStatus);
router.put('/users/:userId/role', updateUserRole);
router.put('/users/:userId/verification', updateUserVerification);
router.get('/users/:userId/notification-preferences', getUserNotificationPreferences);
router.put('/users/:userId/notification-preferences', updateUserNotificationPreferences);

export default router;