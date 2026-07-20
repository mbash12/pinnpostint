import { Router } from 'express';
import {
  getPendingAds,
  moderateAd,
  getAllAds,
  getAdDetails,
  updateAd,
  featureAd,
  deleteAd,
  flagAd,
  getAdStatsAdmin,
  getAdsWithPendingRevisions,
  reviewRevision,
  createAd
} from '../controllers/adminAdController';
import { getExpiredAds } from '../controllers/adController';
import { adminAuth } from '../middleware/auth';

const router = Router();

// All admin ad routes require admin authentication
router.use(adminAuth);

// Admin ad moderation routes
router.get('/ads/pending', getPendingAds);
router.put('/ads/:adId/status', moderateAd);

// Admin ad revision routes
router.get('/ads/revisions', getAdsWithPendingRevisions);
router.put('/ads/:adId/revisions/:revisionId', reviewRevision);

// Admin ad management routes
router.post('/ads', createAd);
router.get('/ads', getAllAds);
router.get('/ads/expired', getExpiredAds);
router.get('/ads/:adId', getAdDetails);
router.put('/ads/:adId', updateAd);
router.put('/ads/:adId/featured', featureAd);
router.put('/ads/:adId/flag', flagAd);
router.get('/ads/:adId/stats', getAdStatsAdmin);
router.delete('/ads/:adId', deleteAd);

export default router;