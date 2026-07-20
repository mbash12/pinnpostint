import { Queue } from 'bull';
import { ScheduleConfig, SchedulerConfig } from '../interfaces/config.interface';
import { BullJobQueueManager } from '../queue-manager/job-queue-manager';
import { getJobConfig } from '../config/job.config';
import { config } from '../../config/environment';
export class CronScheduler {
  private jobQueueManager: BullJobQueueManager;
  private config: SchedulerConfig;
  private scheduledJobs: Map<string, Queue> = new Map();

  constructor(jobQueueManager: BullJobQueueManager) {
    this.jobQueueManager = jobQueueManager;
    this.config = getJobConfig();
  }

  /**
   * Initialize all scheduled jobs from configuration
   */
  async initializeSchedules(): Promise<void> {
    console.log('Initializing scheduled jobs...');
    
    for (const [scheduleName, scheduleConfig] of Object.entries(this.config.schedules)) {
      await this.addScheduledJob(scheduleName, scheduleConfig);
    }

    console.log(`Initialized ${Object.keys(this.config.schedules).length} scheduled jobs`);

    // ── Startup catch-up ──────────────────────────────────────────
    // Only fire outside the active window. Inside the window, the
    // 10-min cron ticks handle everything — running catch-up here
    // would race with the cron and risk duplicate SMS.

    const gateNow = new Date();
    const utcHour = gateNow.getUTCHours();
    const utcMinute = gateNow.getUTCMinutes();
    const isDebug = config.server.expiredNotificationDebug;

    const inPreExpiryWindow = isDebug
      ? (utcHour === 8 && utcMinute >= 30) || (utcHour === 9 && utcMinute === 0)
      : utcHour >= 2 && utcHour <= 3;

    // Cleanup is always safe — idempotent (marks EXPIRED, 2nd run is no-op)
    this.triggerScheduledJob('ad-expiration-cleanup-check')
      .then(() => console.log('Startup catch-up: cleanup scan completed'))
      .catch(err => console.error('Startup catch-up: cleanup scan failed:', err));

    if (inPreExpiryWindow) {
      console.log('Startup catch-up skipped for pre-expiry — inside active window, cron will handle it');
    } else {
      this.triggerScheduledJob('ad-expiration-check')
        .then(() => console.log('Startup catch-up: reminder scan completed'))
        .catch(err => console.error('Startup catch-up: reminder scan failed:', err));
    }
  }

  /**
   * Add a new scheduled job
   */
  async addScheduledJob(name: string, scheduleConfig: ScheduleConfig): Promise<void> {
    try {
      const queue = this.jobQueueManager.getQueueInstance(scheduleConfig.jobType);
      await this.removeStaleRepeatableJobs(queue, scheduleConfig.jobType);
      
      // Add repeatable job with cron schedule
      await queue.add(
        scheduleConfig.jobType,
        scheduleConfig.data || {},
        {
          repeat: { cron: scheduleConfig.cron },
          removeOnComplete: 10, // Keep last 10 completed jobs
          removeOnFail: 5, // Keep last 5 failed jobs
        }
      );

      this.scheduledJobs.set(name, queue);
      console.log(`Scheduled job '${name}' added with cron: ${scheduleConfig.cron}`);
    } catch (error) {
      console.error(`Failed to add scheduled job '${name}':`, error);
      throw error;
    }
  }

  /**
   * Remove outdated repeatable jobs that are no longer present in config.
   * This prevents stale Redis cron entries (e.g. old every-minute schedules)
   * from continuing to run after cron changes in code.
   */
  private async removeStaleRepeatableJobs(queue: Queue, jobType: string): Promise<void> {
    const repeatableJobs = await queue.getRepeatableJobs();
    const validCrons = new Set(
      Object.values(this.config.schedules)
        .filter(schedule => schedule.jobType === jobType)
        .map(schedule => schedule.cron)
    );

    for (const repeatableJob of repeatableJobs) {
      if (repeatableJob.name !== jobType) {
        continue;
      }

      if (!validCrons.has(repeatableJob.cron)) {
        await queue.removeRepeatableByKey(repeatableJob.key);
        console.log(
          `Removed stale repeatable job '${jobType}' with cron '${repeatableJob.cron}'`
        );
      }
    }
  }

  /**
   * Remove a scheduled job
   */
  async removeScheduledJob(name: string): Promise<void> {
    const queue = this.scheduledJobs.get(name);
    if (!queue) {
      console.warn(`Scheduled job '${name}' not found`);
      return;
    }

    try {
      // Get all repeatable jobs and remove the one matching our name
      const repeatableJobs = await queue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === this.config.schedules[name]?.jobType) {
          await queue.removeRepeatableByKey(job.key);
          console.log(`Removed scheduled job '${name}'`);
        }
      }

      this.scheduledJobs.delete(name);
    } catch (error) {
      console.error(`Failed to remove scheduled job '${name}':`, error);
      // Don't throw during shutdown — Redis may already be closed.
    }
  }

  /**
   * Get status of all scheduled jobs
   */
  async getScheduleStatus(): Promise<Array<{
    name: string;
    jobType: string;
    cron: string;
    nextRun?: Date;
    isActive: boolean;
  }>> {
    const status: any[] = [];

    for (const [name, queue] of Array.from(this.scheduledJobs.entries())) {
      const scheduleConfig = this.config.schedules[name];
      if (!scheduleConfig) continue;

      try {
        const repeatableJobs = await queue.getRepeatableJobs();
        const matchingJob = repeatableJobs.find(job => job.name === scheduleConfig.jobType);

        status.push({
          name,
          jobType: scheduleConfig.jobType,
          cron: scheduleConfig.cron,
          nextRun: matchingJob?.next ? new Date(matchingJob.next) : undefined,
          isActive: !!matchingJob,
        });
      } catch (error) {
        console.error(`Failed to get status for scheduled job '${name}':`, error);
        status.push({
          name,
          jobType: scheduleConfig.jobType,
          cron: scheduleConfig.cron,
          isActive: false,
        });
      }
    }

    return status;
  }

  /**
   * Manually trigger a scheduled job
   */
  async triggerScheduledJob(name: string): Promise<void> {
    const scheduleConfig = this.config.schedules[name];
    if (!scheduleConfig) {
      throw new Error(`Scheduled job '${name}' not found in configuration`);
    }

    try {
      await this.jobQueueManager.addJob(
        scheduleConfig.jobType,
        { ...scheduleConfig.data, manualTrigger: true }
      );
      console.log(`Manually triggered scheduled job '${name}'`);
    } catch (error) {
      console.error(`Failed to manually trigger scheduled job '${name}':`, error);
      throw error;
    }
  }

  /**
   * Update schedule configuration and restart scheduled jobs
   */
  async updateSchedules(newSchedules: { [name: string]: ScheduleConfig }): Promise<void> {
    console.log('Updating scheduled jobs configuration...');

    // Remove existing scheduled jobs
    for (const name of Array.from(this.scheduledJobs.keys())) {
      await this.removeScheduledJob(name);
    }

    // Update configuration
    this.config.schedules = newSchedules;

    // Re-initialize with new configuration
    await this.initializeSchedules();

    console.log('Scheduled jobs configuration updated');
  }

  /**
   * Shutdown scheduler and clean up resources
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down cron scheduler...');

    for (const name of Array.from(this.scheduledJobs.keys())) {
      try {
        await this.removeScheduledJob(name);
      } catch (error) {
        console.error(`Cron scheduler: failed to remove '${name}' during shutdown:`, error);
      }
    }

    this.scheduledJobs.clear();
    console.log('Cron scheduler shut down');
  }
}