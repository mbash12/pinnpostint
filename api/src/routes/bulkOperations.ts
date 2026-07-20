import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  bulkUpdateAdStatus,
  bulkSendNotifications,
  cleanupExpired,
  cleanupNotifications
} from '../controllers/bulkOperationsController';

const router = Router();

// All bulk operations routes require admin authentication
router.use(authenticate);
router.use(requireAdmin);

// Bulk operations routes
router.put('/ads/status', bulkUpdateAdStatus);
router.post('/users/notifications', bulkSendNotifications);
router.delete('/cleanup/expired', cleanupExpired);
router.delete('/cleanup/notifications', cleanupNotifications);

export default router;