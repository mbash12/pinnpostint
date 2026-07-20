import { Job, JobHandler } from '../interfaces/job.interface';
import { prisma } from '../../utils/database';
import { NotificationType, BookingStatus } from '@prisma/client';
import { queueBookingNotification } from '../queues/notification.queue';

/**
 * Job handler for auto-processing bookings
 * 1. Auto-completes confirmed bookings after X days from end date
 * 2. Auto-cancels pending bookings after X days from start date
 */
export const bookingAutoProcessHandler: JobHandler = async (job: Job): Promise<void> => {
  console.log(`Processing booking auto-process job ${job.id}`);

  try {
    // Get settings for auto-processing
    const autoCompleteDaysSetting = await prisma.setting.findUnique({
      where: { key: 'auto_complete_booking_days' },
      select: { value: true }
    });

    const autoCancelDaysSetting = await prisma.setting.findUnique({
      where: { key: 'auto_cancel_booking_days' },
      select: { value: true }
    });

    const autoCompleteDays = autoCompleteDaysSetting?.value
      ? parseInt(typeof autoCompleteDaysSetting.value === 'object'
          ? JSON.stringify(autoCompleteDaysSetting.value)
          : String(autoCompleteDaysSetting.value), 10)
      : 7; // Default to 7 days

    const autoCancelDays = autoCancelDaysSetting?.value
      ? parseInt(typeof autoCancelDaysSetting.value === 'object'
          ? JSON.stringify(autoCancelDaysSetting.value)
          : String(autoCancelDaysSetting.value), 10)
      : 3; // Default to 3 days

    console.log(`Auto-complete after ${autoCompleteDays} days, Auto-cancel after ${autoCancelDays} days`);
    console.log(`Note: Bookings with active complaints (OPEN or INVESTIGATING) will be excluded from auto-processing`);

    // Process auto-completion for confirmed bookings
    await autoCompleteBookings(autoCompleteDays);

    // Process auto-cancellation for pending bookings
    await autoCancelBookings(autoCancelDays);

    console.log(`Booking auto-process job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`Booking auto-process job ${job.id} failed:`, error);
    throw error;
  }
};

/**
 * Auto-complete confirmed bookings that have passed the end date by X days
 */
async function autoCompleteBookings(daysAfterEnd: number): Promise<void> {
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - daysAfterEnd);

  // Find confirmed bookings where end date has passed by X days
  const bookingsToComplete = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      endDate: {
        lte: cutoffDate
      },
      // Exclude bookings with active complaints
      complaints: {
        none: {
          status: {
            in: ['OPEN', 'INVESTIGATING']
          }
        }
      }
    },
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

  console.log(`Found ${bookingsToComplete.length} bookings to auto-complete (excluding bookings with active complaints)`);

  if (bookingsToComplete.length === 0) {
    return;
  }

  // Update bookings to COMPLETED status
  const bookingIds = bookingsToComplete.map(b => b.id);

  await prisma.booking.updateMany({
    where: {
      id: {
        in: bookingIds
      }
    },
    data: {
      status: BookingStatus.COMPLETED
    }
  });

  console.log(`Updated ${bookingIds.length} bookings to COMPLETED status`);

  // Send notifications to both parties
  for (const booking of bookingsToComplete) {
    try {
      // Notify booking user
      await queueBookingNotification(
        booking.userId,
        booking.id,
        booking.ad.title,
        'COMPLETED',
        false // Not ad owner
      );

      // Notify ad owner
      await queueBookingNotification(
        booking.ad.userId,
        booking.id,
        booking.ad.title,
        'COMPLETED',
        true // Is ad owner
      );

      console.log(`Sent auto-completion notifications for booking ${booking.id}`);
    } catch (error) {
      console.error(`Failed to send notifications for booking ${booking.id}:`, error);
      // Continue with other bookings
    }
  }
}

/**
 * Auto-cancel pending bookings that have passed the start date by X days
 */
async function autoCancelBookings(daysAfterStart: number): Promise<void> {
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - daysAfterStart);

  // Find pending bookings where start date has passed by X days
  const bookingsToCancel = await prisma.booking.findMany({
    where: {
      status: BookingStatus.SUBMITTED,
      startDate: {
        lte: cutoffDate
      },
      // Exclude bookings with active complaints
      complaints: {
        none: {
          status: {
            in: ['OPEN', 'INVESTIGATING']
          }
        }
      }
    },
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

  console.log(`Found ${bookingsToCancel.length} bookings to auto-cancel (excluding bookings with active complaints)`);

  if (bookingsToCancel.length === 0) {
    return;
  }

  // Update bookings to CANCELLED status
  const bookingIds = bookingsToCancel.map(b => b.id);

  // Update each booking individually to append notes
  for (const booking of bookingsToCancel) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        notes: `${booking.notes || ''}\n\nAuto-cancelled: Booking was not confirmed within ${daysAfterStart} days after the start date.`
      }
    });
  }

  console.log(`Updated ${bookingIds.length} bookings to CANCELLED status`);

  // Send notifications to both parties
  for (const booking of bookingsToCancel) {
    try {
      // Notify booking user
      await queueBookingNotification(
        booking.userId,
        booking.id,
        booking.ad.title,
        'CANCELLED',
        false // Not ad owner
      );

      // Notify ad owner
      await queueBookingNotification(
        booking.ad.userId,
        booking.id,
        booking.ad.title,
        'CANCELLED',
        true // Is ad owner
      );

      console.log(`Sent auto-cancellation notifications for booking ${booking.id}`);
    } catch (error) {
      console.error(`Failed to send notifications for booking ${booking.id}:`, error);
      // Continue with other bookings
    }
  }
}

/**
 * Utility function to find bookings eligible for auto-completion
 */
export const findBookingsToAutoComplete = async (daysAfterEnd: number) => {
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - daysAfterEnd);

  return await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      endDate: {
        lte: cutoffDate
      },
      // Exclude bookings with active complaints
      complaints: {
        none: {
          status: {
            in: ['OPEN', 'INVESTIGATING']
          }
        }
      }
    },
    include: {
      ad: {
        select: {
          id: true,
          title: true,
          userId: true
        }
      },
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
  });
};

/**
 * Utility function to find bookings eligible for auto-cancellation
 */
export const findBookingsToAutoCancel = async (daysAfterStart: number) => {
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - daysAfterStart);

  return await prisma.booking.findMany({
    where: {
      status: BookingStatus.SUBMITTED,
      startDate: {
        lte: cutoffDate
      },
      // Exclude bookings with active complaints
      complaints: {
        none: {
          status: {
            in: ['OPEN', 'INVESTIGATING']
          }
        }
      }
    },
    include: {
      ad: {
        select: {
          id: true,
          title: true,
          userId: true
        }
      },
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
  });
};
