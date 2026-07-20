import Bull from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { 
  Job, 
  JobOptions, 
  JobQueueManager, 
  JobStatus, 
  JobPriority,
  JobCounts,
  JobError
} from '../interfaces/job.interface';
import { getRedisUrl } from '../config/redis.config';
import { getJobConfig } from '../config/job.config';

export class BullJobQueueManager implements JobQueueManager {
  private queues: Map<string, Bull.Queue> = new Map();
  private redisUrl: string;
  private queueProvider?: (jobType: string) => Bull.Queue | undefined;

  constructor() {
    this.redisUrl = getRedisUrl();
  }

  /**
   * Initialize all queues defined in the job configuration
   * This ensures queues exist before the worker tries to use them
   */
  initializeAllQueues(): void {
    const config = getJobConfig();
    const jobTypes = Object.keys(config.jobs);

    console.log(`Pre-initializing ${jobTypes.length} job queues...`);

    for (const jobType of jobTypes) {
      if (!this.queues.has(jobType)) {
        const jobConfig = config.jobs[jobType];
        const queue = new Bull(jobType, this.redisUrl, {
          defaultJobOptions: {
            attempts: jobConfig.attempts,
            backoff: {
              type: jobConfig.backoff,
              delay: 2000,
            },
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        });
        this.queues.set(jobType, queue);
        console.log(`Initialized queue: ${jobType}`);
      }
    }

    console.log('All job queues initialized');
  }

  setQueueProvider(provider: (jobType: string) => Bull.Queue | undefined): void {
    this.queueProvider = provider;
  }

  private getQueue(jobType: string): Bull.Queue {
    // Check if we already have this queue in our cache
    if (this.queues.has(jobType)) {
      return this.queues.get(jobType)!;
    }

    // First check if there's an external queue provider (e.g., from BullWorker)
    // This ensures we use the worker's queue if it has one created
    if (this.queueProvider) {
      const externalQueue = this.queueProvider(jobType);
      if (externalQueue) {
        return externalQueue;
      }
    }

    // Create our own queue instance
    const config = getJobConfig();
    const jobConfig = config.jobs[jobType] || {
      concurrency: 1,
      attempts: 3,
      backoff: 'exponential',
    };

    const queue = new Bull(jobType, this.redisUrl, {
      defaultJobOptions: {
        attempts: jobConfig.attempts,
        backoff: {
          type: jobConfig.backoff,
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    this.queues.set(jobType, queue);
    return queue;
  }

  async addJob<T = unknown>(jobType: string, data: T, options?: JobOptions): Promise<Job<T>> {
    try {
      const queue = this.getQueue(jobType);
      const jobId = uuidv4();

      const bullJobOptions: Bull.JobOptions = {
        jobId,
        delay: options?.delay,
        priority: options?.priority || JobPriority.NORMAL,
        attempts: options?.attempts || 3,
        removeOnComplete: options?.removeOnComplete !== false,
        removeOnFail: options?.removeOnFail !== false,
      };

      if (options?.timeout) {
        bullJobOptions.timeout = options.timeout;
      }

      if (options?.cron) {
        bullJobOptions.repeat = { cron: options.cron };
      }

      const bullJob = await queue.add(jobType, data as unknown as Record<string, unknown>, bullJobOptions);

      const job: Job<T> = {
        id: bullJob.id as string,
        type: jobType,
        data: bullJob.data as T,
        status: JobStatus.PENDING,
        attempts: 0,
        maxAttempts: options?.attempts || 3,
        priority: options?.priority || JobPriority.NORMAL,
        createdAt: new Date(bullJob.timestamp),
        delay: options?.delay,
        timeout: options?.timeout,
      };

      console.log(`Job ${job.id} of type ${jobType} added to queue`);
      return job;
    } catch (error) {
      console.error(`Failed to add job of type ${jobType}:`, error);
      throw new JobError(`Failed to add job: ${error instanceof Error ? error.message : 'Unknown error'}`, '', jobType, 0, error instanceof Error ? error : undefined);
    }
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    // Search through all queues to find the job
    for (const [jobType, queue] of Array.from(this.queues.entries())) {
      try {
        const job = await queue.getJob(jobId);
        if (job) {
          const state = await job.getState();
          return this.mapBullStateToJobStatus(state);
        }
      } catch (error) {
        console.error(`Error getting job ${jobId} from queue ${jobType}:`, error);
      }
    }

    throw new JobError(`Job ${jobId} not found`, jobId, 'unknown', 0);
  }

  async getJob<T = unknown>(jobId: string): Promise<Job<T> | null> {
    // Search through all queues to find the job
    for (const [jobType, queue] of Array.from(this.queues.entries())) {
      try {
        const bullJob = await queue.getJob(jobId);
        if (bullJob) {
          return this.mapBullJobToJob<T>(bullJob, jobType);
        }
      } catch (error) {
        console.error(`Error getting job ${jobId} from queue ${jobType}:`, error);
      }
    }

    return null;
  }

  private mapBullStateToJobStatus(state: string): JobStatus {
    switch (state) {
      case 'waiting':
      case 'delayed':
        return JobStatus.PENDING;
      case 'active':
        return JobStatus.PROCESSING;
      case 'completed':
        return JobStatus.COMPLETED;
      case 'failed':
        return JobStatus.FAILED;
      default:
        return JobStatus.PENDING;
    }
  }

  private async mapBullJobToJob<T = unknown>(bullJob: Bull.Job, jobType: string): Promise<Job<T>> {
    const state = await bullJob.getState();
    const status = this.mapBullStateToJobStatus(state);

    return {
      id: bullJob.id as string,
      type: jobType,
      data: bullJob.data as T,
      status,
      attempts: bullJob.attemptsMade,
      maxAttempts: bullJob.opts.attempts || 3,
      priority: (bullJob.opts.priority as JobPriority) || JobPriority.NORMAL,
      createdAt: new Date(bullJob.timestamp),
      processedAt: bullJob.processedOn ? new Date(bullJob.processedOn) : undefined,
      completedAt: bullJob.finishedOn && status === JobStatus.COMPLETED ? new Date(bullJob.finishedOn) : undefined,
      failedAt: bullJob.finishedOn && status === JobStatus.FAILED ? new Date(bullJob.finishedOn) : undefined,
      error: bullJob.failedReason,
      delay: bullJob.opts.delay,
      timeout: bullJob.opts.timeout,
    };
  }

  async retryJob(jobId: string): Promise<void> {
    // Search through all queues to find and retry the job
    for (const [jobType, queue] of Array.from(this.queues.entries())) {
      try {
        const job = await queue.getJob(jobId);
        if (job) {
          const state = await job.getState();
          if (state === 'failed') {
            await job.retry();
            console.log(`Job ${jobId} retried successfully`);
            return;
          } else {
            throw new JobError(`Job ${jobId} is not in failed state, current state: ${state}`, jobId, jobType, job.attemptsMade);
          }
        }
      } catch (error) {
        console.error(`Error retrying job ${jobId} from queue ${jobType}:`, error);
        if (error instanceof JobError) {
          throw error;
        }
      }
    }

    throw new JobError(`Job ${jobId} not found for retry`, jobId, 'unknown', 0);
  }

  async removeJob(jobId: string): Promise<void> {
    // Search through all queues to find and remove the job
    for (const [jobType, queue] of Array.from(this.queues.entries())) {
      try {
        const job = await queue.getJob(jobId);
        if (job) {
          await job.remove();
          console.log(`Job ${jobId} removed successfully`);
          return;
        }
      } catch (error) {
        console.error(`Error removing job ${jobId} from queue ${jobType}:`, error);
      }
    }

    throw new JobError(`Job ${jobId} not found for removal`, jobId, 'unknown', 0);
  }

  async getJobCounts(): Promise<JobCounts> {
    const counts: JobCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      retrying: 0,
      dead: 0,
    };

    for (const [jobType, queue] of Array.from(this.queues.entries())) {
      try {
        const waiting = await queue.getWaiting();
        const delayed = await queue.getDelayed();
        const active = await queue.getActive();
        const completed = await queue.getCompleted();
        const failed = await queue.getFailed();

        counts.pending += waiting.length + delayed.length;
        counts.processing += active.length;
        counts.completed += completed.length;
        counts.failed += failed.length;
      } catch (error) {
        console.error(`Error getting job counts for queue ${jobType}:`, error);
      }
    }

    return counts;
  }

  async getFailedJobs(limit: number = 50): Promise<Job[]> {
    const failedJobs: Job[] = [];

    for (const [jobType, queue] of Array.from(this.queues.entries())) {
      try {
        const failed = await queue.getFailed(0, limit);
        for (const bullJob of failed) {
          const job = await this.mapBullJobToJob(bullJob, jobType);
          failedJobs.push(job);
        }
      } catch (error) {
        console.error(`Error getting failed jobs for queue ${jobType}:`, error);
      }
    }

    return failedJobs.slice(0, limit);
  }

  async getCompletedJobs(limit: number = 50): Promise<Job[]> {
    const completedJobs: Job[] = [];

    for (const [jobType, queue] of Array.from(this.queues.entries())) {
      try {
        const completed = await queue.getCompleted(0, limit);
        for (const bullJob of completed) {
          const job = await this.mapBullJobToJob(bullJob, jobType);
          completedJobs.push(job);
        }
      } catch (error) {
        console.error(`Error getting completed jobs for queue ${jobType}:`, error);
      }
    }

    return completedJobs.slice(0, limit);
  }

  async cleanJobs(status: JobStatus, olderThan: number): Promise<number> {
    let totalCleaned = 0;

    for (const [jobType, queue] of Array.from(this.queues.entries())) {
      try {
        let cleaned = 0;
        
        switch (status) {
          case JobStatus.COMPLETED: {
            const completedJobs = await queue.clean(olderThan, 'completed');
            cleaned = Array.isArray(completedJobs) ? completedJobs.length : 0;
            break;
          }
          case JobStatus.FAILED: {
            const failedJobs = await queue.clean(olderThan, 'failed');
            cleaned = Array.isArray(failedJobs) ? failedJobs.length : 0;
            break;
          }
          default:
            console.warn(`Cleaning not supported for status: ${status}`);
            continue;
        }

        totalCleaned += cleaned;
        console.log(`Cleaned ${cleaned} ${status} jobs from queue ${jobType}`);
      } catch (error) {
        console.error(`Error cleaning jobs for queue ${jobType}:`, error);
      }
    }

    return totalCleaned;
  }

  async getQueueStats(jobType: string) {
    const queue = this.getQueue(jobType);
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  async closeAllQueues(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(closePromises);
    this.queues.clear();
  }

  /**
   * Get queue instance for external use (e.g., scheduler)
   */
  getQueueInstance(jobType: string): Bull.Queue {
    return this.getQueue(jobType);
  }
}
