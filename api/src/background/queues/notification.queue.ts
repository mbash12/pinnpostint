import { BullJobQueueManager } from '../queue-manager/job-queue-manager';
import { NotificationType } from '@prisma/client';
import { JobPriority } from '../interfaces/job.interface';
import { ADMIN_NOTIFICATION_CHANNELS } from '../../utils/notification-channel-settings';

export interface NotificationJobData {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  data?: Record<string, any>;
  channels?: ('push' | 'email' | 'sms')[];
  forceChannels?: boolean;
}

export interface BulkNotificationJobData {
  userIds: string[];
  title: string;
  message: string;
  type: NotificationType;
  data?: Record<string, any>;
  channels?: ('push' | 'email' | 'sms')[];
  forceChannels?: boolean;
}

export interface AdStatusNotificationJobData {
  userId: string;
  adId: string;
  adTitle: string;
  status: string;
  rejectionReason?: string;
  adSlug?: string;
  expiryDate?: string;
  days?: number;
  reminderDays?: number; // For WILL_EXPIRE to indicate which reminder interval (e.g., 7, 3, or 1 days)
  /** Distinguishes day-0 expiry SMS from weekly post-expiry SMS. */
  smsLabel?: 'expiry' | 'post-expiry';
}

export interface BookingNotificationJobData {
  userId: string;
  bookingId: string;
  adTitle: string;
  status: string;
  isOwner: boolean;
}

const NOTIFICATION_DELIVERY_JOB = 'notification-delivery';

let queueManager: BullJobQueueManager | null = null;

/**
 * Initialize the queue manager singleton
 */
export function initNotificationQueue(): BullJobQueueManager {
  if (!queueManager) {
    queueManager = new BullJobQueueManager();
  }
  return queueManager;
}

/**
 * Get the queue manager instance
 */
function getQueueManager(): BullJobQueueManager {
  if (!queueManager) {
    queueManager = initNotificationQueue();
  }
  return queueManager;
}

/**
 * Queue a single notification for async processing
 */
export async function queueNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  data?: Record<string, any>,
  options?: {
    channels?: ('push' | 'email' | 'sms')[];
    forceChannels?: boolean;
  }
): Promise<void> {
  try {
    const queue = getQueueManager();

    await queue.addJob<NotificationJobData>(
      NOTIFICATION_DELIVERY_JOB,
      {
        userId,
        title,
        message,
        type,
        data,
        channels: options?.channels,
        forceChannels: options?.forceChannels,
      },
      {
        priority: JobPriority.NORMAL,
        attempts: 3,
      }
    );

    console.log(`Notification queued for user ${userId}: ${title}`);
  } catch (error) {
    console.error(`Failed to queue notification for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Queue bulk notifications for multiple users
 */
export async function queueBulkNotifications(
  userIds: string[],
  title: string,
  message: string,
  type: NotificationType,
  data?: Record<string, any>,
  options?: {
    channels?: ('push' | 'email' | 'sms')[];
    forceChannels?: boolean;
  }
): Promise<void> {
  try {
    const queue = getQueueManager();

    await queue.addJob<BulkNotificationJobData>(
      NOTIFICATION_DELIVERY_JOB,
      {
        userIds,
        title,
        message,
        type,
        data,
        channels: options?.channels,
        forceChannels: options?.forceChannels,
      },
      {
        priority: 5,
        attempts: 3,
      }
    );

    console.log(`Bulk notification queued for ${userIds.length} users: ${title}`);
  } catch (error) {
    console.error('Failed to queue bulk notifications:', error);
    throw error;
  }
}

/**
 * Queue an ad status notification
 */
export async function queueAdStatusNotification(
  userId: string,
  adId: string,
  adTitle: string,
  status: string,
  rejectionReason?: string,
  adSlug?: string,
  expiryDate?: string,
  days?: number,
  smsLabel?: 'expiry' | 'post-expiry'
): Promise<void> {
  try {
    const queue = getQueueManager();

    await queue.addJob<AdStatusNotificationJobData>(
      NOTIFICATION_DELIVERY_JOB,
      {
        userId,
        adId,
        adTitle,
        status,
        rejectionReason,
        adSlug,
        expiryDate,
        days,
        smsLabel,
      },
      {
        priority: JobPriority.HIGH, // Higher priority for ad status updates
        attempts: 3,
      }
    );

    console.log(`Ad status notification queued for user ${userId}: ${adTitle} - ${status}`);
  } catch (error) {
    console.error(`Failed to queue ad status notification for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Queue an ad extension notification
 */
export async function queueAdExtensionNotification(
  userId: string,
  adId: string,
  adTitle: string,
  days: number,
  expiryDate: string
): Promise<void> {
  return queueAdStatusNotification(userId, adId, adTitle, 'EXTENDED', undefined, undefined, expiryDate, days);
}

/**
 * Queue an ad will expire notification
 */
export async function queueAdWillExpireNotification(
  userId: string,
  adId: string,
  adTitle: string,
  expiryDate: string,
  reminderDays?: number
): Promise<void> {
  try {
    const queue = getQueueManager();

    await queue.addJob<AdStatusNotificationJobData>(
      NOTIFICATION_DELIVERY_JOB,
      {
        userId,
        adId,
        adTitle,
        status: 'WILL_EXPIRE',
        expiryDate,
        reminderDays
      },
      {
        priority: JobPriority.HIGH,
        attempts: 3,
      }
    );

    console.log(`Ad will expire notification queued for user ${userId}: ${adTitle} (${reminderDays} days)`);
  } catch (error) {
    console.error(`Failed to queue ad will expire notification for user ${userId}:`, error);
    throw error;
  }
}


/**
 * Queue a booking notification
 */
export async function queueBookingNotification(
  userId: string,
  bookingId: string,
  adTitle: string,
  status: string,
  isOwner: boolean
): Promise<void> {
  try {
    const queue = getQueueManager();

    await queue.addJob<BookingNotificationJobData>(
      NOTIFICATION_DELIVERY_JOB,
      {
        userId,
        bookingId,
        adTitle,
        status,
        isOwner,
      },
      {
        priority: JobPriority.HIGH, // High priority for booking updates
        attempts: 3,
      }
    );

    console.log(`Booking notification queued for user ${userId}: ${adTitle} - ${status}`);
  } catch (error) {
    console.error(`Failed to queue booking notification for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Queue admin notifications
 */
export async function queueAdminNotifications(
  title: string,
  message: string,
  type: NotificationType = 'ADMIN_ALERT',
  data?: Record<string, any>
): Promise<void> {
  try {
    const { prisma } = await import('../../utils/database');

    // Get all admin users
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        isActive: true
      },
      select: {
        id: true
      }
    });

    if (admins.length === 0) {
      console.log('No active admins found');
      return;
    }

    const adminIds = admins.map(admin => admin.id);

    await queueBulkNotifications(adminIds, title, message, type, data, {
      channels: [...ADMIN_NOTIFICATION_CHANNELS],
      forceChannels: true,
    });

    console.log(`Admin notifications queued for ${adminIds.length} admins: ${title}`);
  } catch (error) {
    console.error('Failed to queue admin notifications:', error);
    throw error;
  }
}
