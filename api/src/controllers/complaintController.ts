import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { Prisma } from '@prisma/client';
import Joi from 'joi';
import {
  queueNotification,
  queueAdminNotifications
} from '../background/queues/notification.queue';
import { createTransferForBookingRefund } from './transferController';

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    phone: string;
  };
}

// Validation schemas
const bookingIdSchema = Joi.object({
  bookingId: Joi.string().uuid().required(),
});

const createComplaintSchema = Joi.object({
  description: Joi.string().min(10).max(2000).required(),
});

const complaintIdSchema = Joi.object({
  complaintId: Joi.string().uuid().required(),
});

const updateComplaintStatusSchema = Joi.object({
  status: Joi.string().valid('INVESTIGATING', 'RESOLVED', 'REJECTED').required(),
  resolutionNote: Joi.string().max(1000).optional(),
});

const getComplaintsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('OPEN', 'INVESTIGATING', 'RESOLVED', 'REJECTED').allow(''),
  sortBy: Joi.string().valid('createdAt', 'updatedAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

/**
 * @swagger
 * /api/v1/bookings/{bookingId}/complaint:
 *   post:
 *     summary: File a complaint against a booking
 *     tags: [Complaints]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *             properties:
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *                 description: Detailed description of the complaint
 *     responses:
 *       201:
 *         description: Complaint filed successfully
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
 *                   example: 'Complaint filed successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *       400:
 *         description: Validation error or business rule violation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const createComplaint = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error: paramsError, value: paramsValue } = bookingIdSchema.validate(req.params);
    if (paramsError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsError.details[0].message
        }
      });
      return;
    }

    const { error: bodyError, value: bodyValue } = createComplaintSchema.validate(req.body);
    if (bodyError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: bodyError.details[0].message
        }
      });
      return;
    }

    const { bookingId } = paramsValue;
    const { description } = bodyValue;
    const userId = req.user!.id;

    // Find booking with ad info
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        ad: {
          select: {
            userId: true,
            title: true,
          }
        }
      }
    });

    if (!booking) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'Booking not found'
        }
      });
      return;
    }

    // Check if user owns the booking (is the buyer)
    if (booking.userId !== userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only file complaints for your own bookings'
        }
      });
      return;
    }

    // Check if complaint already exists for this booking
    const existingComplaint = await prisma.complaint.findFirst({
      where: { bookingId }
    });

    if (existingComplaint) {
      res.status(400).json({
        success: false,
        error: {
          code: 'COMPLAINT_EXISTS',
          message: 'A complaint already exists for this booking'
        }
      });
      return;
    }

    // Create complaint with initial message to auto-start discussion
    const complaint = await prisma.complaint.create({
      data: {
        bookingId,
        reporterId: userId,
        respondentId: booking.ad.userId,
        description,
        status: 'OPEN',
        messages: {
          create: {
            senderId: userId,
            senderType: 'REPORTER',
            message: description,
          }
        }
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      }
    });

    // Notify the seller (respondent)
    queueNotification(
      booking.ad.userId,
      `New Complaint Filed`,
      `A complaint has been filed against your booking for "${booking.ad.title}"`,
      'COMPLAINT',
      {
        complaintId: complaint.id,
        bookingId,
      }
    ).catch(err => console.error('Failed to queue complaint notification:', err));

    // Notify all admins
    queueAdminNotifications(
      'New Complaint Filed',
      `A new complaint has been filed for booking "${booking.ad.title}"`,
      'COMPLAINT',
      {
        complaintId: complaint.id,
        bookingId,
      }
    ).catch(err => console.error('Failed to queue admin notifications:', err));

    res.status(201).json({
      success: true,
      message: 'Complaint filed successfully. Our team will review it shortly.',
      data: complaint
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/complaints/received:
 *   get:
 *     summary: Get complaints received against my bookings (for sellers)
 *     tags: [Complaints]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of complaints per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, INVESTIGATING, RESOLVED, REJECTED, DISMISSED]
 *         description: Filter by complaint status
 *     responses:
 *       200:
 *         description: Complaints retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       description:
 *                         type: string
 *                       status:
 *                         type: string
 *                       respondentResponse:
 *                         type: string
 *                         nullable: true
 *                       booking:
 *                         type: object
 *                       reporter:
 *                         type: object
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getReceivedComplaints = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = getComplaintsQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    const { page, limit, status, sortBy, sortOrder } = value;
    const userId = req.user!.id;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ComplaintWhereInput = { respondentId: userId };
    if (status) where.status = status;

    // Get total count
    const total = await prisma.complaint.count({ where });

    // Get complaints
    const complaints = await prisma.complaint.findMany({
      where,
      select: {
        id: true,
        description: true,
        status: true,
        resolutionNote: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            messages: true
          }
        },
        booking: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            ad: {
              select: {
                title: true,
              }
            }
          }
        },
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          }
        },
      },
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder
      }
    });

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: complaints,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/complaints:
 *   get:
 *     summary: Get all complaints (Admin only)
 *     tags: [Admin - Complaints]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of complaints per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, INVESTIGATING, RESOLVED, REJECTED, DISMISSED]
 *         description: Filter by complaint status
 *     responses:
 *       200:
 *         description: Complaints retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: User is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getAllComplaints = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Verify user is admin
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can access this resource'
        }
      });
      return;
    }

    const { error, value } = getComplaintsQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    const { page, limit, status, sortBy, sortOrder } = value;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ComplaintWhereInput = {};
    if (status) where.status = status;

    // Get total count
    const total = await prisma.complaint.count({ where });

    // Get complaints
    const complaints = await prisma.complaint.findMany({
      where,
      select: {
        id: true,
        description: true,
        status: true,
        resolutionNote: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            messages: true
          }
        },
        booking: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            notes: true,
            ad: {
              select: {
                id: true,
                title: true,
              }
            }
          }
        },
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          }
        },
        respondent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          }
        },
        adminResolver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
      },
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder
      }
    });

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: complaints,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/complaints/{complaintId}:
 *   get:
 *     summary: Get complaint details (Admin only)
 *     tags: [Admin - Complaints]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: complaintId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Complaint ID
 *     responses:
 *       200:
 *         description: Complaint details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: User is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Complaint not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getComplaintById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Verify user is admin
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can access this resource'
        }
      });
      return;
    }

    const { error, value } = complaintIdSchema.validate(req.params);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    const { complaintId } = value;

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        booking: {
          include: {
            ad: {
              select: {
                id: true,
                title: true,
                price: true,
              }
            }
          }
        },
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          }
        },
        respondent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          }
        },
        adminResolver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
      }
    });

    if (!complaint) {
      res.status(404).json({
        success: false,
        error: {
          code: 'COMPLAINT_NOT_FOUND',
          message: 'Complaint not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: complaint
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/complaints/{complaintId}/status:
 *   put:
 *     summary: Update complaint status (Admin only)
 *     tags: [Admin - Complaints]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: complaintId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Complaint ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [INVESTIGATING, RESOLVED, REJECTED, DISMISSED]
 *               resolutionNote:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Notes explaining the resolution
 *     responses:
 *       200:
 *         description: Complaint status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: User is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Complaint not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const updateComplaintStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Verify user is admin
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can update complaint status'
        }
      });
      return;
    }

    const { error: paramsError, value: paramsValue } = complaintIdSchema.validate(req.params);
    if (paramsError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsError.details[0].message
        }
      });
      return;
    }

    const { error: bodyError, value: bodyValue } = updateComplaintStatusSchema.validate(req.body);
    if (bodyError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: bodyError.details[0].message
        }
      });
      return;
    }

    const { complaintId } = paramsValue;
    const { status, resolutionNote } = bodyValue;
    const adminId = req.user!.id;

    // Check if complaint exists
    const existingComplaint = await prisma.complaint.findUnique({
      where: { id: complaintId }
    });

    if (!existingComplaint) {
      res.status(404).json({
        success: false,
        error: {
          code: 'COMPLAINT_NOT_FOUND',
          message: 'Complaint not found'
        }
      });
      return;
    }

    // Update complaint
    const updatedComplaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status,
        resolutionNote,
        adminResolvedBy: adminId,
      },
      select: {
        id: true,
        status: true,
        resolutionNote: true,
      }
    });

    // Get complaint details for notifications
    const complaintDetails = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        booking: {
          select: {
            ad: {
              select: {
                title: true,
              }
            }
          }
        }
      }
    });

    // Notify both parties
    const notificationTitle: Record<string, string> = {
      INVESTIGATING: 'Complaint Under Investigation',
      RESOLVED: 'Complaint Resolved',
      REJECTED: 'Complaint Rejected',
    };

    const notificationMessages: Record<string, string> = {
      INVESTIGATING: 'Your complaint is now under investigation.',
      RESOLVED: resolutionNote || 'Your complaint has been resolved.',
      REJECTED: resolutionNote || 'Your complaint has been rejected.',
    };

    // Notify reporter
    queueNotification(
      existingComplaint.reporterId,
      notificationTitle[status],
      notificationMessages[status],
      'COMPLAINT_UPDATE',
      {
        complaintId: complaintId,
      }
    ).catch(err => console.error('Failed to queue notification:', err));

    // Notify respondent
    queueNotification(
      existingComplaint.respondentId,
      notificationTitle[status],
      notificationMessages[status],
      'COMPLAINT_UPDATE',
      {
        complaintId: complaintId,
      }
    ).catch(err => console.error('Failed to queue notification:', err));

    res.status(200).json({
      success: true,
      message: 'Complaint status updated successfully',
      data: updatedComplaint
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/complaints/{complaintId}/resolve-with-refund:
 *   post:
 *     summary: Resolve complaint with refund
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resolutionNote:
 *                 type: string
 *                 description: Resolution note
 *                 example: "After reviewing the evidence, we've decided to issue a refund to the customer."
 *     responses:
 *       200:
 *         description: Complaint resolved with refund successfully
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
 *                   example: "Complaint resolved with refund successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Complaint'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Complaint not found
 */
export const resolveWithRefund = async (req: Request, res: Response) => {
  try {
    const { error: paramsError, value: paramsValue } = complaintIdSchema.validate(req.params);
    if (paramsError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsError.details[0].message,
        },
      });
    }

    const { error: bodyError, value: bodyValue } = Joi.object({
      resolutionNote: Joi.string().allow('').max(1000),
    }).validate(req.body);

    if (bodyError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: bodyError.details[0].message,
        },
      });
    }

    const { complaintId } = paramsValue;
    const { resolutionNote } = bodyValue;
    const userId = (req as any).user.id;

    // Check if complaint exists
    const existingComplaint = await prisma.complaint.findUnique({
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

    if (!existingComplaint) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COMPLAINT_NOT_FOUND',
          message: 'Complaint not found',
        },
      });
    }

    // Check if user is authorized to resolve this complaint
    // Only the respondent (seller) or admin can resolve
    const isAdmin = (req as any).user.role === 'ADMIN';
    const isRespondent = existingComplaint.respondentId === userId;

    if (!isAdmin && !isRespondent) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to resolve this complaint',
        },
      });
    }

    // Update complaint status to RESOLVED
    const updatedComplaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: 'RESOLVED',
        resolutionNote: resolutionNote || null,
        adminResolvedBy: userId, // Store the ID of whoever resolved it (could be seller or admin)
        updatedAt: new Date(),
      },
      include: {
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        respondent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        adminResolver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        booking: {
          include: {
            ad: true
          }
        }
      }
    });

    // Send notification to reporter (customer)
    await prisma.notification.create({
      data: {
        userId: existingComplaint.reporterId,
        title: 'Complaint Resolved with Refund',
        message: resolutionNote || `Your complaint regarding "${existingComplaint.booking.ad.title}" has been resolved with a refund.`,
        type: 'COMPLAINT_UPDATE',
        data: {
          complaintId: updatedComplaint.id,
        }
      }
    }).catch(err => console.error('Failed to queue complaint resolution notification:', err));

    // Send notification to respondent (seller)
    if (existingComplaint.respondentId) {
      await prisma.notification.create({
        data: {
          userId: existingComplaint.respondentId,
          title: 'Complaint Resolved with Refund',
          message: `Complaint regarding "${existingComplaint.booking.ad.title}" has been resolved with a refund.`,
          type: 'COMPLAINT_UPDATE',
          data: {
            complaintId: updatedComplaint.id,
          }
        }
      }).catch(err => console.error('Failed to queue complaint resolution notification to seller:', err));
    }

    // Create transfer record for the refund
    try {
      // Get the transaction amount from the booking
      const bookingTransaction = await prisma.transaction.findFirst({
        where: { bookingId: existingComplaint.bookingId },
        orderBy: { createdAt: 'desc' }
      });

      if (bookingTransaction) {
        await createTransferForBookingRefund({
          bookingId: existingComplaint.bookingId,
          transactionId: bookingTransaction.id,
          amount: Number(bookingTransaction.amount),
          description: `Refund for resolved complaint: ${resolutionNote || 'Customer dispute resolved in favor of buyer'}`,
        });
      }
    } catch (transferError) {
      console.error('Failed to create transfer record:', transferError);
      // Don't fail the request if transfer creation fails
    }

    return res.status(200).json({
      success: true,
      message: 'Complaint resolved with refund successfully',
      data: updatedComplaint
    });
  } catch (error: any) {
    console.error('Error resolving complaint with refund:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while resolving the complaint',
      },
    });
  }
};

