import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import Joi from 'joi';

const sendMessageSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required(),
});

const complaintMessageIdSchema = Joi.object({
  complaintId: Joi.string().uuid().required(),
  messageId: Joi.string().uuid().required(),
});

/**
 * @swagger
 * /api/v1/complaints/{complaintId}/messages:
 *   post:
 *     summary: Send a message in complaint discussion
 *     tags: [Complaints]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: complaintId
 *         in: path
 *         required: true
 *         description: Complaint ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Message content
 *                 example: "I'd like to discuss the details of this complaint."
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Message sent successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ComplaintMessage'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Complaint not found
 */
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { error: bodyError, value: bodyValue } = sendMessageSchema.validate(req.body);
    if (bodyError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: bodyError.details[0].message,
        },
      });
    }

    // Note: complaintMessageIdSchema has both complaintId and messageId, but we only need complaintId
    // So we'll validate just the complaintId parameter
    const complaintIdParamSchema = Joi.object({
      complaintId: Joi.string().uuid().required(),
    });
    
    const { error: paramsError, value: paramsValue } = complaintIdParamSchema.validate(req.params);
    if (paramsError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsError.details[0].message,
        },
      });
    }

    const { complaintId } = paramsValue;
    const { message } = bodyValue;
    const userId = (req as any).user.id;

    // Check if complaint exists and user has access
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        reporter: true,
        respondent: true,
        booking: {
          include: {
            ad: true
          }
        }
      }
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COMPLAINT_NOT_FOUND',
          message: 'Complaint not found',
        },
      });
    }

    // Determine sender type based on user's role in the complaint
    let senderType: 'REPORTER' | 'RESPONDENT' | 'ADMIN' = 'ADMIN'; // Default to admin
    
    if (userId === complaint.reporterId) {
      senderType = 'REPORTER';
    } else if (userId === complaint.respondentId) {
      senderType = 'RESPONDENT';
    } else {
      // Could be an admin or other authorized user
      // For now, we'll allow any authenticated user to participate in the discussion
      senderType = 'ADMIN';
    }

    // Create the message
    const complaintMessage = await prisma.complaintMessage.create({
      data: {
        complaintId,
        senderId: userId,
        senderType,
        message,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    // Auto-update complaint status to INVESTIGATING if it's still OPEN
    // This indicates active discussion has started
    let statusChanged = false;
    if (complaint.status === 'OPEN') {
      await prisma.complaint.update({
        where: { id: complaintId },
        data: { status: 'INVESTIGATING' }
      });
      statusChanged = true;
    }

    // Send notification to other participants
    const recipients: string[] = [];
    if (userId !== complaint.reporterId) {
      recipients.push(complaint.reporterId);
    }
    if (complaint.respondentId && userId !== complaint.respondentId) {
      recipients.push(complaint.respondentId);
    }

    // Include status change info in notification
    const notificationMessage = statusChanged
      ? 'Complaint discussion has started and status updated to Investigating'
      : 'New message in complaint discussion';

    // Queue notifications for recipients
    for (const recipientId of recipients) {
      await prisma.notification.create({
        data: {
          userId: recipientId,
          title: statusChanged ? 'Complaint Discussion Started' : 'New Complaint Message',
          message: notificationMessage,
          type: 'COMPLAINT_UPDATE',
          data: {
            complaintId: complaint.id,
            complaintMessageId: complaintMessage.id,
          }
        }
      }).catch(err => console.error('Failed to queue complaint message notification:', err));
    }

    return res.status(201).json({
      success: true,
      message: statusChanged
        ? 'Message sent and complaint status updated to Investigating'
        : 'Message sent successfully',
      data: complaintMessage
    });
  } catch (error: any) {
    console.error('Error sending complaint message:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while sending the message',
      },
    });
  }
};

/**
 * @swagger
 * /api/v1/complaints/{complaintId}/messages:
 *   get:
 *     summary: Get messages for a complaint
 *     tags: [Complaints]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: complaintId
 *         in: path
 *         required: true
 *         description: Complaint ID
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ComplaintMessage'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Complaint not found
 */
export const getComplaintMessages = async (req: Request, res: Response) => {
  try {
    // Validate just the complaintId parameter
    const complaintIdParamSchema = Joi.object({
      complaintId: Joi.string().uuid().required(),
    });
    
    const { error, value } = complaintIdParamSchema.validate(req.params);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const { complaintId } = value;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Check if user has access to this complaint
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: {
        reporterId: true,
        respondentId: true,
        adminResolvedBy: true
      }
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COMPLAINT_NOT_FOUND',
          message: 'Complaint not found',
        },
      });
    }

    // Check if user is authorized to view messages
    // Admins can view any complaint messages
    const isAdmin = userRole === 'ADMIN';
    const isParticipant =
      userId === complaint.reporterId ||
      userId === complaint.respondentId ||
      userId === complaint.adminResolvedBy;

    if (!isAdmin && !isParticipant) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to view messages for this complaint',
        },
      });
    }

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    // Get messages
    const messages = await prisma.complaintMessage.findMany({
      where: { complaintId },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
    });

    // Get total count for pagination
    const total = await prisma.complaintMessage.count({
      where: { complaintId },
    });

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    });
  } catch (error: any) {
    console.error('Error getting complaint messages:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving messages',
      },
    });
  }
};