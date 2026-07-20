import { SchedulerConfig } from '../interfaces/config.interface';
import { getRedisConfig } from './redis.config';

export const getJobConfig = (): SchedulerConfig => {
  return {
    redis: getRedisConfig(),
    jobs: {
      'ad-expiration-reminder': {
        concurrency: 5,
        attempts: 3,
        backoff: 'exponential',
      },
      'ad-after-expired-reminder': {
        concurrency: 5,
        attempts: 3,
        backoff: 'exponential',
      },
      'ad-expiration-cleanup': {
        concurrency: 10,
        attempts: 3,
        backoff: 'exponential',
      },
      'notification-delivery': {
        concurrency: 10,
        attempts: 3,
        backoff: 'exponential',
      },
      'data-cleanup': {
        concurrency: 2,
        attempts: 2,
        backoff: 'fixed',
      },
      'auto-apply-revisions': {
        concurrency: 5,
        attempts: 3,
        backoff: 'exponential',
      },
      'email-otp': {
        concurrency: 10, // Process multiple emails concurrently
        attempts: 3,
        backoff: 'exponential',
      },
      'sms-otp': {
        concurrency: 10, // Process multiple SMS concurrently
        attempts: 3,
        backoff: 'exponential',
      },
      'booking-auto-process': {
        concurrency: 5,
        attempts: 3,
        backoff: 'exponential',
      },
      'sms-outbox-drain': {
        // Single-flight drain is fine — the handler is internally batched
        // and we don't want two cron ticks racing on the same rows.
        concurrency: 1,
        attempts: 2,
        backoff: 'fixed',
      },
      'sms-outbox-cleanup': {
        concurrency: 1,
        attempts: 3,
        backoff: 'exponential',
      },
    },
    schedules: {
      'daily-cleanup': {
        cron: '0 2 * * *', // Daily at 2 AM
        jobType: 'data-cleanup',
        data: { type: 'daily' },
      },
      'weekly-cleanup': {
        cron: '0 3 * * 0', // Weekly on Sunday at 3 AM
        jobType: 'data-cleanup',
        data: { type: 'weekly' },
      },
      'ad-expiration-check': {
        cron: '*/10 2-4,8-11 * * *', // 8 AM IST (2-4 UTC) + debug 2-5 PM IST (8-11 UTC)
        jobType: 'ad-expiration-reminder',
      },
      'ad-expiration-cleanup-check': {
        cron: '0 * * * *', // Every hour — marks expired ads as EXPIRED
        jobType: 'ad-expiration-cleanup',
      },
      'ad-after-expired-reminder-check': {
        cron: '*/10 2-4,8-9 * * *', // 8 AM IST (2-4 UTC) + debug 2 PM IST (8-9 UTC)
        jobType: 'ad-after-expired-reminder',
      },
      'auto-apply-revisions': {
        cron: '0 * * * *', // Every hour
        jobType: 'auto-apply-revisions',
      },
      'booking-auto-process-check': {
        cron: '0 10 * * *', // Daily at 10 AM
        jobType: 'booking-auto-process',
      },
      'sms-outbox-drain-check': {
        cron: '* * * * *', // Every minute — sweep PENDING outbox rows whose nextRetryAt is due
        jobType: 'sms-outbox-drain',
      },
      'sms-outbox-cleanup-check': {
        cron: '0 2 * * *', // Nightly at 2 AM — drop outbox rows older than 7 days
        jobType: 'sms-outbox-cleanup',
      },
    },
  };
};
