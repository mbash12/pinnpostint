import { Router } from 'express';
import {
  getPublicCategories,
  getPublicLocations,
  getCategorySubcategories,
  getCategoryAttributes,
  getSubcategoryAttributes,
  getPublicAds,
  getPublicAdDetails,
  getFeaturedAds,
  getRecommendedAds,
  getFeaturedCategories,
  getPublicSettings,
  getPublicSystemSettings,
  getPublicUserById,
  getPublicUserAds,
  getHeroSettings,
  getPublicStates,
  getPublicCities,
  getPublicPostalCodes,
  getPublicCategoryById,
  googlePlacesAutocomplete,
  getGooglePlaceDetails,
  googleReverseGeocode,
  notifyAdRenewalInterest
} from '../controllers/publicController';
import { getUserPublicStats } from '../controllers/userController';
import { getActivePlatformAds } from '../controllers/platformAdController';
import { recordAdView, recordAdShare } from '../controllers/adController';
import { authenticate, optionalAuthenticate } from '../middleware/auth';

const router = Router();

// Public settings routes
router.get('/settings', getPublicSettings);
router.get('/system-settings', getPublicSystemSettings);
router.get('/hero-settings', getHeroSettings);

// Public platform ads routes
router.get('/platform-ads', getActivePlatformAds);

// Public category routes
router.get('/categories', getPublicCategories);
router.get('/categories/featured', getFeaturedCategories);
router.get('/categories/:categoryId', getPublicCategoryById);
router.get('/categories/:categoryId/subcategories', getCategorySubcategories);
router.get('/categories/:categoryId/attributes', getCategoryAttributes);
router.get('/subcategories/:subcategoryId/attributes', getSubcategoryAttributes);

// Public location routes
router.get('/locations', getPublicLocations);
router.get('/states', getPublicStates);
router.get('/cities', getPublicCities);
router.get('/postal-codes', getPublicPostalCodes);

// Google Places Proxy (Avoids CORS on Web)
router.get('/places/autocomplete', googlePlacesAutocomplete);
router.get('/places/details', getGooglePlaceDetails);
router.get('/places/reverse-geocode', googleReverseGeocode);

// Public user routes
router.get('/users/:userId', getPublicUserById);
router.get('/users/:userId/ads', getPublicUserAds);
router.get('/users/:userId/stats', getUserPublicStats);

// Public ad routes - with optional auth to include favorite status
router.get('/ads', optionalAuthenticate, getPublicAds);
router.get('/ads/featured', optionalAuthenticate, getFeaturedAds);
router.get('/ads/recommended', optionalAuthenticate, getRecommendedAds); // Optional auth for personalized recommendations
router.get('/ads/slug/:slug', optionalAuthenticate, getPublicAdDetails); // Get ad by slug
router.get('/ads/:adId', optionalAuthenticate, getPublicAdDetails);

// Ad stats collection routes (public)
router.post('/ads/:adId/view', recordAdView);
router.post('/ads/:adId/share', recordAdShare);
router.post('/ads/:adId/notify-renewal-interest', notifyAdRenewalInterest);

export default router;
