import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  getAllLandingPages,
  getLandingPageBySection,
  updateLandingPage,
  deleteLandingPage
} from '../controllers/landingPageController';

const router = express.Router();

// Admin routes - require authentication and admin role
router.get('/admin/landing-pages', authenticate, requireAdmin, getAllLandingPages);
router.get('/admin/landing-pages/:sectionKey', authenticate, requireAdmin, getLandingPageBySection);
router.put('/admin/landing-pages/:sectionKey', authenticate, requireAdmin, updateLandingPage);
router.delete('/admin/landing-pages/:sectionKey', authenticate, requireAdmin, deleteLandingPage);

export default router;