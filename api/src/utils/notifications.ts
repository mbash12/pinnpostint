import { sendMulticastNotification } from './firebaseAdmin';
import { prisma } from './database';
import { NotificationType } from '@prisma/client';
import { getEmailService } from './email';
import { enqueueSms, type SmsOutboxMeta } from './smsOutbox';
import { notificationTemplates } from '../config/notification-templates';
import config from '../config/environment';
import logger from './logger';
import { resolveNotificationChannels, ADMIN_NOTIFICATION_CHANNELS } from './notification-channel-settings';

function buildSmsMeta(
  type: NotificationType,
  data?: Record<string, any>
): SmsOutboxMeta | undefined {
  if (!data) return undefined;

  const meta: SmsOutboxMeta = {};
  if (data.adId) meta.adId = String(data.adId);
  if (data.adTitle) meta.adTitle = String(data.adTitle);
  if (data.expiryDate) meta.expiryDate = String(data.expiryDate);
  if (type === 'SUBSCRIPTION_EXPIRY' && typeof data.days === 'number') {
    meta.reminderDays = data.days;
  }
  meta.notificationType = String(type);

  if (type === 'SUBSCRIPTION_EXPIRY' && typeof data.days === 'number') {
    meta.label = `pre-expiry:${data.days}d`;
  } else if (type === 'AD_EXPIRED') {
    // Day-0 cleanup vs weekly post-expiry must be distinguishable in outbox.
    meta.label = data.smsLabel === 'post-expiry' ? 'post-expiry' : 'expiry';
  } else if (type === 'AD_APPROVED') {
    meta.label = 'approved';
  } else if (type === 'AD_REJECTED') {
    meta.label = 'rejected';
  } else if (type === 'AD_EXTENDED') {
    meta.label = 'extended';
  } else {
    meta.label = String(type).toLowerCase().replace(/_/g, '-');
  }

  return meta;
}

/**
 * Format a date to IST (India Standard Time) date string
 * Uses consistent dd/mm/yyyy format matching mobile and admin apps
 */
export function formatISTDate(date: Date): string {
  // Convert to IST by adding 5.5 hours offset
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);

  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const year = istDate.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Get active push tokens for users
 */
async function getUserPushTokens(userIds: string[]): Promise<Map<string, string[]>> {
  const tokens = await prisma.pushToken.findMany({
    where: {
      userId: { in: userIds },
      isActive: true
    },
    select: {
      userId: true,
      token: true
    }
  });

  const tokenMap = new Map<string, string[]>();
  for (const t of tokens) {
    const userTokens = tokenMap.get(t.userId) || [];
    userTokens.push(t.token);
    tokenMap.set(t.userId, userTokens);
  }
  return tokenMap;
}

/**
 * Send notification to user respecting their preferences
 */
