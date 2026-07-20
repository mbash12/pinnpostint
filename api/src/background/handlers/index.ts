// Ad expiration handlers
export {
  adExpirationReminderHandler,
  adAfterExpiredReminderHandler,
  adExpirationCleanupHandler,
  autoApplyRevisionsHandler,
  findExpiringAds,
  findExpiredAds
} from './ad-expiration.handler';


// Notification delivery handlers
export {
  notificationDeliveryHandler
} from './notification-delivery.handler';

// Data cleanup handlers
export {
  dataCleanupHandler,
  getCleanupStats
} from './data-cleanup.handler';

// OTP handlers
export {
  emailOtpHandler,
  smsOtpHandler,
  createEmailOtpJob,
  createSmsOtpJob
} from './otp.handler';

// Booking auto-process handlers
export {
  bookingAutoProcessHandler,
  findBookingsToAutoComplete,
  findBookingsToAutoCancel
} from './booking-auto-process.handler';

// SMS outbox drain handler — periodically retries failed/due SMS rows
export {
  smsOutboxDrainHandler
} from './sms-outbox-drain.handler';

// SMS outbox cleanup handler — nightly cron that drops old rows
export {
  smsOutboxCleanupHandler
} from './sms-outbox-cleanup.handler';

// Job type constants
export const JOB_TYPES = {
  AD_EXPIRATION_REMINDER: 'ad-expiration-reminder',
  AD_AFTER_EXPIRED_REMINDER: 'ad-after-expired-reminder',
  AD_EXPIRATION_CLEANUP: 'ad-expiration-cleanup',
  AUTO_APPLY_REVISIONS: 'auto-apply-revisions',
  NOTIFICATION_DELIVERY: 'notification-delivery',
  DATA_CLEANUP: 'data-cleanup',
  EMAIL_OTP: 'email-otp',
  SMS_OTP: 'sms-otp',
  BOOKING_AUTO_PROCESS: 'booking-auto-process',
  SMS_OUTBOX_DRAIN: 'sms-outbox-drain',
  SMS_OUTBOX_CLEANUP: 'sms-outbox-cleanup'
} as const;

export type JobType = typeof JOB_TYPES[keyof typeof JOB_TYPES];