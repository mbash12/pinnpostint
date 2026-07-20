import { Job, JobHandler } from '../interfaces/job.interface';
import { drainOutbox, getOutboxStats, DrainResult } from '../../utils/smsOutbox';
import { setSchedulerHeartbeat } from '../utils/redis-connection';

interface SmsOutboxDrainData {
  manualTrigger?: boolean;
  batchSize?: number;
}

export const smsOutboxDrainHandler: JobHandler<SmsOutboxDrainData> = async (job: Job<SmsOutboxDrainData>): Promise<void> => {
  const batchSize = job.data?.batchSize ?? 100;
  const manualTrigger = job.data?.manualTrigger === true;

  const start = Date.now();
  let result: DrainResult;
  try {
    result = await drainOutbox(undefined, { batchSize });
  } catch (error) {
    // Only fatal error is Postgres being down — let Bull retry.
    console.error('[sms-outbox-drain] drainOutbox threw:', error);
    throw error;
  }

  const elapsedMs = Date.now() - start;

  // Heartbeat: the drain cron runs every minute with no time gate, so a
  // successful (or even empty) tick here doubles as proof that the Bull
  // scheduler is alive. `/health/ready` reads this so a wedged scheduler
  // surfaces as unhealthy and the watchdog recreates the container.
  await setSchedulerHeartbeat();

  // Observability — keep this as console.log so it shows up in the api.log
  // even when no logger helper is wired in for this handler.
  console.log(
    `[sms-outbox-drain] ${manualTrigger ? 'manual' : 'cron'} batch=${batchSize} ` +
      `scanned=${result.scanned} sent=${result.sent} ` +
      `retried=${result.failed} exhausted=${result.exhausted} elapsed=${elapsedMs}ms`
  );

  if (result.exhausted > 0) {
    // Best-effort alert: count remaining FAILED rows so ops can see backlog.
    try {
      const stats = await getOutboxStats();
      console.warn(
        `[sms-outbox-drain] outbox stats after drain: ${JSON.stringify(stats)}`
      );
    } catch (error) {
      console.error('[sms-outbox-drain] failed to read outbox stats:', error);
    }
  }
};
