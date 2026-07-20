import Bull from 'bull';
import { EventEmitter } from 'events';
import { 
  Worker as IWorker, 
  JobHandler, 
  Job,
  JobStatus,
  JobPriority,
  WorkerStats,
  JobError,
  JobTimeoutError,
  JobRetryExhaustedError
} from '../interfaces/job.interface';
import { getRedisUrl } from '../config/redis.config';
import { getJobConfig } from '../config/job.config';
import { getBullRedisOptions } from '../utils/redis-connection';

export class BullWorker extends EventEmitter implements IWorker {
  private queues: Map<string, Bull.Queue> = new Map();
  private handlers: Map<string, (job: Job<any>) => Promise<void>> = new Map();
  private processedJobTypes: Set<string> = new Set(); // Track which job types have process handlers set up
  private eventListenersSetup: Set<string> = new Set(); // Track which queues have event listeners set up
  private redisUrl: string;
  private running: boolean = false;
  private stats: WorkerStats = {
    processed: 0,
    failed: 0,
    active: 0,
    waiting: 0,
  };
  private queueProvider?: (jobType: string) => Bull.Queue | undefined;

  constructor() {
    super();
    this.redisUrl = getRedisUrl();
  }

  /**
   * Set a queue provider function that returns existing queues
   * This allows the worker to use queues created by other components (e.g., scheduler)
   */
  setQueueProvider(provider: (jobType: string) => Bull.Queue | undefined): void {
    this.queueProvider = provider;
  }

  async start(): Promise<void> {
    if (this.running) {
      console.log('Worker is already running');
      return;
    }

    console.log('Starting worker...');
    this.running = true;

    // Start processing for all registered job types
    for (const [jobType, handler] of this.handlers.entries()) {
      await this.startProcessingJobType(jobType, handler);
    }

    console.log('Worker started successfully');
  }

  getQueue(jobType: string): Bull.Queue | undefined {
    return this.queues.get(jobType);
  }

  async stop(): Promise<void> {
    if (!this.running) {
      console.log('Worker is not running');
      return;
    }

    console.log('Stopping worker...');
    this.running = false;

    // Close all queues
    const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(closePromises);
    this.queues.clear();

    console.log('Worker stopped successfully');
  }

  process<T = unknown>(jobType: string, handler: JobHandler<T>): void {
    this.handlers.set(jobType, async (job: Job<any>) => handler(job as Job<T>));
    
    if (this.running) {
      // If worker is already running, start processing this job type immediately
      this.startProcessingJobType(jobType, handler).catch(error => {
        console.error(`Failed to start processing job type ${jobType}:`, error);
      });
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getStats(): WorkerStats {
    return { ...this.stats };
  }

  private async startProcessingJobType(jobType: string, handler: (job: Job<any>) => Promise<void>): Promise<void> {
    const config = getJobConfig();
    const jobConfig = config.jobs[jobType] || {
      concurrency: 1,
      attempts: 3,
      backoff: 'exponential',
    };

    // Check if we've already set up processing for this job type
    if (this.processedJobTypes.has(jobType)) {
      console.log(`Job type ${jobType} already has a process handler registered, skipping`);
      return;
    }

    // Check if we already have this queue
    if (this.queues.has(jobType)) {
      const queue = this.queues.get(jobType)!;
      // Set up queue event listeners
      this.setupQueueEventListeners(queue, jobType);
      // Start processing jobs
      queue.process(jobType, jobConfig.concurrency, async (bullJob: Bull.Job) => {
        return this.processJob(bullJob, jobType, handler);
      });
      this.processedJobTypes.add(jobType);
      console.log(`Started processing job type: ${jobType} with concurrency: ${jobConfig.concurrency} (existing queue)`);
      return;
    }

    // Check if a queue already exists via the queue provider (e.g., created by scheduler/JobQueueManager)
    let queue = this.queueProvider ? this.queueProvider(jobType) : undefined;

    // If no existing queue, create a new one with shared Redis connection options
    if (!queue) {
      queue = new Bull(jobType, {
        createClient: getBullRedisOptions().createClient,
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
    }

    this.queues.set(jobType, queue);

    // Set up queue event listeners
    this.setupQueueEventListeners(queue, jobType);

    // Start processing jobs
    queue.process(jobType, jobConfig.concurrency, async (bullJob: Bull.Job) => {
      return this.processJob(bullJob, jobType, handler);
    });

    this.processedJobTypes.add(jobType);
    console.log(`Started processing job type: ${jobType} with concurrency: ${jobConfig.concurrency}`);
  }

  private setupQueueEventListeners(queue: Bull.Queue, jobType: string): void {
    // Only set up event listeners once per queue
    if (this.eventListenersSetup.has(jobType)) {
      return;
    }

    queue.on('error', (error) => {
      console.error(`Queue ${jobType} error:`, error);
      this.emit('error', error);
    });

    queue.on('waiting', (jobId) => {
      this.stats.waiting++;
      console.log(`Job ${jobId} is waiting in queue ${jobType}`);
    });

    queue.on('active', (job) => {
      this.stats.active++;
      this.stats.waiting = Math.max(0, this.stats.waiting - 1);
      console.log(`Job ${job.id} started processing in queue ${jobType}`);

      const jobData = this.mapBullJobToJob(job, jobType);
      this.emit('job:started', jobData);
    });

    queue.on('completed', (job) => {
      this.stats.processed++;
      this.stats.active = Math.max(0, this.stats.active - 1);
      console.log(`Job ${job.id} completed in queue ${jobType}`);

      const jobData = this.mapBullJobToJob(job, jobType);
      jobData.status = JobStatus.COMPLETED;
      jobData.completedAt = new Date();
      this.emit('job:completed', jobData);
    });

    queue.on('failed', (job, err) => {
      this.stats.failed++;
      this.stats.active = Math.max(0, this.stats.active - 1);
      console.error(`Job ${job.id} failed in queue ${jobType}:`, err);

      const jobData = this.mapBullJobToJob(job, jobType);
      jobData.status = JobStatus.FAILED;
      jobData.failedAt = new Date();
      jobData.error = err.message;

      if (job.attemptsMade >= (job.opts.attempts || 3)) {
        this.emit('job:dead', jobData);
      } else {
        this.emit('job:retrying', jobData, job.attemptsMade + 1);
      }

      this.emit('job:failed', jobData, err);
    });

    queue.on('stalled', (job) => {
      console.warn(`Job ${job.id} stalled in queue ${jobType}`);
    });

    this.eventListenersSetup.add(jobType);
  }

  private async processJob(bullJob: Bull.Job, jobType: string, handler: (job: Job<any>) => Promise<void>): Promise<void> {
    const job = this.mapBullJobToJob<any>(bullJob, jobType);
    job.status = JobStatus.PROCESSING;
    job.processedAt = new Date();

    try {
      // Set timeout if specified
      if (job.timeout) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new JobTimeoutError(job.id, jobType, job.attempts + 1, job.timeout!));
          }, job.timeout);
        });

        await Promise.race([
          handler(job),
          timeoutPromise
        ]);
      } else {
        await handler(job);
      }