/**
 * @swagger
 * /api/v1/complaints/{complaintId}/close:
 *   post:
 *     summary: Close complaint (by reporter/buyer only)
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               closeNote:
 *                 type: string
 *                 description: Optional note explaining why the complaint is being closed
 *                 example: "Issue has been resolved satisfactorily"
 *     responses:
 *       200:
 *         description: Complaint closed successfully
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
 *                   example: "Complaint closed successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Complaint'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not authorized to close this complaint
 *       404:
 *         description: Complaint not found
 */
export const closeComplaint = async (req: Request, res: Response) => {
  try {
    const { error: paramsError, value: paramsValue } = complaintIdSchema.validate(req.params);
    if (paramsError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsError.details[0].message,
        },
      });
    }

    const { error: bodyError, value: bodyValue } = Joi.object({
      closeNote: Joi.string().allow('').max(1000),
    }).validate(req.body);

    if (bodyError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: bodyError.details[0].message,
        },
      });
    }

    const { complaintId } = paramsValue;
    const { closeNote } = bodyValue;
    const userId = (req as any).user.id;

    // Check if complaint exists
    const existingComplaint = await prisma.complaint.findUnique({
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

    if (!existingComplaint) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COMPLAINT_NOT_FOUND',
          message: 'Complaint not found',
        },
      });
    }

    // Only the reporter (buyer) or admin can close the complaint
    const isAdmin = (req as any).user.role === 'ADMIN';
    const isReporter = existingComplaint.reporterId === userId;

    if (!isAdmin && !isReporter) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to close this complaint',
        },
      });
    }

    // Update complaint status to RESOLVED
    const updatedComplaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: 'RESOLVED',
        resolutionNote: closeNote || 'Complaint closed by buyer',
        adminResolvedBy: isAdmin ? userId : null,
        updatedAt: new Date(),
      },
      include: {
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        respondent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        adminResolver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        booking: {
          include: {
            ad: true
          }
        }
      }
    });

    // Notify the respondent (seller)
    await prisma.notification.create({
      data: {
        userId: existingComplaint.respondentId,
        title: 'Complaint Closed',
        message: closeNote || `The complaint regarding "${existingComplaint.booking.ad.title}" has been closed.`,
        type: 'COMPLAINT_UPDATE',
        data: {
          complaintId: updatedComplaint.id,
        }
      }
    }).catch(err => console.error('Failed to queue complaint closure notification:', err));

    // Notify admin if closed by buyer (not admin)
    if (!isAdmin) {
      queueAdminNotifications(
        'Complaint Closed by Buyer',
        `The complaint regarding "${existingComplaint.booking.ad.title}" has been closed by the buyer.`,
        'COMPLAINT_UPDATE',
        {
          complaintId: updatedComplaint.id,
        }
      ).catch(err => console.error('Failed to queue admin notification:', err));
    }

    return res.status(200).json({
      success: true,
      message: 'Complaint closed successfully',
      data: updatedComplaint
    });
  } catch (error: any) {
    console.error('Error closing complaint:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while closing the complaint',
      },
    });
  }
};

