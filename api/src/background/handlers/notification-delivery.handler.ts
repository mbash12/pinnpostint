import { Job, JobHandler } from '../interfaces/job.interface';
import { sendNotificationToUser, sendNotificationToUsers, sendAdStatusNotification, sendBookingNotification } from '../../utils/notifications';
import { NotificationType } from '@prisma/client';
import { resolveNotificationChannels } from '../../utils/notification-channel-settings';

/**
 * Notification delivery job data interface
 * Supports different notification types through conditional fields
 */
export interface NotificationDeliveryData {
  // Single user notification fields
  userId?: string;
  title?: string;
  message?: string;
  type?: NotificationType;
  data?: any;
  channels?: ('push' | 'email' | 'sms')[];
  priority?: 'low' | 'normal' | 'high' | 'critical';
  forceChannels?: boolean;

  // Bulk notification fields
  userIds?: string[];

  // Ad status notification fields
  adId?: string;
  adTitle?: string;
  status?: string;
  rejectionReason?: string;
  adSlug?: string;
  expiryDate?: string;
  days?: number;
  reminderDays?: number; // For WILL_EXPIRE to indicate which reminder interval
  smsLabel?: 'expiry' | 'post-expiry';

  // Booking notification fields
  bookingId?: string;
  isOwner?: boolean;
}

/**
 * Job handler for delivering notifications through various channels
 * Routes to the appropriate notification function based on job data structure
 */
export const notificationDeliveryHandler: JobHandler<NotificationDeliveryData> = async (job: Job<NotificationDeliveryData>): Promise<void> => {
  console.log(`Processing notification delivery job ${job.id}`);

  try {
    const deliveryData: NotificationDeliveryData = job.data;

    // Route to the appropriate notification handler based on data structure
    if (deliveryData.adId && deliveryData.adTitle && deliveryData.status && deliveryData.userId) {
      // Ad status notification
      await handleAdStatusNotification(deliveryData);
    } else if (deliveryData.bookingId && deliveryData.adTitle && deliveryData.status && typeof deliveryData.isOwner === 'boolean' && deliveryData.userId) {
      // Booking notification
      await handleBookingNotification(deliveryData);
    } else if (deliveryData.userIds && deliveryData.title && deliveryData.message && deliveryData.type) {
      // Bulk notification
      await handleBulkNotification(deliveryData);
    } else if (deliveryData.userId && deliveryData.title && deliveryData.message && deliveryData.type) {
      // Single user notification
      await handleSingleNotification(deliveryData);
    } else {
      console.error('Invalid notification job data structure:', deliveryData);
      throw new Error('Invalid notification job data structure');
    }

    console.log(`Notification delivery job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`Notification delivery job ${job.id} failed:`, error);
    throw error;
  }
};

/**
 * Handle ad status notifications
 */
async function handleAdStatusNotification(data: NotificationDeliveryData): Promise<void> {
  const { userId, adId, adTitle, status, rejectionReason, adSlug, expiryDate, days, reminderDays, smsLabel } = data;

  if (status === 'EXTENDED') {
    await (await import('../../utils/notifications')).sendAdExtensionNotification(
      userId!,
      adId!,
      days || 0,
      expiryDate || 'N/A'
    );
  } else if (status === 'WILL_EXPIRE') {
    await (await import('../../utils/notifications')).sendAdWillExpireNotification(
      userId!,
      adId!,
      expiryDate || 'N/A',
      reminderDays
    );
  } else {
    await sendAdStatusNotification(
      userId!,
      adId!,
      adTitle!,
      status!,
      rejectionReason,
      adSlug,
      expiryDate,
      smsLabel
    );
  }

  console.log(`Ad status notification sent to user ${userId}: ${adTitle} - ${status}`);
}

/**
 * Handle booking notifications
 */
async function handleBookingNotification(data: NotificationDeliveryData): Promise<void> {
  const { userId, bookingId, adTitle, status, isOwner } = data;

  await sendBookingNotification(
    userId!,
    bookingId!,
    adTitle!,
    status!,
    isOwner!
  );

  console.log(`Booking notification sent to user ${userId}: ${adTitle} - ${status}`);
}

/**
 * Handle bulk notifications to multiple users
 */
async function handleBulkNotification(data: NotificationDeliveryData): Promise<void> {
  const { userIds, title, message, type, data: notificationData, channels, forceChannels } = data;

  const resolvedChannels = await resolveNotificationChannels(
    channels as ('push' | 'email' | 'sms')[] | undefined,
    forceChannels
  );

  await sendNotificationToUsers(
    userIds!,
    title!,
    message!,
    type!,
    notificationData,
    {
      channels: resolvedChannels,
      forceChannels: forceChannels || false,
    }
  );

  console.log(`Bulk notification sent to ${userIds!.length} users: ${title}`);
}

/**
 * Handle single user notifications
 */
async function handleSingleNotification(data: NotificationDeliveryData): Promise<void> {
  const { userId, title, message, type, data: notificationData, channels, forceChannels } = data;

  const resolvedChannels = await resolveNotificationChannels(
    channels as ('push' | 'email' | 'sms')[] | undefined,
    forceChannels
  );

  await sendNotificationToUser(
    userId!,
    title!,
    message!,
    type!,
    notificationData,
    {
      channels: resolvedChannels,
      forceChannels: forceChannels || false,
    }
  );

  console.log(`Notification sent to user ${userId}: ${title}`);
}


/**
 * Export the handler for use in the worker
 */
export default notificationDeliveryHandler;
