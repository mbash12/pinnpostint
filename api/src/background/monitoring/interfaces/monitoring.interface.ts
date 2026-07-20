// Job Execution Metrics Interface
export interface JobExecutionMetrics {
  jobType: string;
  totalExecuted: number;
  totalSuccessful: number;
  totalFailed: number;
  averageExecutionTime: number;
  lastExecutionTime?: Date;
  lastFailureTime?: Date;
  lastFailureReason?: string;
}

// Worker Health Status Interface
export interface WorkerHealthStatus {
  workerId: string;
  status: 'healthy' | 'unhealthy' | 'stopped';
  uptime: number;
  lastHeartbeat: Date;
  processedJobs: number;
  failedJobs: number;
  activeJobs: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: number;
}

// Queue Statistics Interface
export interface QueueStatistics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  processingRate: number; // jobs per minute
  failureRate: number; // percentage
}

// System Health Overview Interface
export interface SystemHealthOverview {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  workers: WorkerHealthStatus[];
  queues: QueueStatistics[];
  metrics: JobExecutionMetrics[];
  redis: {
    connected: boolean;
    memory: string;
    connectedClients: number;
    /**
     * `master` on the primary we should be writing to, `slave` if the
     * client has been routed to a replica. Optional because legacy
     * callers might not populate it.
     */
    role?: 'master' | 'slave' | string;
    /** Number of replicas currently attached to the master. */
    connectedSlaves?: number;
  };
}

// Health Check Result Interface
export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'unhealthy';
  message?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

// Monitoring Configuration Interface
export interface MonitoringConfig {
  healthCheckInterval: number; // milliseconds
  metricsRetentionPeriod: number; // milliseconds
  alertThresholds: {
    failureRate: number; // percentage
    queueBacklog: number; // number of jobs
    workerResponseTime: number; // milliseconds
  };
}