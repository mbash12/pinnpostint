import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { Prisma } from '@prisma/client';
import Joi from 'joi';
import {
  queueBookingNotification,
  queueNotification,
  queueAdminNotifications
} from '../background/queues/notification.queue';
import { createTransferForBookingRefund, createTransferForBookingPayment } from './transferController';

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    phone: string;
  };
}

// Validation schemas
const createBookingSchema = Joi.object({
  adId: Joi.string().uuid().required(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  slotId: Joi.string().optional(),
  bookingDate: Joi.date().iso().optional(),
  notes: Joi.string().max(1000).allow('')
}).custom((value, helpers) => {
  // If slot-based booking
  if (value.slotId || value.bookingDate) {
    if (!value.slotId || !value.bookingDate) {
      return helpers.error('custom.missingSlotInfo');
    }
    return value;
  }

  // If date-range booking
  if (!value.startDate || !value.endDate) {
    return helpers.error('custom.missingDates');
  }

  if (new Date(value.startDate) >= new Date(value.endDate)) {
    return helpers.error('custom.invalidDateRange');
  }
  return value;
}, 'Booking validation').messages({
  'custom.invalidDateRange': 'End date must be after start date',
  'custom.missingSlotInfo': 'Both slot ID and booking date are required for slot-based bookings',
  'custom.missingDates': 'Start and end dates are required for standard bookings'
});

const bookingIdSchema = Joi.object({
  bookingId: Joi.string().uuid().required()
});

const getBookingsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('SUBMITTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED').allow(''),
  search: Joi.string().max(100).allow(''),
  sortBy: Joi.string().valid('createdAt', 'startDate', 'endDate').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const rejectBookingSchema = Joi.object({
  reason: Joi.string().min(1).max(500).required()
});

const updateBookingStatusSchema = Joi.object({
  status: Joi.string().valid('SUBMITTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED').required(),
  notes: Joi.string().optional()
});

/**
 * @swagger
 * /api/v1/bookings:
 *   post:
 *     summary: Create a booking for an ad
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - adId
 *               - startDate
 *               - endDate
 *             properties:
 *               adId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the ad to book
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Booking start date
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: Booking end date
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Additional notes for the booking
 *     responses:
 *       201:
 *         description: Booking created successfully
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
 *                   example: 'Booking created successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     adId:
 *                       type: string
 *                       format: uuid
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *                       enum: [SUBMITTED, CONFIRMED, CANCELLED, COMPLETED]
 *                     notes:
 *                       type: string
 *       400:
 *         description: Validation error or business rule violation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               validation_error:
 *                 value:
 *                   success: false
 *                   error:
 *                     code: 'VALIDATION_ERROR'
 *                     message: 'Invalid input data'
 *               invalid_date_range:
 *                 value:
 *                   success: false
 *                   error:
 *                     code: 'INVALID_DATE_RANGE'
 *                     message: 'End date must be after start date'
 *               cannot_book_own_ad:
 *                 value:
 *                   success: false
 *                   error:
 *                     code: 'CANNOT_BOOK_OWN_AD'
 *                     message: 'You cannot book your own ad'
 *       404:
 *         description: Ad not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'AD_NOT_FOUND'
 *                 message: 'Ad not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const createBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = createBookingSchema.validate(req.body);
    if (error) {
      if (error.message.includes('End date must be after start date')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'End date must be after start date'
          }
        });
        return;
      }
      
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    const { adId, startDate, endDate, slotId, bookingDate, notes } = value;
    const userId = req.user!.id;

    // Check if ad exists and is available for booking
    const ad = await prisma.ad.findUnique({
      where: { id: adId },
      include: {
        category: true,
        subcategory: true
      }
    });

    if (!ad) {
      res.status(404).json({
        success: false,
        error: {
          code: 'AD_NOT_FOUND',
          message: 'Ad not found'
        }
      });
      return;
    }

    // Check if user is trying to book their own ad
    if (ad.userId === userId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_BOOK_OWN_AD',
          message: 'You cannot book your own ad'
        }
      });
      return;
    }

    // Check if ad is approved
    if (ad.status !== 'APPROVED') {
      res.status(400).json({
        success: false,
        error: {
          code: 'AD_NOT_AVAILABLE',
          message: 'Ad is not available for booking'
        }
      });
      return;
    }

    // Validate based on booking type
    if (ad.bookingType === 'SLOTS') {
      if (!slotId || !bookingDate) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SLOT_REQUIRED',
            message: 'A specific slot and date are required for this ad'
          }
        });
        return;
      }

      // Check if slot exists in ad.slots
      const slots = (ad.slots as any[]) || [];
      const slot = slots.find(s => s.id === slotId);
      if (!slot) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SLOT',
            message: 'The selected slot is invalid for this ad'
          }
        });
        return;
      }

      // Validate booking date is not in the past
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const bookingDateStart = new Date(bookingDate);
      bookingDateStart.setHours(0, 0, 0, 0);
      if (bookingDateStart < todayStart) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BACKDATE_BOOKING',
            message: 'Cannot book a slot in the past'
          }
        });
        return;
      }

      // Check for overbooking on this specific date and slot
      const existingBookingsCount = await prisma.booking.count({
        where: {
          adId,
          slotId,
          bookingDate: new Date(bookingDate),
          status: { not: 'CANCELLED' }
        }
      });

      if (existingBookingsCount >= (slot.maxBookings || 1)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SLOT_FULL',
            message: 'This time slot is already fully booked for the selected date'
          }
        });
        return;
      }
    } else if (ad.bookingType === 'DEFAULT') {
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: {
            code: 'DATE_RANGE_REQUIRED',
            message: 'Start date and end date are required for date-range booking'
          }
        });
        return;
      }

      const availability = ad.slots && typeof ad.slots === 'object' && !Array.isArray(ad.slots)
        ? (ad.slots as { bookingStartDate?: string; bookingEndDate?: string })
        : null;

      if (!availability?.bookingStartDate || !availability?.bookingEndDate) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BOOKING_RANGE_NOT_CONFIGURED',
            message: 'This ad does not have an available booking range configured'
          }
        });
        return;
      }

      const selectedDate = new Date(startDate);
      selectedDate.setHours(0, 0, 0, 0);

      // Validate booking date is not in the past
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (selectedDate < todayStart) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BACKDATE_BOOKING',
            message: 'Cannot book a date in the past'
          }
        });
        return;
      }

      const rangeStart = new Date(availability.bookingStartDate);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(availability.bookingEndDate);
      rangeEnd.setHours(23, 59, 59, 999);

      if (selectedDate < rangeStart || selectedDate > rangeEnd) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BOOKING_DATE_OUTSIDE_RANGE',
            message: `Booking date must be between ${availability.bookingStartDate} and ${availability.bookingEndDate}`
          }
        });
        return;
      }
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        adId,
        userId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        slotId: slotId || null,
        bookingDate: bookingDate ? new Date(bookingDate) : null,
        status: 'SUBMITTED',
        notes: notes || ''
      },
      select: {
        id: true,
        adId: true,
        userId: true,
        startDate: true,
        endDate: true,
        slotId: true,
        bookingDate: true,
        status: true,
        notes: true,
        createdAt: true
      }
    });

    // Notify ad owner about the new booking (async - non-blocking)
    queueBookingNotification(
      ad.userId,
      booking.id,
      ad.title,
      'SUBMITTED',
      true // Is the ad owner
    ).catch(err => console.error('Failed to queue booking notification:', err));

    // Notify all admins about the new booking (async - non-blocking)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true, phone: true }
    });
    const userName = user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'A user';

    // Determine if this is a "Services" appointment
    const isServiceAppointment = ad.category?.name === 'Services & Jobs' && ad.subcategory?.name === 'Services';

    let adminTitle = 'New Booking Request';
    let adminMessage = `${userName} has made a booking request for "${ad.title}"`;

    if (isServiceAppointment) {
      adminTitle = 'NEW SERVICE APPOINTMENT';
      adminMessage = `New appointment for "${ad.title}" by ${userName}.\nEmail: ${user?.email || 'N/A'}\nPhone: ${user?.phone || 'N/A'}\nSlot: ${new Date(startDate).toLocaleString()} - ${new Date(endDate).toLocaleString()}`;
    }

    queueAdminNotifications(
      adminTitle,
      adminMessage,
      'BOOKING',
      {
        bookingId: booking.id,
        adId: ad.id,
        userId: userId,
        userName: userName,
        type: isServiceAppointment ? 'SERVICE_APPOINTMENT' : 'NEW_BOOKING'
      }
    ).catch(err => console.error('Failed to queue admin notifications:', err));

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/bookings/{bookingId}:
 *   delete:
 *     summary: Delete a booking (Admin only)
 *     tags: [Bookings]
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
 *     responses:
 *       200:
 *         description: Booking deleted successfully
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
 *                   example: 'Booking deleted successfully'
 *       403:
 *         description: Only admins can delete bookings
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
export const deleteBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = bookingIdSchema.validate(req.params);
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

    const { bookingId } = value;
    const userRole = req.user!.role;

    // Only admins can delete bookings
    if (userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can delete bookings'
        }
      });
      return;
    }

    // Check if booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
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

    // Delete the booking
    await prisma.booking.delete({
      where: { id: bookingId }
    });

    res.status(200).json({
      success: true,
      message: 'Booking deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/bookings/outgoing:
 *   get:
 *     summary: Get bookings I have made
 *     tags: [Bookings]
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
 *         description: Number of bookings per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SUBMITTED, CONFIRMED, CANCELLED, COMPLETED]
 *         description: Filter by booking status
 *     responses:
 *       200:
 *         description: Bookings retrieved successfully
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                       notes:
 *                         type: string
 *                       ad:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           price:
 *                             type: number
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getOutgoingBookings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = getBookingsQuerySchema.validate(req.query);
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

    const { page, limit, status, search, sortBy, sortOrder } = value;
    const userId = req.user!.id;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.BookingWhereInput = { userId };
    if (status) where.status = status;

    // Add search filter - search across notes, ad title, ad owner name, category, and subcategory
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { notes: { contains: searchTerm, mode: 'insensitive' } },
        { ad: { title: { contains: searchTerm, mode: 'insensitive' } } },
        { ad: { user: { firstName: { contains: searchTerm, mode: 'insensitive' } } } },
        { ad: { user: { lastName: { contains: searchTerm, mode: 'insensitive' } } } },
        { ad: { category: { name: { contains: searchTerm, mode: 'insensitive' } } } },
        { ad: { subcategory: { name: { contains: searchTerm, mode: 'insensitive' } } } }
      ];
    }

    // Get total count
    const total = await prisma.booking.count({ where });

    // Get bookings with complaint info
    const bookings = await prisma.booking.findMany({
      where,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        slotId: true,
        bookingDate: true,
        status: true,
        notes: true,
        createdAt: true,
        _count: {
          select: {
            complaints: true
          }
        },
        complaints: {
          select: {
            id: true,
            status: true,
            updatedAt: true
          },
          orderBy: {
            updatedAt: 'desc'
          },
          take: 1
        },
        ad: {
          select: {
            id: true,
            title: true,
            price: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
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
      data: bookings,
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
 * /api/v1/users/me/bookings/incoming:
 *   get:
 *     summary: Get bookings on my ads
 *     tags: [Bookings]
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
 *         description: Number of bookings per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SUBMITTED, CONFIRMED, CANCELLED, COMPLETED]
 *         description: Filter by booking status
 *     responses:
 *       200:
 *         description: Bookings retrieved successfully
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                       notes:
 *                         type: string
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           firstName:
 *                             type: string
 *                           phone:
 *                             type: string
 *                       ad:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getIncomingBookings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = getBookingsQuerySchema.validate(req.query);
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

    const { page, limit, status, search, sortBy, sortOrder } = value;
    const userId = req.user!.id;
    const skip = (page - 1) * limit;

    // Build where clause - bookings on ads owned by current user
    const where: Prisma.BookingWhereInput = {
      ad: {
        userId
      }
    };
    if (status) where.status = status;

    // Add search filter - search across notes, user name, ad title, category, and subcategory
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { notes: { contains: searchTerm, mode: 'insensitive' } },
        { user: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
        { ad: { title: { contains: searchTerm, mode: 'insensitive' } } },
        { ad: { category: { name: { contains: searchTerm, mode: 'insensitive' } } } },
        { ad: { subcategory: { name: { contains: searchTerm, mode: 'insensitive' } } } }
      ];
    }

    // Get total count
    const total = await prisma.booking.count({ where });

    // Get bookings with complaint info
    const bookings = await prisma.booking.findMany({
      where,
      select: {
        id: true,
        userId: true,
        startDate: true,
        endDate: true,
        slotId: true,
        bookingDate: true,
        status: true,
        notes: true,
        createdAt: true,
        _count: {
          select: {
            complaints: true
          }
        },
        complaints: {
          select: {
            id: true,
            status: true,
            updatedAt: true
          },
          orderBy: {
            updatedAt: 'desc'
          },
          take: 1
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        ad: {
          select: {
            id: true,
            title: true,
            price: true,
            userId: true
          }
        }
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
      data: bookings,
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
 * /api/v1/bookings/{bookingId}/confirm:
 *   post:
 *     summary: Confirm a booking on my ad
 *     tags: [Bookings]
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
 *     responses:
 *       200:
 *         description: Booking confirmed successfully
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
 *                   example: 'Booking confirmed successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: 'CONFIRMED'
 *       400:
 *         description: Booking cannot be confirmed from its current status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'INVALID_BOOKING_STATUS'
 *                 message: 'Booking cannot be confirmed in current status'
 *       403:
 *         description: Current user is not the ad owner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'FORBIDDEN'
 *                 message: 'You can only confirm bookings on your own ads'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'BOOKING_NOT_FOUND'
 *                 message: 'Booking not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const confirmBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = bookingIdSchema.validate(req.params);
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

    const { bookingId } = value;
    const userId = req.user!.id;

    // Find booking with ad owner info
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        ad: {
          select: {
            userId: true
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

    // Check if user owns the ad
    if (booking.ad.userId !== userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only confirm bookings on your own ads'
        }
      });
      return;
    }

    // Check if booking can be confirmed
    if (booking.status !== 'SUBMITTED') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BOOKING_STATUS',
          message: 'Booking cannot be confirmed in current status'
        }
      });
      return;
    }

    // Update booking status
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
      select: {
        id: true,
        status: true
      }
    });

    // Send notifications to both booking user and ad owner (async - non-blocking)
    try {
      // Get full booking details with ad information
      const fullBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          ad: {
            select: {
              title: true,
              userId: true
            }
          }
        }
      });

      if (fullBooking) {
        // Send notification to the booking user (async)
        queueBookingNotification(
          fullBooking.userId,
          bookingId,
          fullBooking.ad.title,
          'CONFIRMED',
          false // Not the ad owner
        ).catch(err => console.error('Failed to queue booking notification:', err));

        // Send notification to the ad owner (async)
        queueBookingNotification(
          fullBooking.ad.userId,
          bookingId,
          fullBooking.ad.title,
          'CONFIRMED',
          true // Is the ad owner
        ).catch(err => console.error('Failed to queue booking notification:', err));
      }
    } catch (error) {
      console.error('Failed to send booking confirmation notifications:', error);
      // Don't fail the request if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/bookings/{bookingId}/reject:
 *   post:
 *     summary: Reject a booking on my ad
 *     tags: [Bookings]
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Reason for rejection.
 *           example:
 *             reason: Booking overlaps with an approved reservation.
 *     responses:
 *       200:
 *         description: Booking rejected successfully
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
 *                   example: 'Booking rejected successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: 'CANCELLED'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         description: Not authorized to reject this booking
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'FORBIDDEN'
 *                 message: 'You can only reject bookings on your own ads'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'BOOKING_NOT_FOUND'
 *                 message: 'Booking not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const rejectBooking = async (
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

    const { error: bodyError, value: bodyValue } = rejectBookingSchema.validate(req.body);
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
    const { reason } = bodyValue;
    const userId = req.user!.id;

    // Find booking with ad owner info
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        ad: {
          select: {
            userId: true
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

    // Check if user owns the ad
    if (booking.ad.userId !== userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only reject bookings on your own ads'
        }
      });
      return;
    }

    // Update booking status and add rejection reason to notes
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'REJECTED',
        notes: `${booking.notes}\n\nRejected: ${reason}`
      },
      select: {
        id: true,
        status: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'Booking rejected successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/bookings/{bookingId}/cancel:
 *   post:
 *     summary: Cancel a booking I made
 *     tags: [Bookings]
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
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
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
 *                   example: 'Booking cancelled successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: 'CANCELLED'
 *       403:
 *         description: Not authorized to cancel this booking
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'FORBIDDEN'
 *                 message: 'You can only cancel your own bookings'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'BOOKING_NOT_FOUND'
 *                 message: 'Booking not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const cancelBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = bookingIdSchema.validate(req.params);
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

    const { bookingId } = value;
    const userId = req.user!.id;

    // Find booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
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

    // Check if user owns the booking
    if (booking.userId !== userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only cancel your own bookings'
        }
      });
      return;
    }

    // For CONFIRMED bookings, set to CANCELLATION_REQUESTED and notify seller
    // For SUBMITTED bookings, directly cancel
    const newStatus = booking.status === 'CONFIRMED' ? 'CANCELLATION_REQUESTED' : 'CANCELLED';
    const isCancellationRequest = newStatus === 'CANCELLATION_REQUESTED';

    // Update booking status
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: newStatus },
      select: {
        id: true,
        status: true
      }
    });

    // Send notification to booking user (async - non-blocking)
    try {
      // Get full booking details with ad information
      const fullBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          ad: {
            select: {
              title: true,
              userId: true
            }
          }
        }
      });

      if (fullBooking) {
        const notificationStatus = isCancellationRequest ? 'CANCELLATION_REQUESTED' : 'CANCELLED';

        // Send notification to the booking user (async)
        queueBookingNotification(
          fullBooking.userId,
          bookingId,
          fullBooking.ad.title,
          notificationStatus,
          false // Not the ad owner
        ).catch(err => console.error('Failed to queue booking notification:', err));

        // Send notification to the ad owner (async)
        queueBookingNotification(
          fullBooking.ad.userId,
          bookingId,
          fullBooking.ad.title,
          notificationStatus,
          true // Is the ad owner
        ).catch(err => console.error('Failed to queue booking notification:', err));
      }
    } catch (error) {
      console.error('Failed to send booking cancellation notifications:', error);
      // Don't fail the request if notification fails
    }

    res.status(200).json({
      success: true,
      message: isCancellationRequest
        ? 'Cancellation request sent to seller'
        : 'Booking cancelled successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/bookings/{bookingId}/complete:
 *   post:
 *     summary: Complete a booking (available to both buyer and seller)
 *     tags: [Bookings]
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
 *     responses:
 *       200:
 *         description: Booking completed successfully
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
 *                   example: 'Booking marked as completed'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: 'COMPLETED'
 *       400:
 *         description: Booking cannot be completed from its current status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'INVALID_BOOKING_STATUS'
 *                 message: 'Only confirmed bookings can be marked as completed'
 *       403:
 *         description: Current user is not the buyer or seller
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'FORBIDDEN'
 *                 message: 'You can only complete bookings you created or on your own ads'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'BOOKING_NOT_FOUND'
 *                 message: 'Booking not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const completeBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = bookingIdSchema.validate(req.params);
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

    const { bookingId } = value;
    const userId = req.user!.id;

    // Find booking with ad owner info
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        ad: {
          select: {
            userId: true
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

    // Check if user owns the ad OR created the booking
    const isAdOwner = booking.ad.userId === userId;
    const isBookingCreator = booking.userId === userId;

    if (!isAdOwner && !isBookingCreator) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only complete bookings you created or on your own ads'
        }
      });
      return;
    }

    // Check if booking can be completed
    if (booking.status !== 'CONFIRMED') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BOOKING_STATUS',
          message: 'Only confirmed bookings can be marked as completed'
        }
      });
      return;
    }

    // Update booking status and return full details in one query
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'COMPLETED' },
      include: {
        ad: {
          select: {
            title: true,
            userId: true
          }
        }
      }
    });

    // Send notifications to both booking user and ad owner (async - non-blocking)
    queueBookingNotification(
      booking.userId,
      bookingId,
      updatedBooking.ad.title,
      'COMPLETED',
      false // Not ad owner
    ).catch(err => console.error('Failed to queue booking notification:', err));

    queueBookingNotification(
      updatedBooking.ad.userId,
      bookingId,
      updatedBooking.ad.title,
      'COMPLETED',
      true // Is the ad owner
    ).catch(err => console.error('Failed to queue booking notification:', err));

    // Create transfer record for payment to seller
    try {
      const bookingTransaction = await prisma.transaction.findFirst({
        where: { bookingId },
        orderBy: { createdAt: 'desc' }
      });

      if (bookingTransaction) {
        await createTransferForBookingPayment({
          bookingId,
          transactionId: bookingTransaction.id,
          amount: Number(bookingTransaction.amount),
          description: `Payment to seller for completed booking ${bookingId}`,
        });
      }
    } catch (transferError) {
      console.error('Failed to create transfer record:', transferError);
      // Don't fail the request if transfer creation fails
    }

    res.status(200).json({
      success: true,
      message: 'Booking marked as completed',
      data: {
        id: updatedBooking.id,
        status: updatedBooking.status
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/bookings:
 *   get:
 *     summary: Get all bookings with filtering
 *     tags: [Admin - Bookings]
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
 *         description: Number of bookings per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SUBMITTED, CONFIRMED, CANCELLED, COMPLETED]
 *         description: Filter by booking status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by ad title or user name
 *     responses:
 *       200:
 *         description: Bookings retrieved successfully
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           firstName:
 *                             type: string
 *                           phone:
 *                             type: string
 *                       ad:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           user:
 *                             type: object
 *                             properties:
 *                               firstName:
 *                                 type: string
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getAllBookings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = getBookingsQuerySchema.validate(req.query);
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

    const { page, limit, status, search, sortBy, sortOrder } = value;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.BookingWhereInput = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        {
          ad: {
            title: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          user: {
            firstName: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          user: {
            lastName: {
              contains: search,
              mode: 'insensitive'
            }
          }
        }
      ];
    }

    // Get total count
    const total = await prisma.booking.count({ where });

    // Get bookings
    const bookings = await prisma.booking.findMany({
      where,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        slotId: true,
        bookingDate: true,
        status: true,
        notes: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        ad: {
          select: {
            id: true,
            title: true,
            price: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
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
      data: bookings,
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
 * /api/v1/admin/bookings/{bookingId}:
 *   get:
 *     summary: Get detailed booking information
 *     tags: [Admin - Bookings]
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
 *     responses:
 *       200:
 *         description: Booking information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *                     notes:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         phone:
 *                           type: string
 *                     ad:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         title:
 *                           type: string
 *                         price:
 *                           type: number
 *                         user:
 *                           type: object
 *                           properties:
 *                             firstName:
 *                               type: string
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'BOOKING_NOT_FOUND'
 *                 message: 'Booking not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getBookingById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = bookingIdSchema.validate(req.params);
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

    const { bookingId } = value;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        slotId: true,
        bookingDate: true,
        status: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        ad: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true
              }
            }
          }
        },
        complaints: {
          select: {
            id: true,
            description: true,
            status: true,
            resolutionNote: true,
            createdAt: true,
            updatedAt: true,
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
            _count: {
              select: {
                messages: true
              }
            }
          }
        },
        transactions: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            paymentProvider: true,
            description: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: 'desc'
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

    // Verify user has access to this booking (either the booker or ad owner)
    if (req.user?.role !== 'ADMIN' && req.user?.id !== booking.user.id && req.user?.id !== booking.ad.user.id) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this booking'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/bookings/{bookingId}/transactions:
 *   get:
 *     summary: Get transactions for a booking
 *     tags: [Bookings]
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
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
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
 *                       amount:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [SUBMITTED, COMPLETED, FAILED, REFUNDED]
 *                       paymentProvider:
 *                         type: string
 *                         enum: [RAZORPAY]
 *                       description:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: User does not have access to this booking
 *       404:
 *         description: Booking not found
 */
export const getBookingTransactions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = bookingIdSchema.validate(req.params);
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

    const { bookingId } = value;

    // Get booking to verify access
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        ad: {
          select: {
            userId: true
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

    // Verify user has access to this booking (either the booker or ad owner)
    if (req.user?.role !== 'ADMIN' && req.user?.id !== booking.userId && req.user?.id !== booking.ad.userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this booking'
        }
      });
      return;
    }

    // Get transactions for this booking
    const transactions = await prisma.transaction.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/bookings/{bookingId}:
 *   put:
 *     summary: Update booking status
 *     tags: [Admin - Bookings]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [SUBMITTED, CONFIRMED, CANCELLED, COMPLETED]
 *                 description: New booking status
 *     responses:
 *       200:
 *         description: Booking updated successfully
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
 *                   example: 'Booking updated successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'BOOKING_NOT_FOUND'
 *                 message: 'Booking not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const updateBookingStatus = async (
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

    const { error: bodyError, value: bodyValue } = updateBookingStatusSchema.validate(req.body);
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
    const { status } = bodyValue;

    // Check if booking exists
    const existingBooking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!existingBooking) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'Booking not found'
        }
      });
      return;
    }

    // Prepare update data
    const updateData: any = { status };
    if (bodyValue.notes !== undefined) {
      updateData.notes = bodyValue.notes;
    }

    // Update booking status
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
      select: {
        id: true,
        status: true,
        notes: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'Booking updated successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/bookings/{bookingId}/approve-cancellation:
 *   post:
 *     summary: Approve a cancellation request (Ad owner only)
 *     tags: [Bookings]
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
 *     responses:
 *       200:
 *         description: Cancellation approved successfully
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
 *                   example: 'Cancellation approved successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: 'CANCELLED'
 *       400:
 *         description: Booking is not in CANCELLATION_REQUESTED status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: User is not the ad owner
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
export const approveCancellationRequest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = bookingIdSchema.validate(req.params);
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

    const { bookingId } = value;
    const userId = req.user!.id;

    // Find booking with ad owner info
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        ad: {
          select: {
            userId: true
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

    // Check if user owns the ad
    if (booking.ad.userId !== userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only approve cancellations for your own ads'
        }
      });
      return;
    }

    // Check if booking is in CANCELLATION_REQUESTED status
    if (booking.status !== 'CANCELLATION_REQUESTED') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BOOKING_STATUS',
          message: 'Booking is not awaiting cancellation approval'
        }
      });
      return;
    }

    // Update booking status to CANCELLED
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
      select: {
        id: true,
        status: true
      }
    });

    // Send notifications to both parties (async - non-blocking)
    try {
      const fullBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          ad: {
            select: {
              title: true,
              userId: true
            }
          }
        }
      });

      if (fullBooking) {
        // Notify the booking user that their cancellation request was approved
        queueBookingNotification(
          fullBooking.userId,
          bookingId,
          fullBooking.ad.title,
          'CANCELLATION_APPROVED',
          false // Not the ad owner
        ).catch(err => console.error('Failed to queue booking notification:', err));

        // Notify the ad owner
        queueBookingNotification(
          fullBooking.ad.userId,
          bookingId,
          fullBooking.ad.title,
          'CANCELLATION_APPROVED',
          true // Is the ad owner
        ).catch(err => console.error('Failed to queue booking notification:', err));
      }
    } catch (error) {
      console.error('Failed to send cancellation approval notifications:', error);
    }

    // Create transfer record for the refund
    try {
      const bookingTransaction = await prisma.transaction.findFirst({
        where: { bookingId },
        orderBy: { createdAt: 'desc' }
      });

      if (bookingTransaction) {
        await createTransferForBookingRefund({
          bookingId,
          transactionId: bookingTransaction.id,
          amount: Number(bookingTransaction.amount),
          description: `Refund for cancelled booking ${bookingId}`,
        });
      }
    } catch (transferError) {
      console.error('Failed to create transfer record:', transferError);
      // Don't fail the request if transfer creation fails
    }

    res.status(200).json({
      success: true,
      message: 'Cancellation approved successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/bookings/{bookingId}/reject-cancellation:
 *   post:
 *     summary: Reject a cancellation request (Ad owner only)
 *     tags: [Bookings]
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Reason for rejecting the cancellation request
 *     responses:
 *       200:
 *         description: Cancellation rejected successfully
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
 *                   example: 'Cancellation request rejected successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: 'CONFIRMED'
 *       400:
 *         description: Booking is not in CANCELLATION_REQUESTED status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: User is not the ad owner
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
export const rejectCancellationRequest = async (
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

    const { error: bodyError, value: bodyValue } = rejectBookingSchema.validate(req.body);
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
    const { reason } = bodyValue;
    const userId = req.user!.id;

    // Find booking with ad owner info
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        ad: {
          select: {
            userId: true
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

    // Check if user owns the ad
    if (booking.ad.userId !== userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only reject cancellations for your own ads'
        }
      });
      return;
    }

    // Check if booking is in CANCELLATION_REQUESTED status
    if (booking.status !== 'CANCELLATION_REQUESTED') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BOOKING_STATUS',
          message: 'Booking is not awaiting cancellation approval'
        }
      });
      return;
    }

    // Revert booking status to CONFIRMED and add rejection reason to notes
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        notes: `${booking.notes}\n\nCancellation request rejected: ${reason}`
      },
      select: {
        id: true,
        status: true
      }
    });

    // Send notifications to both parties (async - non-blocking)
    try {
      const fullBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          ad: {
            select: {
              title: true,
              userId: true
            }
          }
        }
      });

      if (fullBooking) {
        // Notify the booking user that their cancellation request was rejected
        queueBookingNotification(
          fullBooking.userId,
          bookingId,
          fullBooking.ad.title,
          'CANCELLATION_REJECTED',
          false // Not the ad owner
        ).catch(err => console.error('Failed to queue booking notification:', err));

        // Notify the ad owner
        queueBookingNotification(
          fullBooking.ad.userId,
          bookingId,
          fullBooking.ad.title,
          'CANCELLATION_REJECTED',
          true // Is the ad owner
        ).catch(err => console.error('Failed to queue booking notification:', err));
      }
    } catch (error) {
      console.error('Failed to send cancellation rejection notifications:', error);
    }

    res.status(200).json({
      success: true,
      message: 'Cancellation request rejected successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/bookings/{bookingId}/approve-cancellation:
 *   post:
 *     summary: Approve a cancellation request (Admin only)
 *     tags: [Admin - Bookings]
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
 *     responses:
 *       200:
 *         description: Cancellation approved successfully
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
 *                   example: 'Cancellation approved successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: 'CANCELLED'
 *       400:
 *         description: Booking is not in CANCELLATION_REQUESTED status
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
 *       403:
 *         description: User is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const adminApproveCancellationRequest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = bookingIdSchema.validate(req.params);
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

    const { bookingId } = value;

    // Verify user is admin
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can approve cancellations'
        }
      });
      return;
    }

    // Find booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
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

    // Check if booking is in CANCELLATION_REQUESTED status
    if (booking.status !== 'CANCELLATION_REQUESTED') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BOOKING_STATUS',
          message: 'Booking is not awaiting cancellation approval'
        }
      });
      return;
    }

    // Update booking status to CANCELLED
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
      select: {
        id: true,
        status: true
      }
    });

    // Send notifications to both parties (async - non-blocking)
    try {
      const fullBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          ad: {
            select: {
              title: true,
              userId: true
            }
          }
        }
      });

      if (fullBooking) {
        // Notify the booking user that their cancellation request was approved by admin
        queueBookingNotification(
          fullBooking.userId,
          bookingId,
          fullBooking.ad.title,
          'CANCELLATION_APPROVED',
          false // Not the ad owner
        ).catch(err => console.error('Failed to queue booking notification:', err));

        // Notify the ad owner
        queueBookingNotification(
          fullBooking.ad.userId,
          bookingId,
          fullBooking.ad.title,
          'CANCELLATION_APPROVED',
          true // Is the ad owner
        ).catch(err => console.error('Failed to queue booking notification:', err));
      }
    } catch (error) {
      console.error('Failed to send cancellation approval notifications:', error);
    }

    res.status(200).json({
      success: true,
      message: 'Cancellation approved successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/bookings/{bookingId}/reject-cancellation:
 *   post:
 *     summary: Reject a cancellation request (Admin only)
 *     tags: [Admin - Bookings]
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Reason for rejecting the cancellation request
 *     responses:
 *       200:
 *         description: Cancellation rejected successfully
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
 *                   example: 'Cancellation request rejected successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: 'CONFIRMED'
 *       400:
 *         description: Booking is not in CANCELLATION_REQUESTED status
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
 *       403:
 *         description: User is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const adminRejectCancellationRequest = async (
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

    const { error: bodyError, value: bodyValue } = rejectBookingSchema.validate(req.body);
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
    const { reason } = bodyValue;

    // Verify user is admin
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can reject cancellations'
        }
      });
      return;
    }

    // Find booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
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

    // Check if booking is in CANCELLATION_REQUESTED status
    if (booking.status !== 'CANCELLATION_REQUESTED') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BOOKING_STATUS',
          message: 'Booking is not awaiting cancellation approval'
        }
      });
      return;
    }

    // Revert booking status to CONFIRMED and add rejection reason to notes
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        notes: `${booking.notes}\n\nCancellation request rejected by admin: ${reason}`
      },
      select: {
        id: true,
        status: true
      }
    });

    // Send notifications to both parties (async - non-blocking)
    try {
      const fullBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          ad: {
            select: {
              title: true,
              userId: true
            }
          }
        }
      });

      if (fullBooking) {
        // Notify the booking user that their cancellation request was rejected by admin
        queueBookingNotification(
          fullBooking.userId,
          bookingId,
          fullBooking.ad.title,
          'CANCELLATION_REJECTED',
          false // Not the ad owner
        ).catch(err => console.error('Failed to queue booking notification:', err));

        // Notify the ad owner
        queueBookingNotification(
          fullBooking.ad.userId,
          bookingId,
          fullBooking.ad.title,
          'CANCELLATION_REJECTED',
          true // Is the ad owner
        ).catch(err => console.error('Failed to queue booking notification:', err));
      }
    } catch (error) {
      console.error('Failed to send cancellation rejection notifications:', error);
    }

    res.status(200).json({
      success: true,
      message: 'Cancellation request rejected successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};