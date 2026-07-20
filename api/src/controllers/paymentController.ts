import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import Joi from 'joi';

import { createRazorpayOrder, verifyRazorpaySignature, getRazorpayInstance, fetchRazorpayPaymentDetails, fetchRazorpayOrderPayments } from '../utils/razorpay';
import { queueBookingNotification, queueAdExtensionNotification } from '../background/queues/notification.queue';
import { formatISTDate } from '../utils/notifications';

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    phone: string;
  };
}

// Validation schemas
const renewSubscriptionSchema = Joi.object({
  paymentProvider: Joi.string().valid('RAZORPAY').required(),
  currency: Joi.string().valid('INR').default('INR')
});

const createBookingPaymentSchema = Joi.object({
  adId: Joi.string().required(),
  paymentProvider: Joi.string().valid('RAZORPAY').required(),
  currency: Joi.string().valid('INR').default('INR'),
  amount: Joi.number().positive().required()
});

const adIdSchema = Joi.object({
  adId: Joi.string().uuid().required()
});

const paymentIntentIdSchema = Joi.object({
  paymentIntentId: Joi.string().required()
});

const transactionIdSchema = Joi.object({
  transactionId: Joi.string().uuid().required()
});

const getTransactionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED').allow(''),
  paymentProvider: Joi.string().valid('RAZORPAY').allow(''),
  sortBy: Joi.string().valid('createdAt', 'amount', 'status').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const getSubscriptionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  isActive: Joi.boolean().allow(''),
  sortBy: Joi.string().valid('createdAt', 'endDate').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const extendSubscriptionSchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).required()
});

const refundTransactionSchema = Joi.object({
  reason: Joi.string().min(1).max(500).required(),
  amount: Joi.number().positive().required()
});

/**
 * @swagger
 * /api/v1/subscriptions/{adId}/renew:
 *   post:
 *     summary: Renew an ad subscription (create payment intent)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Ad ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentProvider
 *             properties:
 *               paymentProvider:
 *                 type: string
 *                 enum: [RAZORPAY]
 *                 description: Payment provider
 *               currency:
 *                 type: string
 *                 enum: [INR]
 *                 default: INR
 *                 description: Payment currency
 *     responses:
 *       201:
 *         description: Payment intent created successfully
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
 *                   example: 'Payment intent created successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentIntentId:
 *                       type: string
 *                     transactionId:
 *                       type: string
 *                       format: uuid
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     status:
 *                       type: string
 *                     paymentProvider:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
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
export const renewSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error: paramsError, value: paramsValue } = adIdSchema.validate(req.params);
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

    const { error: bodyError, value: bodyValue } = renewSubscriptionSchema.validate(req.body);
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

    const { adId } = paramsValue;
    const { currency } = bodyValue;
    const userId = req.user!.id;

    console.log('renewSubscription called with:', { adId, currency, userId });

    // Check if ad exists and belongs to user
    const ad = await prisma.ad.findUnique({
      where: { id: adId },
      include: {
        user: true
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

    if (ad.userId !== userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only renew subscriptions for your own ads'
        }
      });
      return;
    }

    // Get subscription price from settings
    const subscriptionSetting = await prisma.setting.findUnique({
      where: { key: 'subscription_price' },
      select: { value: true }
    });
    const subscriptionAmount = parseFloat(typeof subscriptionSetting?.value === 'object'
      ? JSON.stringify(subscriptionSetting.value)
      : String(subscriptionSetting?.value ?? '99')
    ); // Default to 99 if not found

    // Create payment intent based on provider (only Razorpay for now)
    console.log('Creating Razorpay order:', { subscriptionAmount, currency });
    const paymentIntent = await createRazorpayOrder(subscriptionAmount, currency);

    // DO NOT create transaction record yet - only create when payment is successful
    // Transaction will be created in verifyRazorpayPayment after payment succeeds

    res.status(201).json({
      success: true,
      message: 'Payment intent created successfully',
      data: {
        paymentIntentId: paymentIntent.id,
        amount: subscriptionAmount,
        currency,
        paymentProvider: 'RAZORPAY'
      }
    });
  } catch (error) {
    console.error('Error in renewSubscription:', error);
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/bookings/payment/create:
 *   post:
 *     summary: Create payment order for booking
 *     tags: [Payments]
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
 *               - amount
 *               - paymentProvider
 *             properties:
 *               adId:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *               paymentProvider:
 *                 type: string
 *                 enum: [RAZORPAY]
 *               currency:
 *                 type: string
 *                 enum: [INR]
 *                 default: INR
 *     responses:
 *       201:
 *         description: Payment order created successfully
 */
