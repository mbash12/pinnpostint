import { Router } from 'express';
import * as chatController from '../controllers/chatController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Real-time messaging between users
 */

// All chat routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/chat/unread-count:
 *   get:
 *     summary: Get total unread message count
 *     description: Lightweight endpoint to get total unread messages across all conversations
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     unreadCount:
 *                       type: integer
 *                       example: 5
 */
router.get('/unread-count', chatController.getTotalUnreadCount);
router.get('/unread-by-peer', chatController.getUnreadByPeer);

/**
 * @swagger
 * /api/v1/chat/conversations:
 *   get:
 *     summary: List all conversations for the authenticated user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations
 */
router.get('/conversations', chatController.listConversations);

/**
 * @swagger
 * /api/v1/chat/initiate:
 *   get:
 *     summary: Resolve ad/recipient context for initiating a chat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: adSlug
 *         schema:
 *           type: string
 *       - in: query
 *         name: recipientId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ad and recipient data for starting a chat
 */
router.get('/initiate', chatController.initiateChat);

/**
 * @swagger
 * /api/v1/chat/conversations/{id}/messages:
 *   get:
 *     summary: Get messages for a specific conversation (cursor-paginated)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: before
 *         description: Return messages older than this message id (exclusive)
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         description: Max number of messages to return (1-100, default 50)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *     responses:
 *       200:
 *         description: Messages ordered oldest-first, plus cursor metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items:
 *                         type: object
 *                     hasMore:
 *                       type: boolean
 *                     nextCursor:
 *                       type: string
 *                       nullable: true
 */
router.get('/conversations/:id/messages', chatController.getMessages);

/**
 * @swagger
 * /api/v1/chat/messages:
 *   post:
 *     summary: Send a message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientId
 *             properties:
 *               recipientId:
 *                 type: string
 *               text:
 *                 type: string
 *               adId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message sent successfully
 */
router.post('/messages', chatController.sendMessage);

/**
 * @swagger
 * /api/v1/chat/conversations/{id}/read:
 *   patch:
 *     summary: Mark messages in a conversation as read
 *     tags: [Chat]
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
 *         description: Messages marked as read
 */
router.patch('/conversations/:id/read', chatController.markAsRead);

/**
 * @swagger
 * /api/v1/chat/conversations/all/delete:
 *   delete:
 *     summary: Delete all conversations for the authenticated user (testing only)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All conversations deleted
 */
router.delete('/conversations/all', chatController.deleteAllConversations);

export default router;