/**
 * @swagger
 * /api/v1/complaints/{complaintId}/complete:
 *   post:
 *     summary: Complete complaint without refund
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resolutionNote:
 *                 type: string
 *                 description: Resolution note
 *                 example: "After reviewing the evidence, we've decided that no refund is necessary."
 *     responses:
 *       200:
 *         description: Complaint completed without refund successfully
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
 *                   example: "Complaint completed without refund successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Complaint'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Complaint not found
 */
export const completeWithoutRefund = async (req: Request, res: Response) => {
  try {
    const { error: paramsError, value: paramsValue } = complaintIdSchema.validate(req.params);
    if (paramsError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsError.details[0].message,
        },
      });
    }

    const { error: bodyError, value: bodyValue } = Joi.object({
      resolutionNote: Joi.string().allow('').max(1000),
    }).validate(req.body);

    if (bodyError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: bodyError.details[0].message,
        },
      });
    }

    const { complaintId } = paramsValue;
    const { resolutionNote } = bodyValue;
    const userId = (req as any).user.id;

    // Check if complaint exists
    const existingComplaint = await prisma.complaint.findUnique({
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

    if (!existingComplaint) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COMPLAINT_NOT_FOUND',
          message: 'Complaint not found',
        },
      });
    }

    // Check if user is authorized to complete this complaint
    // Only the respondent (seller) or admin can complete
    const isAdmin = (req as any).user.role === 'ADMIN';
    const isRespondent = existingComplaint.respondentId === userId;

    if (!isAdmin && !isRespondent) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to complete this complaint',
        },
      });
    }

    // Update complaint status to COMPLETED (we'll use RESOLVED status but without refund indication)
    const updatedComplaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: 'RESOLVED', // Using RESOLVED status but with different context
        resolutionNote: resolutionNote || null,
        adminResolvedBy: userId, // Store the ID of whoever resolved it (could be seller or admin)
        updatedAt: new Date(),
      },
      include: {
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        respondent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        adminResolver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        booking: {
          include: {
            ad: true
          }
        }
      }
    });

    // Send notification to reporter (customer)
    await prisma.notification.create({
      data: {
        userId: existingComplaint.reporterId,
        title: 'Complaint Completed Without Refund',
        message: resolutionNote || `Your complaint regarding "${existingComplaint.booking.ad.title}" has been reviewed and completed without a refund.`,
        type: 'COMPLAINT_UPDATE',
        data: {
          complaintId: updatedComplaint.id,
        }
      }
    }).catch(err => console.error('Failed to queue complaint completion notification:', err));

    // Send notification to respondent (seller)
    if (existingComplaint.respondentId) {
      await prisma.notification.create({
        data: {
          userId: existingComplaint.respondentId,
          title: 'Complaint Completed Without Refund',
          message: `Complaint regarding "${existingComplaint.booking.ad.title}" has been completed without a refund.`,
          type: 'COMPLAINT_UPDATE',
          data: {
            complaintId: updatedComplaint.id,
          }
        }
      }).catch(err => console.error('Failed to queue complaint completion notification to seller:', err));
    }

    return res.status(200).json({
      success: true,
      message: 'Complaint completed without refund successfully',
      data: updatedComplaint
    });
  } catch (error: any) {
    console.error('Error completing complaint without refund:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while completing the complaint',
      },
    });
  }
};
