import { BullWorker } from './worker';
import {
  JOB_TYPES,
  adExpirationReminderHandler,
  adAfterExpiredReminderHandler,
  adExpirationCleanupHandler,
  autoApplyRevisionsHandler,
  notificationDeliveryHandler,
  dataCleanupHandler,
  emailOtpHandler,
  smsOtpHandler,
  bookingAutoProcessHandler,
  smsOutboxDrainHandler,
  smsOutboxCleanupHandler
} from '../handlers';

/**
 * Register all job handlers with the worker
 */
export function registerJobHandlers(worker: BullWorker): void {
  console.log('Registering job handlers...');

  // Register ad expiration handlers
  worker.process(JOB_TYPES.AD_EXPIRATION_REMINDER, adExpirationReminderHandler);
  worker.process(JOB_TYPES.AD_AFTER_EXPIRED_REMINDER, adAfterExpiredReminderHandler);
  worker.process(JOB_TYPES.AD_EXPIRATION_CLEANUP, adExpirationCleanupHandler);

  // Register auto-apply revisions handler
  worker.process(JOB_TYPES.AUTO_APPLY_REVISIONS, autoApplyRevisionsHandler);



  // Register notification delivery handler
  worker.process(JOB_TYPES.NOTIFICATION_DELIVERY, notificationDeliveryHandler);

  // Register data cleanup handler
  worker.process(JOB_TYPES.DATA_CLEANUP, dataCleanupHandler);

  // Register OTP handlers
  worker.process(JOB_TYPES.EMAIL_OTP, emailOtpHandler);
  worker.process(JOB_TYPES.SMS_OTP, smsOtpHandler);

  // Register booking auto-process handler
  worker.process(JOB_TYPES.BOOKING_AUTO_PROCESS, bookingAutoProcessHandler);

  // Register SMS outbox drain handler
  worker.process(JOB_TYPES.SMS_OUTBOX_DRAIN, smsOutboxDrainHandler);

  // Register SMS outbox cleanup handler
  worker.process(JOB_TYPES.SMS_OUTBOX_CLEANUP, smsOutboxCleanupHandler);

  console.log('All job handlers registered successfully');
}

/**
 * Get list of all registered job types
 */
export function getRegisteredJobTypes(): string[] {
  return Object.values(JOB_TYPES);
}

/**
 * Check if a job type is supported
 */
export function isJobTypeSupported(jobType: string): boolean {
  return Object.values(JOB_TYPES).includes(jobType as any);
}