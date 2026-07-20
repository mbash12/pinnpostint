// Job Status Enum
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  DEAD = 'dead'
}

// Job Priority Enum
export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 15
}

// Job Error Types
export class JobError extends Error {
  constructor(
    message: string,
    public readonly jobId: string,
    public readonly jobType: string,
    public readonly attempt: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'JobError';
  }
}

export class JobTimeoutError extends JobError {
  constructor(jobId: string, jobType: string, attempt: number, timeout: number) {
    super(`Job timed out after ${timeout}ms`, jobId, jobType, attempt);
    this.name = 'JobTimeoutError';
  }
}

export class JobRetryExhaustedError extends JobError {
  constructor(jobId: string, jobType: string, maxAttempts: number, lastError?: Error) {
    super(`Job failed after ${maxAttempts} attempts`, jobId, jobType, maxAttempts, lastError);
    this.name = 'JobRetryExhaustedError';
  }
}

// Core Job Interface
export interface Job<T = unknown> {
  id: string;
  type: string;
  data: T;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  priority: JobPriority;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  delay?: number;
  timeout?: number;
}

// Job Options Interface
export interface JobOptions {
  delay?: number;
  attempts?: number;
  priority?: JobPriority;
  cron?: string;
  backoff?: 'exponential' | 'fixed';
  timeout?: number;
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

// Job Handler Interface
export interface JobHandler<T = unknown> {
  (job: Job<T>): Promise<void>;
}

// Job Queue Manager Interface
export interface JobQueueManager {
  addJob<T = unknown>(jobType: string, data: T, options?: JobOptions): Promise<Job<T>>;
  getJobStatus(jobId: string): Promise<JobStatus>;
  getJob<T = unknown>(jobId: string): Promise<Job<T> | null>;
  retryJob(jobId: string): Promise<void>;
  removeJob(jobId: string): Promise<void>;
  getJobCounts(): Promise<JobCounts>;
  getFailedJobs(limit?: number): Promise<Job[]>;
  getCompletedJobs(limit?: number): Promise<Job[]>;
  cleanJobs(status: JobStatus, olderThan: number): Promise<number>;
}

// Worker Interface
export interface Worker {
  start(): Promise<void>;
  stop(): Promise<void>;
  process<T = unknown>(jobType: string, handler: JobHandler<T>): void;
  isRunning(): boolean;
  getStats(): WorkerStats;
}

// Supporting Types
export interface JobCounts {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
  dead: number;
}

export interface WorkerStats {
  processed: number;
  failed: number;
  active: number;
  waiting: number;
}

// Job Event Types
export interface JobEvents {
  'job:created': <T = unknown>(job: Job<T>) => void;
  'job:started': <T = unknown>(job: Job<T>) => void;
  'job:completed': <T = unknown>(job: Job<T>) => void;
  'job:failed': <T = unknown>(job: Job<T>, error: Error) => void;
  'job:retrying': <T = unknown>(job: Job<T>, attempt: number) => void;
  'job:dead': <T = unknown>(job: Job<T>) => void;
}