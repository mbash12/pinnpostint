import { Router } from 'express';
import {
  register,
  verifyRegistrationOtp,
  completeRegistration,
  login,
  forgotPassword,
  verifyResetOtp,
  resetPassword
} from '../controllers/authController';

const router = Router();

// Registration flow
router.post('/register', register);
router.post('/registration/verify-otp', verifyRegistrationOtp);
router.post('/registration/complete', completeRegistration);

// Login
router.post('/login', login);

// Password reset flow
router.post('/password/forgot', forgotPassword);
router.post('/password/verify-reset-otp', verifyResetOtp);
router.post('/password/reset', resetPassword);

export default router;