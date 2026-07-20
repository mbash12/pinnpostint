import { Router } from 'express';
import {
  // State routes
  createState,
  getAllStates,
  getStateById,
  updateState,
  deleteState,
  // City routes
  createCity,
  getAllCities,
  getCityById,
  updateCity,
  deleteCity,
  // Postal Code routes
  createPostalCode,
  getAllPostalCodes,
  getPostalCodeById,
  updatePostalCode,
  deletePostalCode
} from '../controllers/adminGranularLocationsController';

const router = Router();

// ========== STATE ROUTES ==========
router.post('/states', createState);
router.get('/states', getAllStates);
router.get('/states/:stateId', getStateById);
router.put('/states/:stateId', updateState);
router.delete('/states/:stateId', deleteState);

// ========== CITY ROUTES ==========
router.post('/cities', createCity);
router.get('/cities', getAllCities);
router.get('/cities/:cityId', getCityById);
router.put('/cities/:cityId', updateCity);
router.delete('/cities/:cityId', deleteCity);

// ========== POSTAL CODE ROUTES ==========
router.post('/postal-codes', createPostalCode);
router.get('/postal-codes', getAllPostalCodes);
router.get('/postal-codes/:postalCodeId', getPostalCodeById);
router.put('/postal-codes/:postalCodeId', updatePostalCode);
router.delete('/postal-codes/:postalCodeId', deletePostalCode);

export default router;
