/**
 * Admin Notification Helpers
 * Send push notifications to admins for important events (async via queue)
 */

import { queueAdminNotifications } from '../background/queues/notification.queue';
import { NotificationType } from '@prisma/client';

/**
 * Send notification to admins when a new ad is submitted for review
 */
export function notifyAdminsNewAdPending(adId: string, adTitle: string, advertiserName: string): void {
  queueAdminNotifications(
    'New Ad Pending Review',
    `"${adTitle}" by ${advertiserName} is waiting for your approval`,
    'ADMIN_ALERT',
    { adId, adTitle, advertiserName, action: 'review_ad' }
  ).catch(err => console.error('Failed to queue admin notification about new pending ad:', err));
}

/**
 * Send notification to admins when an ad is flagged
 */
export function notifyAdminsAdFlagged(adId: string, adTitle: string, flagReason: string): void {
  queueAdminNotifications(
    'Ad Flagged for Review',
    `"${adTitle}" has been flagged: ${flagReason}`,
    'ADMIN_ALERT',
    { adId, adTitle, flagReason, action: 'review_flagged_ad' }
  ).catch(err => console.error('Failed to queue admin notification about flagged ad:', err));
}

/**
 * Send notification to admins when a new booking is made
 */
export function notifyAdminsNewBooking(bookingId: string, adTitle: string, customerName: string): void {
  queueAdminNotifications(
    'New Booking Request',
    `${customerName} requested to book "${adTitle}"`,
    'ADMIN_ALERT',
    { bookingId, adTitle, customerName, action: 'view_booking' }
  ).catch(err => console.error('Failed to queue admin notification about new booking:', err));
}

/**
 * Send notification to admins about a payment issue
 */
export function notifyAdminsPaymentIssue(transactionId: string, errorMessage: string): void {
  queueAdminNotifications(
    'Payment Processing Issue',
    `Transaction ${transactionId} failed: ${errorMessage}`,
    'ADMIN_ALERT',
    { transactionId, errorMessage, action: 'view_payment' }
  ).catch(err => console.error('Failed to queue admin notification about payment issue:', err));
}

/**
 * Send notification to admins about system errors
 */
export function notifyAdminsSystemError(errorType: string, errorMessage: string, metadata?: Record<string, any>): void {
  queueAdminNotifications(
    'System Alert',
    `${errorType}: ${errorMessage}`,
    'SYSTEM',
    { errorType, errorMessage, ...metadata }
  ).catch(err => console.error('Failed to queue admin notification about system error:', err));
}

/**
 * Send notification to admins about high priority user report
 */
export function notifyAdminsUserReport(reportType: string, reportDetails: string, reporterName?: string): void {
  queueAdminNotifications(
    'User Report Received',
    `${reportType} report${reporterName ? ` from ${reporterName}` : ''}: ${reportDetails}`,
    'ADMIN_ALERT',
    { reportType, reportDetails, reporterName, action: 'view_reports' }
  ).catch(err => console.error('Failed to queue admin notification about user report:', err));
}

/**
 * Send notification to admins about subscription expiring soon
 */
export function notifyAdminsSubscriptionExpiring(adId: string, adTitle: string, daysRemaining: number): void {
  queueAdminNotifications(
    'Ad Subscription Expiring',
    `"${adTitle}" subscription expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
    'ADMIN_ALERT',
    { adId, adTitle, daysRemaining, action: 'view_subscription' }
  ).catch(err => console.error('Failed to queue admin notification about expiring subscription:', err));
}

/**
 * Send a custom admin alert
 */
export function sendAdminAlert(
  title: string,
  message: string,
  data?: Record<string, any>
): void {
  queueAdminNotifications(
    title,
    message,
    'ADMIN_ALERT',
    data
  ).catch(err => console.error('Failed to queue admin alert:', err));
}