export async function sendNotificationToUser(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  data?: Record<string, any>,
  options?: {
    channels?: ('push' | 'email' | 'sms')[];
    forceChannels?: boolean; // Override user preferences if true
    smsTemplateId?: string;
    smsMessage?: string;
    smsMeta?: SmsOutboxMeta;
    pushTitle?: string;
    pushMessage?: string;
    emailSubject?: string;
    emailHtml?: string;
  }
): Promise<{ pushSuccess: boolean; emailSuccess: boolean; smsSuccess: boolean }> {
  try {
    // Get user with preferences and push tokens
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        pushTokens: {
          where: { isActive: true },
          select: { token: true }
        }
      }
    });

    if (!user) {
      logger.warn(`User ${userId} not found`);
      return { pushSuccess: false, emailSuccess: false, smsSuccess: false };
    }

    const profile = user.profile;
    const requestedChannels = await resolveNotificationChannels(
      options?.channels,
      options?.forceChannels
    );
    const forceChannels = options?.forceChannels || false;
    const userPushTokens = user.pushTokens.map(t => t.token);

    // Determine which channels to use based on user preferences
    const channels = {
      push: forceChannels || (profile?.pushNotifications !== false && userPushTokens.length > 0),
      email: forceChannels || (profile?.emailNotifications !== false && user.email),
      sms: forceChannels || (user.phone), // Assuming SMS is always enabled if phone exists, or add to profile later
    };

    const results = { pushSuccess: false, emailSuccess: false, smsSuccess: false };

    // Send push notification if enabled
    if (channels.push && requestedChannels.includes('push') && userPushTokens.length > 0) {
      try {
        const dataPayload: Record<string, string> = toFCMStringRecord({
          type: String(type),
          userId,
          ...data
        });

        const finalPushTitle = options?.pushTitle || title;
        const finalPushMessage = options?.pushMessage || message;

        // Send to all user's devices
        const pushResult = await sendMulticastNotification(
          userPushTokens,
          finalPushTitle,
          finalPushMessage,
          dataPayload
        );

        results.pushSuccess = pushResult.success > 0;

        // Clean up invalid tokens
        if (pushResult.invalidTokens.length > 0) {
          await prisma.pushToken.updateMany({
            where: {
              token: { in: pushResult.invalidTokens }
            },
            data: { isActive: false }
          });
          logger.info(`Deactivated ${pushResult.invalidTokens.length} invalid push tokens`);
        }

        if (results.pushSuccess) {
          logger.info(`Push notification sent to user ${userId} (${pushResult.success}/${userPushTokens.length} devices)`);
        }
      } catch (error) {
        logger.error(`Failed to send push notification to user ${userId}:`, error);
      }
    }

    // Send email notification if enabled
    if (channels.email && requestedChannels.includes('email') && user.email) {
      try {
        const emailService = getEmailService();
        const finalSubject = options?.emailSubject || title;
        const finalHtml = options?.emailHtml || generateEmailTemplate(user, title, message, data);

        const emailResult = await emailService.sendEmail({
          to: user.email,
          subject: finalSubject,
          html: finalHtml,
        });

        results.emailSuccess = emailResult.success;

        if (emailResult.success) {
          logger.info(`Email notification sent to user ${userId}`);
        } else {
          logger.error(`Failed to send email to user ${userId}:`, emailResult.error);
        }
      } catch (error) {
        logger.error(`Failed to send email notification to user ${userId}:`, error);
      }
    }

    // Send SMS notification if enabled
    if (channels.sms && requestedChannels.includes('sms') && user.phone) {
      try {
        const finalSmsMessage = options?.smsMessage || message;
        // Route through the durable outbox: the row is the source of truth
        // and the sms-outbox-drain cron retries until delivery succeeds.
        const smsResult = await enqueueSms({
          to: user.phone,
          message: finalSmsMessage,
          templateId: options?.smsTemplateId,
          kind: 'notification',
          meta: options?.smsMeta ?? buildSmsMeta(type, data),
        });

        // smsSuccess reflects whether the immediate attempt landed.
        // If false, the outbox still owns the message and will retry.
        results.smsSuccess = smsResult.sent;

        if (smsResult.sent) {
          logger.info(`SMS notification sent to user ${userId}`);
        } else {
          logger.error(
            `SMS for user ${userId} did not send immediately; ` +
              `queued in outbox row ${smsResult.id} for retry: ${smsResult.error}`
          );
        }
      } catch (error) {
        // Only thrown if the outbox row itself cannot be written (DB down).
        // Treat as a delivery failure — the notification still went to in-app
        // channels and we surface the SMS failure to the caller.
        logger.error(`Failed to enqueue SMS notification for user ${userId}:`, error);
        results.smsSuccess = false;
      }
    }

    // Create notification record in database regardless of channel
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        data: data ? (data as any) : null,
      }
    });

    return results;
  } catch (error) {
    logger.error(`Failed to send notification to user ${userId}:`, error);
    return { pushSuccess: false, emailSuccess: false, smsSuccess: false };
  }
}

/**
 * Send notifications to multiple users respecting their preferences
 * Implements chunking to prevent memory exhaustion
 */
