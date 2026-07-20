import { Job, JobHandler, JobPriority } from '../interfaces/job.interface';
import { getEmailService } from '../../utils/email';
import { buildOtpSms } from '../../utils/sms';
import { enqueueSms } from '../../utils/smsOutbox';

export interface EmailOtpData {
  to: string;
  otp: string;
  subject?: string;
}

export interface SmsOtpData {
  to: string;
  otp: string;
}

/**
 * Job handler for sending OTP emails
 * Processes email OTP sending jobs asynchronously
 */
export const emailOtpHandler: JobHandler<EmailOtpData> = async (job: Job<EmailOtpData>): Promise<void> => {
  console.log(`[Email OTP Job] Processing job ${job.id} for ${job.data.to}`);

  try {
    const { to, otp, subject } = job.data;
    const emailService = getEmailService();

    const result = await emailService.sendOtpEmail(to, otp);

    if (result.success) {
      console.log(`[Email OTP Job] Successfully sent OTP email to ${to}`);
    } else {
      console.error(`[Email OTP Job] Failed to send OTP email to ${to}:`, result.error);
      throw new Error(result.error || 'Failed to send OTP email');
    }
  } catch (error) {
    console.error(`[Email OTP Job] Error processing job ${job.id}:`, error);
    throw error;
  }
};

/**
 * Job handler for sending OTP SMS
 * Processes SMS OTP sending jobs asynchronously
 *
 * Routes through the durable SMS outbox. The Bull job itself acts as a
 * fast-path attempt; if the provider rejects the message the row stays
 * in the outbox and the `sms-outbox-drain` cron retries it with
 * exponential backoff (max 3 attempts inside the 10-min OTP window).
 *
 * `enqueueSms` only throws when the outbox row itself cannot be
 * written (Postgres down) — in that case Bull's retry kicks in so
 * we don't lose the OTP enqueue.
 */
export const smsOtpHandler: JobHandler<SmsOtpData> = async (job: Job<SmsOtpData>): Promise<void> => {
  console.log(`[SMS OTP Job] Processing job ${job.id} for ${job.data.to}`);

  try {
    const { to, otp } = job.data;

    // Pre-render the message and template id. The drain cron retries
    // by re-sending the stored message verbatim, so we must capture the
    // final rendered text at enqueue time (template config could change
    // between attempts and we don't want a user to see two different
    // OTPs).
    const { message, templateId } = buildOtpSms(otp);

    const result = await enqueueSms({
      to,
      message,
      templateId,
      kind: 'otp',
    });

    if (result.sent) {
      console.log(`[SMS OTP Job] Successfully sent OTP SMS to ${to}`);
    } else {
      console.warn(
        `[SMS OTP Job] OTP for ${to} did not send immediately; ` +
          `queued in outbox row ${result.id} for retry: ${result.error}`
      );
    }
  } catch (error) {
    console.error(`[SMS OTP Job] Error processing job ${job.id}:`, error);
    throw error;
  }
};

/**
 * Helper function to create an email OTP job
 */
export async function createEmailOtpJob(data: EmailOtpData): Promise<void> {
  const { BullJobQueueManager } = await import('../queue-manager/job-queue-manager');
  const queueManager = new BullJobQueueManager();

  try {
    await queueManager.addJob('email-otp', data, {
      priority: JobPriority.HIGH, // OTP emails should be sent quickly
      attempts: 3, // Retry up to 3 times
      timeout: 30000, // 30 second timeout
    });
    console.log(`[Email OTP Job] Added job for ${data.to}`);
  } catch (error) {
    console.error(`[Email OTP Job] Failed to add job:`, error);
    throw error;
  }
}

/**
 * Helper function to create an SMS OTP job
 */
export async function createSmsOtpJob(data: SmsOtpData): Promise<void> {
  const { BullJobQueueManager } = await import('../queue-manager/job-queue-manager');
  const queueManager = new BullJobQueueManager();

  try {
    await queueManager.addJob('sms-otp', data, {
      priority: JobPriority.HIGH, // OTP SMS should be sent quickly
      attempts: 3, // Retry up to 3 times
      timeout: 30000, // 30 second timeout
    });
    console.log(`[SMS OTP Job] Added job for ${data.to}`);
  } catch (error) {
    console.error(`[SMS OTP Job] Failed to add job:`, error);
    throw error;
  }
}
