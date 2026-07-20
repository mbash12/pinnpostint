/**
 * Recent Locations Routes
 * API endpoints for managing user's recent locations
 */

import { Router } from 'express';
import { RecentLocationController } from '../controllers/recentLocationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/user/recent-locations
 * @desc    Get all recent locations for the authenticated user
 * @access  Private
 * @query   limit - Number of locations to return (default: 10)
 */
router.get('/', RecentLocationController.getRecentLocations);

/**
 * @route   POST /api/user/recent-locations
 * @desc    Create or update a recent location
 * @access  Private
 * @body     CreateRecentLocationRequest
 */
router.post('/', RecentLocationController.createRecentLocation);

/**
 * @route   GET /api/user/recent-locations/:id
 * @desc    Get a specific recent location by ID
 * @access  Private
 */
router.get('/:id', RecentLocationController.getRecentLocationById);

/**
 * @route   PATCH /api/user/recent-locations/:id/use
 * @desc    Update location usage count and timestamp
 * @access  Private
 */
router.patch('/:id/use', RecentLocationController.updateLocationUsage);

/**
 * @route   DELETE /api/user/recent-locations/:id
 * @desc    Delete a specific recent location
 * @access  Private
 */
router.delete('/:id', RecentLocationController.deleteRecentLocation);

/**
 * @route   DELETE /api/user/recent-locations
 * @desc    Clear all recent locations for the user
 * @access  Private
 */
router.delete('/', RecentLocationController.clearRecentLocations);

export default router;