export async function sendNotificationToUsers(
  userIds: string[],
  title: string,
  message: string,
  type: NotificationType,
  data?: Record<string, any>,
  options?: {
    channels?: ('push' | 'email' | 'sms')[];
    forceChannels?: boolean;
    smsTemplateId?: string;
    smsMeta?: SmsOutboxMeta;
  }
): Promise<{ pushSuccess: number; emailSuccess: number; smsSuccess: number; totalUsers: number }> {
  const CHUNK_SIZE = 100; // Process 100 users at a time
  let totalPushSuccess = 0;
  let totalEmailSuccess = 0;
  let totalSmsSuccess = 0;

  console.log(`Sending bulk notification to ${userIds.length} users in chunks of ${CHUNK_SIZE}`);

  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunkIds = userIds.slice(i, i + CHUNK_SIZE);

    try {
      // Get users for this chunk only
      const users = await prisma.user.findMany({
        where: { id: { in: chunkIds } },
        include: { profile: true }
      });

      if (users.length === 0) continue;

      // Get push tokens for this chunk
      const pushTokenMap = await getUserPushTokens(chunkIds);

      const requestedChannels = await resolveNotificationChannels(
        options?.channels,
        options?.forceChannels
      );
      const forceChannels = options?.forceChannels || false;

      const pushUsers = users.filter(user => {
        const hasTokens = (pushTokenMap.get(user.id)?.length || 0) > 0;
        return forceChannels || (user.profile?.pushNotifications !== false && hasTokens);
      }).filter(_user => requestedChannels.includes('push'));

      const emailUsers = users.filter(user => {
        return forceChannels || (user.profile?.emailNotifications !== false && user.email);
      }).filter(_user => requestedChannels.includes('email'));

      const smsUsers = users.filter(user => {
        return forceChannels || user.phone; // Always send SMS if phone exists and forced or not explicitly disabled
      }).filter(_user => requestedChannels.includes('sms'));

      // Send push notifications for this chunk
      if (pushUsers.length > 0) {
        const chunkTokens: string[] = [];
        for (const user of pushUsers) {
          const tokens = pushTokenMap.get(user.id) || [];
          chunkTokens.push(...tokens);
        }

        if (chunkTokens.length > 0) {
          const pushResult = await sendMulticastNotification(
            chunkTokens,
            title,
            message,
            toFCMStringRecord({ type: String(type), ...data })
          );
          totalPushSuccess += pushResult.success;

          // Clean up invalid tokens
          if (pushResult.invalidTokens.length > 0) {
            await prisma.pushToken.updateMany({
              where: { token: { in: pushResult.invalidTokens } },
              data: { isActive: false }
            });
          }
        }
      }

      // Send emails for this chunk
      if (emailUsers.length > 0) {
        const emailService = getEmailService();
        const html = generateEmailTemplate(null, title, message, data);

        // Process emails in parallel for this chunk
        const emailPromises = emailUsers.map(user =>
          emailService.sendEmail({
            to: user.email!,
            subject: title,
            html,
          }).then(res => res.success ? 1 : 0).catch(() => 0)
        );

        const emailResults = await Promise.all(emailPromises);
        totalEmailSuccess += emailResults.reduce((a, b) => a + b, 0);
      }

      // Send SMS for this chunk via the durable outbox.
      // Bulk sends can stall request latency if we hit the provider sync,
      // so the immediate attempt is bounded by the per-row send timeout
      // and any failures fall through to the drain cron.
      if (smsUsers.length > 0) {
        const smsMeta = options?.smsMeta ?? buildSmsMeta(type, data);
        const smsPromises = smsUsers.map(user =>
          enqueueSms({
            to: user.phone,
            message,
            templateId: options?.smsTemplateId,
            kind: 'notification',
            meta: smsMeta,
          })
            .then(res => res.sent ? 1 : 0)
            .catch(err => {
              logger.error(`Failed to enqueue SMS for user ${user.id}:`, err);
              return 0;
            })
        );
        const smsResults = await Promise.all(smsPromises);
        totalSmsSuccess += smsResults.reduce((a, b) => a + b, 0);
      }

      // Create notification records for this chunk
      await prisma.notification.createMany({
        data: users.map(user => ({
          userId: user.id,
          title,
          message,
          type,
          data: data ? (data as any) : null,
        }))
      });

    } catch (error) {
      logger.error(`Failed to process notification chunk starting at ${i}:`, error);
    }
  }

  return {
    pushSuccess: totalPushSuccess,
    emailSuccess: totalEmailSuccess,
    smsSuccess: totalSmsSuccess,
    totalUsers: userIds.length
  };
}

/**
 * Send notification for ad status change
 */