export const createBookingPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = createBookingPaymentSchema.validate(req.body);
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

    const { adId, currency, amount } = value;
    const userId = req.user!.id;

    // Verify ad exists
    const ad = await prisma.ad.findUnique({
      where: { id: adId }
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

    // Create payment intent
    const paymentIntent = await createRazorpayOrder(amount, currency);

    // DO NOT create transaction record yet - only create when payment is successful
    // Transaction will be created in verifyRazorpayPayment after payment succeeds

    res.status(201).json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        paymentIntentId: paymentIntent.id,
        adId,
        amount,
        currency,
        paymentProvider: 'RAZORPAY'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/ads/payment/create:
 *   post:
 *     summary: Create payment order for ad creation
 *     tags: [Payments]
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
 *               - amount
 *               - paymentProvider
 *             properties:
 *               adId:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *               paymentProvider:
 *                 type: string
 *                 enum: [RAZORPAY]
 *               currency:
 *                 type: string
 *                 enum: [INR]
 *                 default: INR
 *               description:
 *                 type: string
 *                 description: Payment description
 *     responses:
 *       201:
 *         description: Payment order created successfully
 */
// Validation schema for ad creation payment
const createAdPaymentSchema = Joi.object({
  adId: Joi.string().uuid().optional(),
  amount: Joi.number().positive().required(),
  paymentProvider: Joi.string().valid('RAZORPAY').required(),
  currency: Joi.string().valid('INR').default('INR'),
  description: Joi.string().optional()
});

export const createAdPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = createAdPaymentSchema.validate(req.body);
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

    const { adId, amount, currency, description } = value;
    const userId = req.user!.id;

    // Verify that the ad belongs to the user
    if (adId) {
      const ad = await prisma.ad.findUnique({
        where: { id: adId, userId }
      });

      if (!ad) {
        res.status(404).json({
          success: false,
          error: {
            code: 'AD_NOT_FOUND',
            message: 'Ad not found or does not belong to user'
          }
        });
        return;
      }
    }

    // Create payment intent
    const paymentIntent = await createRazorpayOrder(amount, currency);

    // Create transaction record
    // DO NOT create transaction record yet - only create when payment is successful
    // Transaction will be created in verifyRazorpayPayment after payment succeeds

    res.status(201).json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
        paymentProvider: 'RAZORPAY'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/payments/{paymentIntentId}/status:
 *   get:
 *     summary: Get payment status
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentIntentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment intent ID
 *     responses:
 *       200:
 *         description: Payment status retrieved successfully
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
 *                     paymentIntentId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     amount:
 *                       type: string
 *                     currency:
 *                       type: string
 *                     paymentProvider:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Payment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'PAYMENT_NOT_FOUND'
 *                 message: 'Payment not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getPaymentStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = paymentIntentIdSchema.validate(req.params);
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

    const { paymentIntentId } = value;
    const userId = req.user!.id;

    const transaction = await prisma.transaction.findFirst({
      where: {
        paymentIntentId,
        userId // Ensure user can only see their own transactions
      }
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PAYMENT_NOT_FOUND',
          message: 'Payment not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        paymentIntentId: transaction.paymentIntentId,
        status: transaction.status,
        amount: transaction.amount.toString(),
        currency: transaction.currency,
        paymentProvider: transaction.paymentProvider,
        paymentMethod: transaction.paymentMethod,
        createdAt: transaction.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/users/me/subscriptions:
 *   get:
 *     summary: Get user's ad subscriptions
 *     tags: [Subscriptions]
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
 *         description: Number of subscriptions per page
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Subscriptions retrieved successfully
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
 *                       isActive:
 *                         type: boolean
 *                       ad:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           status:
 *                             type: string
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getUserSubscriptions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = getSubscriptionsQuerySchema.validate(req.query);
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

    const { page, limit, isActive, sortBy, sortOrder } = value;
    const userId = req.user!.id;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { userId };
    if (typeof isActive === 'boolean') where.isActive = isActive;

    // Get total count
    const total = await prisma.subscription.count({ where });

    // Get subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        isActive: true,
        isRenewed: true,
        createdAt: true,
        ad: {
          select: {
            id: true,
            title: true,
            status: true,
            price: true
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
      data: subscriptions,
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
 * /api/v1/users/me/transactions:
 *   get:
 *     summary: Get user's transaction history
 *     tags: [Transactions]
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
 *         description: Number of transactions per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *         description: Filter by transaction status
 *       - in: query
 *         name: paymentProvider
 *         schema:
 *           type: string
 *           enum: [RAZORPAY]
 *         description: Filter by payment provider
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
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       amount:
 *                         type: string
 *                       currency:
 *                         type: string
 *                       status:
 *                         type: string
 *                       paymentProvider:
 *                         type: string
 *                       description:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getUserTransactions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = getTransactionsQuerySchema.validate(req.query);
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

    const { page, limit, status, paymentProvider, sortBy, sortOrder } = value;
    const userId = req.user!.id;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { userId };
    if (status) where.status = status;
    if (paymentProvider) where.paymentProvider = paymentProvider;

    // Get total count
    const total = await prisma.transaction.count({ where });

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        paymentProvider: true,
        paymentMethod: true,
        paymentIntentId: true,
        description: true,
        createdAt: true,
        subscription: {
          select: {
            id: true,
            ad: {
              select: {
                id: true,
                title: true
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
      data: transactions.map(txn => ({
        ...txn,
        amount: txn.amount.toString()
      })),
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
 * Verify Razorpay payment signature
 */
export const verifyRazorpayPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      amount, 
      currency, 
      description, 
      subscriptionId, 
      adId, 
      startDate, 
      endDate, 
      notes,
      slotId,
      bookingDate
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required payment verification parameters'
        }
      });
      return;
    }

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Payment signature verification failed'
        }
      });
      return;
    }

    const userId = req.user!.id;

    // Fetch order details from Razorpay to get the amount
    let actualAmount = amount;
    if (!actualAmount) {
      try {
        const razorpay = getRazorpayInstance();
        const order: any = await razorpay.orders.fetch(razorpay_order_id);
        actualAmount = (order.amount as number) / 100; // Convert from paise to rupees
        console.log(`Fetched amount from Razorpay order: ${actualAmount} ${order.currency}`);
      } catch (error) {
        console.error('Failed to fetch Razorpay order details:', error);
        // Fall back to request amount if available
        actualAmount = amount || 0;
      }
    }

    // Fetch payment details from Razorpay to get payment method
    let paymentMethod = 'unknown';
    try {
      const paymentDetails = await fetchRazorpayPaymentDetails(razorpay_payment_id);
      if (paymentDetails) {
        paymentMethod = paymentDetails.method;
        console.log(`Payment method fetched: ${paymentMethod} for payment ${razorpay_payment_id}`);
      }
    } catch (error) {
      console.error('Failed to fetch payment method:', error);
      // Continue with default 'unknown' payment method
    }

    // Check if transaction already exists
    let transaction = await prisma.transaction.findFirst({
      where: { paymentIntentId: razorpay_order_id }
    });

    if (transaction) {
      // Idempotency: if this transaction was already fully processed, return existing result
      if (transaction.subscriptionId || transaction.bookingId) {
        res.status(200).json({
          success: true,
          message: 'Payment already verified',
          data: {
            verified: true,
            transactionId: transaction.id,
            bookingId: transaction.bookingId
          }
        });
        return;
      }

      // Update existing transaction with payment details
      transaction = await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
          paymentMethod: transaction.paymentMethod || paymentMethod
        }
      });
    } else {
      // Create new transaction - include adId if provided
      transaction = await prisma.transaction.create({
        data: {
          userId,
          subscriptionId: subscriptionId || null,
          adId: adId || null,
          amount: actualAmount || 0,
          currency: currency || 'INR',
          status: 'COMPLETED',
          paymentProvider: 'RAZORPAY',
          paymentIntentId: razorpay_order_id,
          paymentMethod: paymentMethod,
          description: description || 'Payment'
        }
      });
    }

    // Ensure transaction exists
    if (!transaction) {
      throw new Error('Transaction not found or could not be created');
    }

    let booking: any | null = null;

    // Handle subscription renewal if applicable
    // Check if this is a subscription payment (either via subscriptionId or adId without booking data)
    // Also check transaction's adId field for subscription payments
    const transactionAdId = (transaction as any).adId;
    console.log(`Checking subscription payment: subscriptionId=${subscriptionId}, req.adId=${adId}, transaction.adId=${transactionAdId}, startDate=${startDate}, endDate=${endDate}`);
    const isSubscriptionPayment = subscriptionId || (adId && !startDate && !endDate) || (transactionAdId && !startDate && !endDate);
    console.log(`isSubscriptionPayment=${isSubscriptionPayment}`);

    if (isSubscriptionPayment) {
      let targetAdId = adId || transactionAdId;
      console.log(`targetAdId=${targetAdId}`);
      let previousSubscription: any = null;

      if (subscriptionId) {
        // Legacy: extending existing subscription by ID
        previousSubscription = await prisma.subscription.findUnique({
          where: { id: subscriptionId },
          include: { ad: true }
        });
        targetAdId = previousSubscription?.adId || adId || transactionAdId;
      } else if (targetAdId) {
        // New flow: get latest subscription for this ad
        previousSubscription = await prisma.subscription.findFirst({
          where: { adId: targetAdId },
          orderBy: { endDate: 'desc' },
          include: { ad: true }
        });
        console.log(`previousSubscription found=${!!previousSubscription}, id=${previousSubscription?.id}, endDate=${previousSubscription?.endDate}`);
      }

      if (!targetAdId) {
        console.log(`Cannot process subscription payment: no adId found`);
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_AD_ID',
            message: 'Cannot process subscription payment: no ad ID provided'
          }
        });
        return;
      }

      // Get subscription duration from settings
      const durationSetting = await prisma.setting.findUnique({
        where: { key: 'subscription_duration' }
      });
      const subscriptionDuration = parseInt(typeof durationSetting?.value === 'object'
        ? JSON.stringify(durationSetting.value)
        : String(durationSetting?.value ?? '7'), 10);

      // Calculate start date for new subscription
      let startDate: Date;
      if (previousSubscription) {
        const previousEndDate = new Date(previousSubscription.endDate);
        const now = new Date();
        // If previous subscription expired, start from today; otherwise start from previous end date
        startDate = previousEndDate < now ? now : previousEndDate;
      } else {
        startDate = new Date();
      }

      // Calculate end date
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + subscriptionDuration);

      // Create subscription, link transaction, and update ad atomically
      const newSubscription = await prisma.$transaction(async (tx) => {
        const sub = await tx.subscription.create({
          data: {
            userId,
            adId: targetAdId,
            startDate,
            endDate,
            isActive: true,
            isRenewed: previousSubscription !== null
          },
          include: { ad: true }
        });

        // Link transaction to subscription
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { subscriptionId: sub.id }
        });

        // Update ad expiry
        const ad = await tx.ad.findUnique({
          where: { id: targetAdId },
          select: { id: true, status: true }
        });

        if (ad) {
          await tx.ad.update({
            where: { id: targetAdId },
            data: {
              expiresAt: endDate,
              status: ad.status === 'EXPIRED' ? 'APPROVED' : ad.status
            }
          });
        }

        return sub;
      });

      // Queue notification (outside transaction — not a DB operation)
      const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      queueAdExtensionNotification(
        userId,
        targetAdId,
        newSubscription.ad.title,
        diffDays,
        formatISTDate(endDate)
      ).catch(err => console.error('Failed to queue ad extension notification:', err));

      import('../utils/pre-expiry-reminders')
        .then(({ queueDuePreExpiryRemindersForAd }) =>
          queueDuePreExpiryRemindersForAd(targetAdId)
        )
        .catch(err => console.error('Failed to queue due pre-expiry reminders:', err));

      console.log(`Created new subscription ${newSubscription.id} for ad ${targetAdId}: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    }

    // Create booking after successful payment
    if (adId && ((startDate && endDate) || (slotId && bookingDate))) {
      // Validate booking date is not in the past
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (slotId && bookingDate) {
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
      } else if (startDate) {
        const startDateStart = new Date(startDate);
        startDateStart.setHours(0, 0, 0, 0);
        if (startDateStart < todayStart) {
          res.status(400).json({
            success: false,
            error: {
              code: 'BACKDATE_BOOKING',
              message: 'Cannot book a date in the past'
            }
          });
          return;
        }
      }

      // Validate slot availability before creating booking
      if (slotId && bookingDate) {
        const adWithSlots = await prisma.ad.findUnique({
          where: { id: adId },
          select: { slots: true }
        });

        if (adWithSlots?.slots && Array.isArray(adWithSlots.slots)) {
          const slot = (adWithSlots.slots as any[]).find(s => s.id === slotId);
          if (slot) {
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
          }
        }
      }

      const bookingData: any = {
        adId,
        userId,
        notes: notes || '',
        status: 'SUBMITTED'
      };

      if (slotId && bookingDate) {
        bookingData.slotId = slotId;
        bookingData.bookingDate = new Date(bookingDate);
      } else {
        bookingData.startDate = new Date(startDate);
        bookingData.endDate = new Date(endDate);
      }

      // Create booking and link transaction atomically
      booking = await prisma.$transaction(async (tx) => {
        const b = await tx.booking.create({
          data: bookingData,
          include: {
            ad: {
              select: {
                id: true,
                title: true,
                userId: true
              }
            }
          }
        });

        // Link transaction to booking
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { bookingId: b.id }
        });

        return b;
      });

      // Notify the seller about the new booking request
      if (booking.ad) {
        queueBookingNotification(
          booking.ad.userId,
          booking.id,
          booking.ad.title,
          'SUBMITTED',
          true
        ).catch((err: Error) => console.error('Failed to queue booking notification:', err));
      }
    }

    // Send notification
    const paymentAmount = transaction.amount || actualAmount || amount || 0;
    const paymentCurrency = transaction.currency || currency || 'INR';

    // Determine payment type and create appropriate notification
    let notificationTitle = 'Payment Successful';
    let notificationMessage = `Your payment of ${paymentCurrency} ${paymentAmount} has been processed successfully.`;
    let notificationData: any = {
      transactionId: transaction.id,
      paymentIntentId: razorpay_order_id,
      amount: paymentAmount.toString(),
      currency: paymentCurrency,
    };

    // Check if this was a subscription payment by checking the transaction
    const transactionWithSubscription = await prisma.transaction.findUnique({
      where: { id: transaction.id },
      include: {
        subscription: {
          include: { ad: { select: { id: true, title: true, slug: true } } }
        }
      }
    });

    if (transactionWithSubscription?.subscription && transactionWithSubscription.subscription.ad) {
      // Subscription renewal notification
      const existingSubscription = transactionWithSubscription.subscription;
      notificationTitle = 'Ad Subscription Renewed';
      notificationMessage = `Your ad "${existingSubscription.ad.title}" subscription has been renewed successfully until ${formatISTDate(new Date(existingSubscription.endDate))}.`;
      notificationData = {
        ...notificationData,
        type: 'subscription',
        subscriptionId: existingSubscription.id,
        adId: existingSubscription.ad.id,
        adSlug: existingSubscription.ad.slug,
        adTitle: existingSubscription.ad.title,
        deepLink: `/detail/${existingSubscription.ad.slug}`,
        screen: 'ad_detail',
      };
    } else if (booking) {
      // Booking payment notification
      const bookingWithAd = await prisma.booking.findUnique({
        where: { id: booking.id },
        include: {
          ad: {
            select: {
              id: true,
              title: true,
              slug: true
            }
          }
        }
      });

      if (bookingWithAd?.ad) {
        notificationTitle = 'Booking Confirmed';
        const bookingDate = booking.startDate ? new Date(booking.startDate) : new Date();
        notificationMessage = `Your booking for "${bookingWithAd.ad.title}" on ${formatISTDate(bookingDate)} has been confirmed.`;
        notificationData = {
          ...notificationData,
          type: 'booking',
          bookingId: booking.id,
          adId: bookingWithAd.ad.id,
          adSlug: bookingWithAd.ad.slug,
          adTitle: bookingWithAd.ad.title,
          bookingDate: booking.startDate,
          deepLink: `/booking-detail/${booking.id}`,
          screen: 'booking_detail',
        };
      } else {
        notificationData.bookingId = booking.id;
      }
    }

    await prisma.notification.create({
      data: {
        userId,
        title: notificationTitle,
        message: notificationMessage,
        type: 'PAYMENT',
        data: notificationData
      }
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        verified: true,
        transactionId: transaction.id,
        bookingId: booking?.id
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/ads/{adId}/subscription/extend:
 *   post:
 *     summary: Extend ad expiration date
 *     tags: [Admin - Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Ad ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - days
 *             properties:
 *               days:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *                 description: Number of days to extend
 *     responses:
 *       200:
 *         description: Subscription extended successfully
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
 *                   example: 'Subscription extended successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: Subscription not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'SUBSCRIPTION_NOT_FOUND'
 *                 message: 'Active subscription not found for this ad'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const extendAdSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error: paramsError, value: paramsValue } = adIdSchema.validate(req.params);
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

    const { error: bodyError, value: bodyValue } = extendSubscriptionSchema.validate(req.body);
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

    const { adId } = paramsValue;
    const { days } = bodyValue;

    // Find latest subscription for the ad
    const previousSubscription = await prisma.subscription.findFirst({
      where: { adId },
      orderBy: { endDate: 'desc' }
    });

    if (!previousSubscription) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'No subscription found for this ad'
        }
      });
      return;
    }

    // Calculate start date for new subscription
    // If previous subscription expired, start from today; otherwise start from previous end date
    const now = new Date();
    const startDate = new Date(previousSubscription.endDate) < now ? now : new Date(previousSubscription.endDate);
    const newEndDate = new Date(startDate);
    newEndDate.setDate(newEndDate.getDate() + days);

    // Create new subscription
    const newSubscription = await prisma.subscription.create({
      data: {
        userId: previousSubscription.userId,
        adId,
        startDate,
        endDate: newEndDate,
        isActive: true,
        isRenewed: true
      },
      select: {
        id: true,
        userId: true,
        startDate: true,
        endDate: true,
        ad: {
          select: {
            id: true,
            status: true,
            title: true
          }
        }
      }
    });

    // Update the ad's expiresAt to match the new subscription
    if (newSubscription.ad) {
      await prisma.ad.update({
        where: { id: newSubscription.ad.id },
        data: {
          expiresAt: newEndDate,
          status: newSubscription.ad.status === 'EXPIRED' ? 'APPROVED' : newSubscription.ad.status
        }
      });

      // Queue notification for ad extension
      queueAdExtensionNotification(
        newSubscription.userId,
        newSubscription.ad.id,
        newSubscription.ad.title,
        days,
        formatISTDate(newEndDate)
      ).catch(err => console.error('Failed to queue ad extension notification:', err));

      import('../utils/pre-expiry-reminders')
        .then(({ queueDuePreExpiryRemindersForAd }) =>
          queueDuePreExpiryRemindersForAd(newSubscription.ad.id)
        )
        .catch(err => console.error('Failed to queue due pre-expiry reminders:', err));
    }

    res.status(200).json({
      success: true,
      message: 'Subscription extended successfully',
      data: newSubscription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/transactions:
 *   get:
 *     summary: Get all transactions with filtering
 *     tags: [Admin - Transactions]
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
 *         description: Number of transactions per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *         description: Filter by transaction status
 *       - in: query
 *         name: paymentProvider
 *         schema:
 *           type: string
 *           enum: [RAZORPAY]
 *         description: Filter by payment provider
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
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       amount:
 *                         type: string
 *                       currency:
 *                         type: string
 *                       status:
 *                         type: string
 *                       paymentProvider:
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
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getAllTransactions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = getTransactionsQuerySchema.validate(req.query);
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

    const { page, limit, status, paymentProvider, sortBy, sortOrder } = value;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (status) where.status = status;
    if (paymentProvider) where.paymentProvider = paymentProvider;

    // Get total count
    const total = await prisma.transaction.count({ where });

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        paymentProvider: true,
        paymentMethod: true,
        paymentIntentId: true,
        description: true,
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
        subscription: {
          select: {
            id: true,
            ad: {
              select: {
                id: true,
                title: true
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
      data: transactions.map(txn => ({
        ...txn,
        amount: txn.amount.toString()
      })),
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
 * /api/v1/admin/transactions/{transactionId}:
 *   get:
 *     summary: Get detailed transaction information
 *     tags: [Admin - Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction information retrieved successfully
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
 *                     amount:
 *                       type: string
 *                     currency:
 *                       type: string
 *                     status:
 *                       type: string
 *                     paymentProvider:
 *                       type: string
 *                     paymentIntentId:
 *                       type: string
 *                     description:
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
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'TRANSACTION_NOT_FOUND'
 *                 message: 'Transaction not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getTransactionById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = transactionIdSchema.validate(req.params);
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

    const { transactionId } = value;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        paymentProvider: true,
        paymentMethod: true,
        paymentIntentId: true,
        description: true,
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
        subscription: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            ad: {
              select: {
                id: true,
                title: true,
                price: true
              }
            }
          }
        }
      }
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...transaction,
        amount: transaction.amount.toString()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/transactions/{transactionId}/refund:
 *   post:
 *     summary: Process a refund for a transaction
 *     tags: [Admin - Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *               - amount
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Reason for refund
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 description: Refund amount
 *     responses:
 *       200:
 *         description: Refund processed successfully
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
 *                   example: 'Refund processed successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: 'REFUNDED'
 *       400:
 *         description: Invalid refund request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_amount:
 *                 value:
 *                   success: false
 *                   error:
 *                     code: 'INVALID_REFUND_AMOUNT'
 *                     message: 'Refund amount cannot exceed transaction amount'
 *               already_refunded:
 *                 value:
 *                   success: false
 *                   error:
 *                     code: 'ALREADY_REFUNDED'
 *                     message: 'Transaction has already been refunded'
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: 'TRANSACTION_NOT_FOUND'
 *                 message: 'Transaction not found'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const refundTransaction = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error: paramsError, value: paramsValue } = transactionIdSchema.validate(req.params);
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

    const { error: bodyError, value: bodyValue } = refundTransactionSchema.validate(req.body);
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

    const { transactionId } = paramsValue;
    const { reason, amount } = bodyValue;

    // Find transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found'
        }
      });
      return;
    }

    // Validate refund conditions
    if (transaction.status === 'REFUNDED') {
      res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_REFUNDED',
          message: 'Transaction has already been refunded'
        }
      });
      return;
    }

    if (transaction.status !== 'COMPLETED') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TRANSACTION_STATUS',
          message: 'Only completed transactions can be refunded'
        }
      });
      return;
    }

    if (amount > Number(transaction.amount)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REFUND_AMOUNT',
          message: 'Refund amount cannot exceed transaction amount'
        }
      });
      return;
    }

    // Process refund (in real implementation, call payment provider APIs)
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'REFUNDED',
        description: `${transaction.description} - REFUNDED: ${reason}`
      },
      select: {
        id: true,
        status: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: updatedTransaction
    });
  } catch (error) {
    next(error);
  }
};

const getExpiringSubscriptionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  days: Joi.number().integer().min(1).max(365).default(7),
  sortBy: Joi.string().valid('endDate', 'createdAt').default('endDate'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc')
});

const getAllSubscriptionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  isActive: Joi.boolean().allow(''),
  status: Joi.string().valid('active', 'inactive', 'all').default('all'),
  search: Joi.string().allow('', null),
  userId: Joi.string().uuid().allow(''),
  sortBy: Joi.string().valid('createdAt', 'endDate', 'startDate').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

/**
 * @swagger
 * /api/v1/admin/subscriptions:
 *   get:
 *     summary: Get all subscriptions (Admin)
 *     tags: [Admin, Subscriptions]
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
 *         description: Number of subscriptions per page
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, all]
 *           default: all
 *         description: Filter by subscription status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search subscriptions by ad title, user name, or phone
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user ID
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, endDate, startDate]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Subscriptions retrieved successfully
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
 *                       isActive:
 *                         type: boolean
 *                       ad:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           title:
 *                             type: string
 *                           status:
 *                             type: string
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           phone:
 *                             type: string
 *                           profile:
 *                             type: object
 *                             properties:
 *                               firstName:
 *                                 type: string
 *                               lastName:
 *                                 type: string
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
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
export const getAllSubscriptions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = getAllSubscriptionsQuerySchema.validate(req.query);
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

    const { page, limit, isActive, status, userId, sortBy, sortOrder } = value;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Handle status parameter (takes precedence over isActive)
    if (status && status !== 'all') {
      if (status === 'active') {
        where.isActive = true;
      } else if (status === 'inactive') {
        where.isActive = false;
      }
    } else if (isActive !== '') {
      // Fallback to isActive if status is not provided or is 'all'
      where.isActive = isActive;
    }
    
    if (userId) {
      where.adId = {
        in: await prisma.ad.findMany({
          where: { userId },
          select: { id: true }
        }).then(ads => ads.map(ad => ad.id))
      };
    }

    if (value.search) {
      where.OR = [
        {
          ad: {
            title: {
              contains: value.search,
              mode: 'insensitive'
            }
          }
        },
        {
          ad: {
            user: {
              firstName: {
                contains: value.search,
                mode: 'insensitive'
              }
            }
          }
        },
        {
          ad: {
            user: {
              lastName: {
                contains: value.search,
                mode: 'insensitive'
              }
            }
          }
        },
        {
          ad: {
            user: {
              phone: {
                contains: value.search,
                mode: 'insensitive'
              }
            }
          }
        }
      ];
    }

    // Get subscriptions with related data
    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          ad: {
            select: {
              id: true,
              title: true,
              status: true,
              user: {
                select: {
                  id: true,
                  phone: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      }) as any,
      prisma.subscription.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    // Format response
    const formattedSubscriptions = subscriptions.map((subscription: any) => ({
      id: subscription.id,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      isActive: subscription.isActive,
      ad: {
        id: subscription.ad.id,
        title: subscription.ad.title,
        status: subscription.ad.status
      },
      user: {
         id: subscription.ad.user.id,
         phone: subscription.ad.user.phone,
         firstName: subscription.ad.user.firstName,
         lastName: subscription.ad.user.lastName
       }
    }));

    res.status(200).json({
      success: true,
      data: formattedSubscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        ad: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            status: true,
            images: true,
            user: {
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true
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
            createdAt: true
          }
        }
      }
    });

    if (!subscription) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Subscription not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: subscription.id,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        isActive: subscription.isActive,
        isRenewed: subscription.isRenewed,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        ad: subscription.ad,
        user: subscription.ad.user,
        transactions: subscription.transactions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/subscriptions/{subscriptionId}/cancel:
 *   post:
 *     summary: Cancel a subscription (Admin)
 *     tags: [Admin, Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Subscription'
 *       404:
 *         description: Subscription not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: SUBSCRIPTION_NOT_FOUND
 *                     message:
 *                       type: string
 *                       example: Subscription not found
 */
export const cancelSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Subscription not found'
        }
      });
      return;
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { isActive: false }
    });

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: updatedSubscription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/subscriptions/{subscriptionId}/reactivate:
 *   post:
 *     summary: Reactivate a subscription (Admin)
 *     tags: [Admin, Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Subscription reactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Subscription'
 *       404:
 *         description: Subscription not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: SUBSCRIPTION_NOT_FOUND
 *                     message:
 *                       type: string
 *                       example: Subscription not found
 */
export const reactivateSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Subscription not found'
        }
      });
      return;
    }

    // If the subscription has expired, extend it by the default duration
    let endDate = subscription.endDate;
    if (new Date() > new Date(subscription.endDate)) {
      // Get subscription duration from settings
      const durationSetting = await prisma.setting.findUnique({
        where: { key: 'subscription_duration' }
      });
      const subscriptionDuration = parseInt(typeof durationSetting?.value === 'object'
        ? JSON.stringify(durationSetting.value)
        : String(durationSetting?.value ?? '7'), 10);
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + subscriptionDuration);
      endDate = newEndDate;
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        isActive: true,
        endDate: endDate
      }
    });

    res.status(200).json({
      success: true,
      message: 'Subscription reactivated successfully',
      data: updatedSubscription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/subscriptions/expiring:
 *   get:
 *     summary: Get subscriptions expiring within specified days (Admin)
 *     tags: [Admin, Subscriptions]
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
 *         description: Number of subscriptions per page
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 7
 *         description: Number of days to look ahead for expiring subscriptions
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [endDate, createdAt]
 *           default: endDate
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Expiring subscriptions retrieved successfully
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
 *                       daysUntilExpiry:
 *                         type: integer
 *                       ad:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           title:
 *                             type: string
 *                           status:
 *                             type: string
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           phone:
 *                             type: string
 *                           profile:
 *                             type: object
 *                             properties:
 *                               firstName:
 *                                 type: string
 *                               lastName:
 *                                 type: string
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
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
export const getExpiringSubscriptions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = getExpiringSubscriptionsQuerySchema.validate(req.query);
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

    const { page, limit, days, sortBy, sortOrder } = value;
    const skip = (page - 1) * limit;

    // Calculate date range
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    // Get expiring subscriptions
    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where: {
          isActive: true,
          endDate: {
            gte: now,
            lte: futureDate
          }
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          ad: {
            select: {
              id: true,
              title: true,
              status: true,
              user: {
                select: {
                  id: true,
                  phone: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      }) as any,
      prisma.subscription.count({
        where: {
          isActive: true,
          endDate: {
            gte: now,
            lte: futureDate
          }
        }
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    // Format response with days until expiry
    const formattedSubscriptions = subscriptions.map((subscription: any) => {
      const daysUntilExpiry = Math.ceil(
        (subscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: subscription.id,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        daysUntilExpiry,
        ad: {
          id: subscription.ad.id,
          title: subscription.ad.title,
          status: subscription.ad.status
        },
        user: {
          id: subscription.ad.user.id,
          phone: subscription.ad.user.phone,
          firstName: subscription.ad.user.firstName,
          lastName: subscription.ad.user.lastName
        }
      };
    });

    res.status(200).json({
      success: true,
      data: formattedSubscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Recovery endpoint: called when the mobile app lost the WebView callback
 * (e.g., OS killed the app while user was in Google Pay).
 * Checks Razorpay directly for a successful payment on the order,
 * then creates the transaction and subscription.
 */
export const recoverOrderPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { adId } = req.body;
    const userId = req.user!.id;

    if (!orderId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Order ID is required' } });
      return;
    }

    // Check if a transaction already exists for this order
    const existingTransaction = await prisma.transaction.findFirst({
      where: { paymentIntentId: orderId }
    });

    if (existingTransaction) {
      // Already processed - idempotent
      res.status(200).json({
        success: true,
        message: existingTransaction.subscriptionId || existingTransaction.bookingId
          ? 'Payment already verified'
          : 'Transaction exists but not linked',
        data: {
          verified: true,
          transactionId: existingTransaction.id,
          bookingId: existingTransaction.bookingId
        }
      });
      return;
    }

    // Fetch order from Razorpay
    const razorpay = getRazorpayInstance();
    const order: any = await razorpay.orders.fetch(orderId);

    if (order.status !== 'paid') {
      res.status(200).json({
        success: false,
        message: 'Order not yet paid',
        data: { orderStatus: order.status }
      });
      return;
    }

    // Get payment details from Razorpay
    const paymentResult = await fetchRazorpayOrderPayments(orderId);
    if (!paymentResult) {
      res.status(200).json({
        success: false,
        message: 'No captured payment found for this order'
      });
      return;
    }

    const actualAmount = (order.amount as number) / 100;
    let paymentMethod = 'unknown';
    try {
      const details = await fetchRazorpayPaymentDetails(paymentResult.paymentId);
      if (details) paymentMethod = details.method;
    } catch { /* use default */ }

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        adId: adId || null,
        amount: actualAmount || 0,
        currency: (order.currency as string) || 'INR',
        status: 'COMPLETED',
        paymentProvider: 'RAZORPAY',
        paymentIntentId: orderId,
        paymentMethod,
        description: 'Recovered payment'
      }
    });

    // Process subscription if adId provided
    let booking: any = null;
    const targetAdId = adId || (transaction as any).adId;

    if (targetAdId) {
      const previousSubscription = await prisma.subscription.findFirst({
        where: { adId: targetAdId },
        orderBy: { endDate: 'desc' },
        include: { ad: true }
      });

      const durationSetting = await prisma.setting.findUnique({
        where: { key: 'subscription_duration' }
      });
      const subscriptionDuration = parseInt(
        typeof durationSetting?.value === 'object'
          ? JSON.stringify(durationSetting.value)
          : String(durationSetting?.value ?? '7'),
        10
      );

      let startDate: Date;
      if (previousSubscription) {
        const prevEnd = new Date(previousSubscription.endDate);
        const now = new Date();
        startDate = prevEnd < now ? now : prevEnd;
      } else {
        startDate = new Date();
      }
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + subscriptionDuration);

      // Atomically create subscription, link, and update ad
      const newSubscription = await prisma.$transaction(async (tx) => {
        const sub = await tx.subscription.create({
          data: {
            userId,
            adId: targetAdId,
            startDate,
            endDate,
            isActive: true,
            isRenewed: previousSubscription !== null
          },
          include: { ad: true }
        });

        await tx.transaction.update({
          where: { id: transaction.id },
          data: { subscriptionId: sub.id }
        });

        const ad = await tx.ad.findUnique({
          where: { id: targetAdId },
          select: { id: true, status: true }
        });
        if (ad) {
          await tx.ad.update({
            where: { id: targetAdId },
            data: {
              expiresAt: endDate,
              status: ad.status === 'EXPIRED' ? 'APPROVED' : ad.status
            }
          });
        }
        return sub;
      });

      const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      queueAdExtensionNotification(userId, targetAdId, newSubscription.ad.title, diffDays, formatISTDate(endDate))
        .catch(err => console.error('Failed to queue ad extension notification:', err));

      import('../utils/pre-expiry-reminders')
        .then(({ queueDuePreExpiryRemindersForAd }) =>
          queueDuePreExpiryRemindersForAd(targetAdId)
        )
        .catch(err => console.error('Failed to queue due pre-expiry reminders:', err));

      console.log(`Recovered subscription ${newSubscription.id} for ad ${targetAdId}`);
    }

    // Send in-app notification
    const paymentAmount = transaction.amount || actualAmount || 0;
    await prisma.notification.create({
      data: {
        userId,
        title: 'Payment Recovered',
        message: `Your payment of INR ${paymentAmount} has been recovered successfully.`,
        type: 'PAYMENT',
        data: {
          transactionId: transaction.id,
          paymentIntentId: orderId,
          amount: paymentAmount.toString(),
          currency: transaction.currency
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Payment recovered successfully',
      data: {
        verified: true,
        transactionId: transaction.id,
        bookingId: booking?.id
      }
    });
  } catch (error) {
    console.error('Order recovery failed:', error);
    next(error);
  }
};
