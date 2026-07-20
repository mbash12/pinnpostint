import { Router } from 'express';
import {
  getAllPlatformAds,
  getPlatformAdById,
  createPlatformAd,
  updatePlatformAd,
  deletePlatformAd
} from '../controllers/platformAdController';
import { adminAuth } from '../middleware/auth';

const router = Router();

// Apply admin authentication to all routes
router.use(adminAuth as any);

/**
 * @swagger
 * tags:
 *   name: Admin Platform Ads
 *   description: Platform ads management for admins
 */

/**
 * @swagger
 * /admin/platform-ads:
 *   get:
 *     tags: [Admin Platform Ads]
 *     summary: Get all platform ads
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all platform ads
 */
router.get('/', getAllPlatformAds);

/**
 * @swagger
 * /admin/platform-ads/{id}:
 *   get:
 *     tags: [Admin Platform Ads]
 *     summary: Get a platform ad by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Platform ad details
 */
router.get('/:id', getPlatformAdById);

/**
 * @swagger
 * /admin/platform-ads:
 *   post:
 *     tags: [Admin Platform Ads]
 *     summary: Create a new platform ad
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageUrl
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               linkUrl:
 *                 type: string
 *               position:
 *                 type: string
 *                 enum: [LEFT, RIGHT, TOP, BOTTOM, POPUP]
 *               type:
 *                 type: string
 *                 default: IMAGE
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               order:
 *                 type: number
 *                 default: 0
 *     responses:
 *       201:
 *         description: Platform ad created successfully
 */
router.post('/', createPlatformAd);

/**
 * @swagger
 * /admin/platform-ads/{id}:
 *   put:
 *     tags: [Admin Platform Ads]
 *     summary: Update a platform ad
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Platform ad updated successfully
 */
router.put('/:id', updatePlatformAd);

/**
 * @swagger
 * /admin/platform-ads/{id}:
 *   delete:
 *     tags: [Admin Platform Ads]
 *     summary: Delete a platform ad
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Platform ad deleted successfully
 */
router.delete('/:id', deletePlatformAd);

export default router;