export async function sendAdStatusNotification(
  userId: string,
  adId: string,
  adTitle: string,
  status: string,
  rejectionReason?: string,
  adSlug?: string,
  expiryDate?: string,
  smsLabel?: 'expiry' | 'post-expiry'
): Promise<{ pushSuccess: boolean; emailSuccess: boolean; smsSuccess: boolean }> {
  let title = '';
  let message = '';
  let type: NotificationType;
  let smsTemplateId: string | undefined;
  let pushTitle: string | undefined;
  let pushMessage: string | undefined;
  let emailSubject: string | undefined;
  let emailHtml: string | undefined;

  const notificationData: Record<string, any> = { adId, adSlug, adTitle, status };
  if (smsLabel) notificationData.smsLabel = smsLabel;

  // Helper to use channel specific templates
  const useTemplate = (template: any, params: any) => {
    // SMS message for SMS channel
    const smsMessage = template.sms.message(params);
    smsTemplateId = template.sms.templateId;

    // Database message for DB storage (professional format)
    title = template.db.title(params);
    message = template.db.message(params);

    // Channel-specific messages
    pushTitle = template.push.title(params);
    pushMessage = template.push.body(params);
    emailSubject = template.email.subject(params);

    // For email body, we still use generateEmailTemplate but with the specific email body
    const emailBody = template.email.body(params);

    return { emailBody, smsMessage };
  };

  let emailBody = '';
  let smsMessage = '';

  switch (status) {
    case 'APPROVED':
      ({ emailBody, smsMessage } = useTemplate(notificationTemplates.adApproved, { adId, adTitle, expiryDate, adSlug }));
      type = 'AD_APPROVED';
      break;
    case 'REJECTED':
      ({ emailBody, smsMessage } = useTemplate(notificationTemplates.adRejected, { adId, adTitle, rejectionReason, adSlug }));
      type = 'AD_REJECTED';
      notificationData.rejectionReason = rejectionReason;
      break;
    case 'REVIEW':
      ({ emailBody, smsMessage } = useTemplate(notificationTemplates.adReview, { adId, adTitle, adSlug }));
      type = 'AD_REVIEW';
      break;
    case 'EXPIRED':
      ({ emailBody, smsMessage } = useTemplate(notificationTemplates.adExpired, { adId, adTitle, adSlug }));
      type = 'AD_EXPIRED';
      if (expiryDate) notificationData.expiryDate = expiryDate;
      break;
    default:
      title = 'Ad Status Update';
      message = `Your ad "${adTitle}" status has been updated to ${status}`;
      smsMessage = message;
      emailBody = message;
      emailSubject = title;
      pushTitle = title;
      pushMessage = message;
      type = 'GENERAL';
      break;
  }

  // Generate the full HTML using the professional email body
  // We'll get the user first to pass to generateEmailTemplate
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
  emailHtml = generateEmailTemplate(user, emailSubject || title, emailBody, notificationData);

  return sendNotificationToUser(userId, title, message, type, notificationData, {
    smsTemplateId,
    smsMessage,
    pushTitle,
    pushMessage,
    emailSubject,
    emailHtml
  });
}

/**
 * Send notification for ad extension
 */
export async function sendAdExtensionNotification(
  userId: string,
  adId: string,
  days: number,
  expiryDate: string
): Promise<{ pushSuccess: boolean; emailSuccess: boolean; smsSuccess: boolean }> {
  // Get adTitle if possible, otherwise use adId
  const ad = await prisma.ad.findUnique({ where: { id: adId }, select: { title: true, slug: true } });
  const adTitle = ad?.title || adId;

  const params = { adId, adTitle, days, expiryDate };
  const template = notificationTemplates.adExtended;

  // Use DB-specific fields for database storage
  const title = template.db.title();
  const message = template.db.message(params);
  const smsMessage = template.sms.message(params);
  const smsTemplateId = template.sms.templateId;
  const pushTitle = template.push.title(params);
  const pushMessage = template.push.body(params);
  const emailSubject = template.email.subject(params);
  const emailBody = template.email.body(params);
  const type: NotificationType = 'AD_EXTENDED';

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
  const emailHtml = generateEmailTemplate(user, emailSubject, emailBody, { adId, days, expiryDate, adSlug: ad?.slug });

  return sendNotificationToUser(userId, title, message, type, { adId, days, expiryDate, adSlug: ad?.slug }, {
    smsTemplateId,
    smsMessage,
    pushTitle,
    pushMessage,
    emailSubject,
    emailHtml
  });
}

/**
 * Send notification for ad expiring soon
 */
