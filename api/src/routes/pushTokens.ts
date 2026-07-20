import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  registerPushToken,
  unregisterPushToken,
  getUserPushTokens,
  updateTokenLastUsed
} from '../controllers/pushTokenController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Register a new push token
router.post('/', registerPushToken);

// Get user's push tokens
router.get('/', getUserPushTokens);

// Update token last used (heartbeat)
router.put('/:token/heartbeat', updateTokenLastUsed);

// Unregister a push token
router.delete('/:token', unregisterPushToken);

export default router;