      console.log(`Job ${job.id} of type ${jobType} processed successfully`);
    } catch (error) {
      console.error(`Job ${job.id} of type ${jobType} failed:`, error);
      
      // Determine if we should retry or mark as dead
      const maxAttempts = job.maxAttempts;
      const currentAttempt = bullJob.attemptsMade + 1;
      
      if (currentAttempt >= maxAttempts) {
        const retryExhaustedError = new JobRetryExhaustedError(
          job.id, 
          jobType, 
          maxAttempts, 
          error instanceof Error ? error : undefined
        );
        throw retryExhaustedError;
      }
      
      // Create appropriate error type
      let jobError: JobError;
      if (error instanceof JobTimeoutError) {
        jobError = error;
      } else if (error instanceof JobError) {
        jobError = error;
      } else {
        jobError = new JobError(
          error instanceof Error ? error.message : 'Unknown error',
          job.id,
          jobType,
          currentAttempt,
          error instanceof Error ? error : undefined
        );
      }
      
      throw jobError;
    }
  }

  private mapBullJobToJob<T = unknown>(bullJob: Bull.Job, jobType: string): Job<T> {
    return {
      id: bullJob.id as string,
      type: jobType,
      data: bullJob.data as T,
      status: JobStatus.PENDING, // Will be updated based on context
      attempts: bullJob.attemptsMade,
      maxAttempts: bullJob.opts.attempts || 3,
      priority: (bullJob.opts.priority as JobPriority) || JobPriority.NORMAL,
      createdAt: new Date(bullJob.timestamp),
      processedAt: bullJob.processedOn ? new Date(bullJob.processedOn) : undefined,
      completedAt: bullJob.finishedOn ? new Date(bullJob.finishedOn) : undefined,
      failedAt: undefined, // Will be set when job fails
      error: bullJob.failedReason,
      delay: bullJob.opts.delay,
      timeout: bullJob.opts.timeout,
    };
  }

  // Utility method to get queue statistics
  async getQueueStats(jobType: string) {
    const queue = this.queues.get(jobType);
    if (!queue) {
      throw new Error(`Queue ${jobType} not found`);
    }

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

  // Utility method to pause/resume queue processing
  async pauseQueue(jobType: string): Promise<void> {
    const queue = this.queues.get(jobType);
    if (queue) {
      await queue.pause();
      console.log(`Queue ${jobType} paused`);
    }
  }

  async resumeQueue(jobType: string): Promise<void> {
    const queue = this.queues.get(jobType);
    if (queue) {
      await queue.resume();
      console.log(`Queue ${jobType} resumed`);
    }
  }
}