export async function sendAdWillExpireNotification(
  userId: string,
  adId: string,
  expiryDate: string,
  reminderDays?: number
): Promise<{ pushSuccess: boolean; emailSuccess: boolean; smsSuccess: boolean }> {
  const ad = await prisma.ad.findUnique({ where: { id: adId }, select: { title: true, slug: true } });
  const adTitle = ad?.title || adId;

  const params = { adId, adTitle, expiryDate, days: reminderDays };
  const template = notificationTemplates.adWillExpire;

  // Use DB-specific fields for database storage
  const title = template.db.title(params);
  const message = template.db.message(params);
  const smsMessage = template.sms.message(params);
  const smsTemplateId = template.sms.templateId;
  const pushTitle = template.push.title(params);
  const pushMessage = template.push.body(params);
  const emailSubject = template.email.subject(params);
  const emailBody = template.email.body(params);
  const type: NotificationType = 'SUBSCRIPTION_EXPIRY';

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
  const emailHtml = generateEmailTemplate(user, emailSubject, emailBody, { adId, expiryDate, adSlug: ad?.slug, days: reminderDays });

  return sendNotificationToUser(
    userId,
    title,
    message,
    type,
    { adId, adTitle, expiryDate, adSlug: ad?.slug, days: reminderDays },
    {
      smsTemplateId,
      smsMessage,
      pushTitle,
      pushMessage,
      emailSubject,
      emailHtml,
      smsMeta: {
        adId,
        adTitle,
        expiryDate,
        reminderDays,
        notificationType: type,
        label: typeof reminderDays === 'number' ? `pre-expiry:${reminderDays}d` : 'pre-expiry',
      },
    }
  );
}


/**
 * Send booking notification
 */
export async function sendBookingNotification(
  userId: string,
  bookingId: string,
  adTitle: string,
  status: string,
  isOwner: boolean
): Promise<{ pushSuccess: boolean; emailSuccess: boolean }> {
  let title: string;
  let message: string;
  let type: NotificationType;
  const notificationData: Record<string, any> = { bookingId, adTitle, status, isOwner: isOwner.toString() };

  if (isOwner) {
    switch (status) {
      case 'PENDING':
        title = 'New Booking Request';
        message = `You have a new booking request for "${adTitle}"`;
        type = 'BOOKING';
        break;
      case 'CONFIRMED':
        title = 'Booking Confirmed';
        message = `Booking for "${adTitle}" has been confirmed`;
        type = 'BOOKING_UPDATE';
        break;
      case 'CANCELLED':
        title = 'Booking Cancelled';
        message = `A booking for "${adTitle}" has been cancelled`;
        type = 'BOOKING_UPDATE';
        break;
      case 'COMPLETED':
        title = 'Booking Completed';
        message = `A booking for "${adTitle}" has been completed`;
        type = 'BOOKING_UPDATE';
        break;
      case 'CANCELLATION_REQUESTED':
        title = 'Cancellation Requested';
        message = `Buyer has requested to cancel their booking for "${adTitle}"`;
        type = 'BOOKING_UPDATE';
        break;
      case 'CANCELLATION_APPROVED':
        title = 'Cancellation Approved';
        message = `You have approved the cancellation request for "${adTitle}"`;
        type = 'BOOKING_UPDATE';
        break;
      case 'CANCELLATION_REJECTED':
        title = 'Cancellation Rejected';
        message = `You have rejected the cancellation request for "${adTitle}"`;
        type = 'BOOKING_UPDATE';
        break;
      default:
        title = 'Booking Update';
        message = `Booking status for "${adTitle}" has been updated to ${status}`;
        type = 'BOOKING_UPDATE';
        break;
    }
  } else {
    switch (status) {
      case 'CONFIRMED':
        title = 'Booking Confirmed';
        message = `Your booking for "${adTitle}" has been confirmed`;
        type = 'BOOKING_UPDATE';
        break;
      case 'CANCELLED':
        title = 'Booking Cancelled';
        message = `Your booking for "${adTitle}" has been cancelled`;
        type = 'BOOKING_UPDATE';
        break;
      case 'CANCELLATION_REQUESTED':
        title = 'Cancellation Requested';
        message = `Your cancellation request for "${adTitle}" has been sent to the seller`;
        type = 'BOOKING_UPDATE';
        break;
      case 'CANCELLATION_APPROVED':
        title = 'Cancellation Approved';
        message = `Your cancellation request for "${adTitle}" has been approved`;
        type = 'BOOKING_UPDATE';
        break;
      case 'CANCELLATION_REJECTED':
        title = 'Cancellation Rejected';
        message = `Your cancellation request for "${adTitle}" has been rejected by the seller`;
        type = 'BOOKING_UPDATE';
        break;
      default:
        title = 'Booking Update';
        message = `Your booking status for "${adTitle}" is now ${status}`;
        type = 'BOOKING_UPDATE';
        break;
    }
  }

  return sendNotificationToUser(userId, title, message, type, notificationData);
}

