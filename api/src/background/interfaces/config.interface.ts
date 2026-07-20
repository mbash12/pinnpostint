export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface JobConfig {
  concurrency: number;
  attempts: number;
  backoff: 'exponential' | 'fixed';
}

export interface ScheduleConfig {
  cron: string;
  jobType: string;
  data?: Record<string, unknown>;
}

export interface SchedulerConfig {
  redis: RedisConfig;
  jobs: {
    [jobType: string]: JobConfig;
  };
  schedules: {
    [name: string]: ScheduleConfig;
  };
}