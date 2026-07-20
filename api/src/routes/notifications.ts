import { Router } from 'express';
import { sendNotification } from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// Admin notification routes
router.post('/send', sendNotification);

export default router;