/**
 * Generate HTML email template
 */
function generateEmailTemplate(
  user: { firstName?: string } | null,
  title: string,
  message: string,
  data?: Record<string, unknown>
): string {
  const userName = user?.firstName || 'User';

  // Customize message based on notification type
  let customContent = '';
  const adId = data?.adId;
  const bookingId = data?.bookingId;
  const transactionId = data?.transactionId;

  if (adId) {
    const adIdStr = safeStringify(adId);
    customContent += `<p><strong>Ad ID:</strong> ${adIdStr}</p>`;
  }
  if (bookingId) {
    const bookingIdStr = safeStringify(bookingId);
    customContent += `<p><strong>Booking ID:</strong> ${bookingIdStr}</p>`;
  }
  if (transactionId) {
    const transactionIdStr = safeStringify(transactionId);
    customContent += `<p><strong>Transaction ID:</strong> ${transactionIdStr}</p>`;
  }

  const baseUrl = config.apiBaseUrl || 'http://localhost:3001';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #444; background-color: #f4f7f9; margin: 0; padding: 0; }
        .wrapper { background-color: #f4f7f9; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .header { background-color: #007bff; padding: 30px; text-align: center; }
        .header h2 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 40px; }
        .content p { margin-bottom: 20px; font-size: 16px; color: #555; }
        .info-box { background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0; border: 1px solid #e9ecef; }
        .footer { padding: 20px; text-align: center; font-size: 13px; color: #999; border-top: 1px solid #eee; }
        .btn { display: inline-block; padding: 12px 25px; background-color: #007bff; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: 600; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <h2>${title}</h2>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <div>${message}</div>

            ${customContent ? `<div class="info-box">${customContent}</div>` : ''}

            <div style="margin-top: 30px;">
              ${adId ? `<a href="${baseUrl}/detail/ad/${safeStringify(adId)}" class="btn">View My Advertisement</a>` : ''}
              ${bookingId ? `<a href="${baseUrl}/detail/booking/${safeStringify(bookingId)}" class="btn">View Booking Details</a>` : ''}
            </div>

            <p style="margin-top: 40px;">Best regards,<br/><strong>The Pin N Post Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated message from Pin N Post. Please do not reply directly to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Pin N Post. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Safely convert a value to string, handling objects appropriately
 */
function safeStringify(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Convert all values in a record to strings for FCM data payload.
 * Drops keys whose values are null or undefined.
 */
function toFCMStringRecord(data: Record<string, any>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      result[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
  }
  return result;
}

// Legacy functions for backward compatibility
export async function sendPushNotificationToUser(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  data?: Record<string, any>
): Promise<boolean> {
  const result = await sendNotificationToUser(userId, title, message, type, data, { channels: ['push'] });
  return result.pushSuccess;
}

export async function sendPushNotificationToUsers(
  userIds: string[],
  title: string,
  message: string,
  type: NotificationType,
  data?: Record<string, any>
): Promise<{ success: number; failure: number }> {
  const result = await sendNotificationToUsers(userIds, title, message, type, data, { channels: ['push'] });
  return { success: result.pushSuccess, failure: result.totalUsers - result.pushSuccess };
}

/**
 * Send notification to all admin users
 * This is useful for system alerts, ad moderation notifications, etc.
 */
export async function sendNotificationToAdmins(
  title: string,
  message: string,
  type: NotificationType = 'ADMIN_ALERT',
  data?: Record<string, any>
): Promise<{ pushSuccess: number; emailSuccess: number; totalAdmins: number }> {
  try {
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
      logger.info('No active admins found');
      return { pushSuccess: 0, emailSuccess: 0, totalAdmins: 0 };
    }

    const adminIds = admins.map(admin => admin.id);

    const result = await sendNotificationToUsers(
      adminIds,
      title,
      message,
      type,
      data,
      {
        channels: [...ADMIN_NOTIFICATION_CHANNELS],
        forceChannels: true,
      }
    );

    console.log(`Admin notification sent: ${result.pushSuccess} push, ${result.emailSuccess} email (${adminIds.length} admins)`);

    return {
      pushSuccess: result.pushSuccess,
      emailSuccess: result.emailSuccess,
      totalAdmins: adminIds.length
    };
  } catch (error) {
    logger.error('Failed to send notification to admins:', error);
    return { pushSuccess: 0, emailSuccess: 0, totalAdmins: 0 };
  }
}