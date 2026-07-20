import { Router } from 'express';
import { 
  requestOtp, 
  verifyOtp, 
  cleanupExpiredOtps 
} from '../controllers/otpController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Public OTP endpoints
router.post('/request', requestOtp);
router.post('/verify', verifyOtp);

// Admin endpoint for cleanup
router.post('/cleanup', authenticate, requireAdmin, cleanupExpiredOtps);

export default router;