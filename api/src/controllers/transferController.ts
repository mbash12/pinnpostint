import { Request, Response } from 'express';
import { PrismaClient, TransferStatus, TransferType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    phone: string;
  };
}

// Admin Endpoints

export const getAllTransfers = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      page = '1',
      limit = '10',
      status,
      type,
      search,
      startDate,
      endDate,
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: Prisma.TransferWhereInput = {};

    if (status) {
      where.status = status as TransferStatus;
    }

    if (type) {
      where.transferType = type as TransferType;
    }

    if (search) {
      where.OR = [
        { id: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { fromUser: { firstName: { contains: search as string, mode: 'insensitive' } } },
        { fromUser: { lastName: { contains: search as string, mode: 'insensitive' } } },
        { toUser: { firstName: { contains: search as string, mode: 'insensitive' } } },
        { toUser: { lastName: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          fromUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          toUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          booking: {
            select: {
              id: true,
              status: true,
              startDate: true,
              endDate: true,
              ad: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
          subscription: {
            select: {
              id: true,
              isActive: true,
              startDate: true,
              endDate: true,
              ad: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
          ad: {
            select: {
              id: true,
              title: true,
            },
          },
          processedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.transfer.count({ where }),
    ]);

    return res.json({
      transfers,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Error fetching transfers:', error);
    return res.status(500).json({ error: 'Failed to fetch transfers' });
  }
};

export const getTransferById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { transferId } = req.params;

    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
      include: {
        fromUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
        toUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
        booking: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
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
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        subscription: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            ad: {
              select: {
                id: true,
                title: true,
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        ad: {
          select: {
            id: true,
            title: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        processedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    return res.json(transfer);
  } catch (error) {
    console.error('Error fetching transfer:', error);
    res.status(500).json({ error: 'Failed to fetch transfer' });
  }
};

export const createTransfer = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const {
      fromUserId,
      toUserId,
      transactionId,
      bookingId,
      subscriptionId,
      adId,
      amount,
      currency = 'INR',
      transferType,
      description,
      notes,
    } = req.body;

    // Validate required fields
    if (!amount || !transferType) {
      return res.status(400).json({ error: 'Amount and transfer type are required' });
    }

    // Validate that at least one entity reference is provided
    if (!transactionId && !bookingId && !subscriptionId && !adId) {
      return res.status(400).json({
        error: 'At least one of transactionId, bookingId, subscriptionId, or adId must be provided',
      });
    }

    // Validate transfer type matches entity
    if (transferType === 'BOOKING_REFUND' && !bookingId) {
      return res.status(400).json({ error: 'bookingId is required for BOOKING_REFUND type' });
    }
    if (transferType === 'BOOKING_PAYMENT_TO_SELLER' && !bookingId) {
      return res.status(400).json({ error: 'bookingId is required for BOOKING_PAYMENT_TO_SELLER type' });
    }
    if ((transferType === 'SUBSCRIPTION_REFUND' || transferType === 'SUBSCRIPTION_PAYOUT') && !subscriptionId) {
      return res.status(400).json({ error: 'subscriptionId is required for subscription transfer types' });
    }
    if (transferType === 'AD_PAYMENT' && !adId) {
      return res.status(400).json({ error: 'adId is required for AD_PAYMENT type' });
    }

    // Verify referenced entities exist
    if (bookingId) {
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
    }
    if (subscriptionId) {
      const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
      if (!subscription) {
        return res.status(404).json({ error: 'Subscription not found' });
      }
    }
    if (adId) {
      const ad = await prisma.ad.findUnique({ where: { id: adId } });
      if (!ad) {
        return res.status(404).json({ error: 'Ad not found' });
      }
    }
    if (fromUserId) {
      const fromUser = await prisma.user.findUnique({ where: { id: fromUserId } });
      if (!fromUser) {
        return res.status(404).json({ error: 'From user not found' });
      }
    }
    if (toUserId) {
      const toUser = await prisma.user.findUnique({ where: { id: toUserId } });
      if (!toUser) {
        return res.status(404).json({ error: 'To user not found' });
      }
    }

    const transfer = await prisma.transfer.create({
      data: {
        fromUserId,
        toUserId,
        transactionId,
        bookingId,
        subscriptionId,
        adId,
        amount,
        currency,
        transferType,
        description,
        notes,
      },
      include: {
        fromUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        toUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        booking: {
          select: {
            id: true,
            status: true,
            ad: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        subscription: {
          select: {
            id: true,
            ad: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        ad: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    res.status(201).json(transfer);
  } catch (error) {
    console.error('Error creating transfer:', error);
    res.status(500).json({ error: 'Failed to create transfer' });
  }
};

export const updateTransferStatus = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { transferId } = req.params;
    const { status, notes } = req.body;
    const adminUserId = req.user?.id; // From auth middleware

    if (!status || !['COMPLETED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be COMPLETED or CANCELLED' });
    }

    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    if (transfer.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only update pending transfers' });
    }

    const updatedTransfer = await prisma.transfer.update({
      where: { id: transferId },
      data: {
        status,
        notes: notes || transfer.notes,
        processedAt: new Date(),
        processedBy: adminUserId,
      },
      include: {
        fromUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        toUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        processedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return res.json(updatedTransfer);
  } catch (error) {
    console.error('Error updating transfer status:', error);
    res.status(500).json({ error: 'Failed to update transfer status' });
  }
};

export const deleteTransfer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { transferId } = req.params;

    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    if (transfer.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only delete pending transfers' });
    }

    await prisma.transfer.delete({
      where: { id: transferId },
    });

    return res.json({ message: 'Transfer deleted successfully' });
  } catch (error) {
    console.error('Error deleting transfer:', error);
    res.status(500).json({ error: 'Failed to delete transfer' });
  }
};

// Helper Functions for Auto-creating Transfers

export const createTransferForBookingRefund = async (params: {
  bookingId: string;
  transactionId?: string;
  amount: number;
  description?: string;
}) => {
  const { bookingId, transactionId, amount, description } = params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: true,
      ad: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  return prisma.transfer.create({
    data: {
      fromUserId: booking.ad.user.id, // Refund from seller
      toUserId: booking.user.id, // To buyer
      transactionId,
      bookingId,
      amount,
      transferType: 'BOOKING_REFUND',
      description: description || `Refund for booking ${bookingId}`,
    },
  });
};

export const createTransferForBookingPayment = async (params: {
  bookingId: string;
  transactionId?: string;
  amount: number;
  description?: string;
}) => {
  const { bookingId, transactionId, amount, description } = params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      ad: {
        include: {
          user: true,
        },
      },
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  // Payment from platform (or transaction) to seller
  return prisma.transfer.create({
    data: {
      fromUserId: null, // Platform
      toUserId: booking.ad.user.id, // To seller
      transactionId,
      bookingId,
      amount,
      transferType: 'BOOKING_PAYMENT_TO_SELLER',
      description: description || `Payment to seller for completed booking ${bookingId}`,
    },
  });
};

export const createTransferForSubscriptionRefund = async (params: {
  subscriptionId: string;
  transactionId?: string;
  amount: number;
  description?: string;
}) => {
  const { subscriptionId, transactionId, amount, description } = params;

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: true,
      ad: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  return prisma.transfer.create({
    data: {
      fromUserId: subscription.ad.user.id,
      toUserId: subscription.user.id,
      transactionId,
      subscriptionId,
      amount,
      transferType: 'SUBSCRIPTION_REFUND',
      description: description || `Refund for subscription ${subscriptionId}`,
    },
  });
};

export const createTransferForAdPayment = async (params: {
  adId: string;
  fromUserId?: string;
  toUserId?: string;
  amount: number;
  description?: string;
}) => {
  const { adId, fromUserId, toUserId, amount, description } = params;

  const ad = await prisma.ad.findUnique({
    where: { id: adId },
  });

  if (!ad) {
    throw new Error('Ad not found');
  }

  return prisma.transfer.create({
    data: {
      fromUserId,
      toUserId,
      adId,
      amount,
      transferType: 'AD_PAYMENT',
      description: description || `Ad payment for ${ad.title}`,
    },
  });
};
