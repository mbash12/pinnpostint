import { Job, JobHandler } from '../interfaces/job.interface';
import {
  cleanupOldOutboxRows,
  getOutboxStats,
  DEFAULT_SMS_OUTBOX_RETENTION_DAYS,
} from '../../utils/smsOutbox';

interface SmsOutboxCleanupData {
  manualTrigger?: boolean;
  retentionDays?: number;
}

/**
 * Nightly cron that drops outbox rows older than the retention window
 * so the table doesn't grow without bound. Default retention covers
 * max pre-expiry lead days used by the admin SMS tracker.
 * Failure here means the table will keep accumulating; we rethrow so
 * Bull retries with backoff rather than silently letting the leak continue.
 */
export const smsOutboxCleanupHandler: JobHandler<SmsOutboxCleanupData> = async (
  job: Job<SmsOutboxCleanupData>
): Promise<void> => {
  const retentionDays = job.data?.retentionDays ?? DEFAULT_SMS_OUTBOX_RETENTION_DAYS;
  const manualTrigger = job.data?.manualTrigger === true;

  const start = Date.now();
  let beforeCounts: Awaited<ReturnType<typeof getOutboxStats>> | null = null;
  try {
    beforeCounts = await getOutboxStats();
  } catch (error) {
    // Non-fatal — we'll still try the cleanup.
    console.warn('[sms-outbox-cleanup] failed to read pre-cleanup stats:', error);
  }

  const result = await cleanupOldOutboxRows(undefined, { retentionDays });
  const elapsedMs = Date.now() - start;

  console.log(
    `[sms-outbox-cleanup] ${manualTrigger ? 'manual' : 'cron'} ` +
      `retention=${retentionDays}d cutoff=${result.cutoff.toISOString()} ` +
      `deleted=${result.deleted} elapsed=${elapsedMs}ms` +
      (beforeCounts
        ? ` (before: PENDING=${beforeCounts.PENDING} SENT=${beforeCounts.SENT} FAILED=${beforeCounts.FAILED} DEAD=${beforeCounts.DEAD})`
        : '')
  );
};
