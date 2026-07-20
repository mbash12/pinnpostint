import express from 'express';
import { getPublicLandingPage } from '../controllers/landingPageController';

const router = express.Router();

// Public route - no authentication required
router.get('/public/landing-pages/:sectionKey', getPublicLandingPage);

export default router;