import { Router } from 'express';
import {
  adminLogin,
  adminForgotPassword,
  adminVerifyResetOtp,
  adminResetPassword,
  getAdminProfile,
  updateAdminProfile,
  changePassword
} from '../controllers/adminAuthController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Admin login
router.post('/admin/login', adminLogin);

// Admin password reset flow
router.post('/admin/password/forgot', adminForgotPassword);
router.post('/admin/password/verify-reset-otp', adminVerifyResetOtp);
router.post('/admin/password/reset', adminResetPassword);

// Admin profile management (requires authentication and admin role)
router.get('/admin/profile', authenticate, requireAdmin, getAdminProfile);
router.put('/admin/profile', authenticate, requireAdmin, updateAdminProfile);

// Admin change password (requires authentication and admin role)
router.put('/admin/change-password', authenticate, requireAdmin, changePassword);

export default router;
