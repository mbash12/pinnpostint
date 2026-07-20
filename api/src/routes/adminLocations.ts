import { Router } from 'express';
import {
  createLocation,
  getAllLocations,
  getLocationById,
  updateLocation,
  deleteLocation
} from '../controllers/adminLocationsController';

const router = Router();

// Admin Locations Routes
router.post('/', createLocation);
router.get('/', getAllLocations);
router.get('/:locationId', getLocationById);
router.put('/:locationId', updateLocation);
router.delete('/:locationId', deleteLocation);

export default router;