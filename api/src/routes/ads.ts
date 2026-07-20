import { Router } from 'express';
import {
  createAd,
  getMyAds,
  getMyAdDetails,
  updateMyAd,
  deleteMyAd,
  getAdBookings,
  getAdStats,
  unpublishAd,
  republishAd
} from '../controllers/adController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All ad routes require authentication
router.use(authenticate);

// User ad routes
router.post('/me/ads', createAd);
router.get('/me/ads', getMyAds);
router.get('/me/ads/:adId', getMyAdDetails);
router.get('/me/ads/:adId/bookings', getAdBookings);
router.get('/me/ads/:adId/stats', getAdStats);
router.put('/me/ads/:adId', updateMyAd);
router.delete('/me/ads/:adId', deleteMyAd);

// Unpublish/Republish routes
router.post('/me/ads/:adId/unpublish', unpublishAd);
router.post('/me/ads/:adId/republish', republishAd);

export default router;