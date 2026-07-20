import { EventEmitter } from 'events';
import { 
  JobExecutionMetrics, 
  WorkerHealthStatus, 
  QueueStatistics,
  MonitoringConfig 
} from './interfaces/monitoring.interface';
import { Job } from '../interfaces/job.interface';

export class MetricsTracker extends EventEmitter {
  private jobMetrics: Map<string, JobExecutionMetrics> = new Map();
  private workerHealth: Map<string, WorkerHealthStatus> = new Map();
  private queueStats: Map<string, QueueStatistics> = new Map();
  private executionTimes: Map<string, number[]> = new Map(); // Store recent execution times
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.startCleanupInterval();
  }

  // Track job execution metrics
  trackJobExecution(job: Job, executionTime: number, success: boolean, error?: Error): void {
    const jobType = job.type;
    let metrics = this.jobMetrics.get(jobType);

    if (!metrics) {
      metrics = {
        jobType,
        totalExecuted: 0,
        totalSuccessful: 0,
        totalFailed: 0,
        averageExecutionTime: 0,
        lastExecutionTime: new Date(),
      };
      this.jobMetrics.set(jobType, metrics);
    }

    // Update metrics
    metrics.totalExecuted++;
    metrics.lastExecutionTime = new Date();

    if (success) {
      metrics.totalSuccessful++;
    } else {
      metrics.totalFailed++;
      metrics.lastFailureTime = new Date();
      metrics.lastFailureReason = error?.message || 'Unknown error';
    }

    // Update execution time tracking
    let executionTimes = this.executionTimes.get(jobType) || [];
    executionTimes.push(executionTime);
    
    // Keep only last 100 execution times for average calculation
    if (executionTimes.length > 100) {
      executionTimes = executionTimes.slice(-100);
    }
    
    this.executionTimes.set(jobType, executionTimes);
    
    // Calculate average execution time
    metrics.averageExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;

    this.emit('metrics:updated', jobType, metrics);
  }

  // Update worker health status
  updateWorkerHealth(workerId: string, status: Partial<WorkerHealthStatus>): void {
    let health = this.workerHealth.get(workerId);

    if (!health) {
      health = {
        workerId,
        status: 'healthy',
        uptime: 0,
        lastHeartbeat: new Date(),
        processedJobs: 0,
        failedJobs: 0,
        activeJobs: 0,
        memoryUsage: process.memoryUsage(),
      };
      this.workerHealth.set(workerId, health);
    }

    // Update provided fields
    Object.assign(health, status);
    health.lastHeartbeat = new Date();

    this.emit('worker:updated', workerId, health);
  }

  // Update queue statistics
  updateQueueStatistics(queueName: string, stats: Partial<QueueStatistics>): void {
    let queueStats = this.queueStats.get(queueName);

    if (!queueStats) {
      queueStats = {
        queueName,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false,
        processingRate: 0,
        failureRate: 0,
      };
      this.queueStats.set(queueName, queueStats);
    }

    // Update provided fields
    Object.assign(queueStats, stats);

    // Calculate failure rate
    const total = queueStats.completed + queueStats.failed;
    queueStats.failureRate = total > 0 ? (queueStats.failed / total) * 100 : 0;

    this.emit('queue:updated', queueName, queueStats);
  }

  // Get all job metrics
  getJobMetrics(): JobExecutionMetrics[] {
    return Array.from(this.jobMetrics.values());
  }

  // Get specific job metrics
  getJobMetricsByType(jobType: string): JobExecutionMetrics | undefined {
    return this.jobMetrics.get(jobType);
  }

  // Get all worker health statuses
  getWorkerHealthStatuses(): WorkerHealthStatus[] {
    return Array.from(this.workerHealth.values());
  }

  // Get specific worker health
  getWorkerHealth(workerId: string): WorkerHealthStatus | undefined {
    return this.workerHealth.get(workerId);
  }

  // Get all queue statistics
  getQueueStatistics(): QueueStatistics[] {
    return Array.from(this.queueStats.values());
  }

  // Get specific queue statistics
  getQueueStatisticsByName(queueName: string): QueueStatistics | undefined {
    return this.queueStats.get(queueName);
  }

  // Check if system is healthy based on thresholds
  isSystemHealthy(): boolean {
    // Check worker health
    const workers = this.getWorkerHealthStatuses();
    const unhealthyWorkers = workers.filter(w => w.status === 'unhealthy');
    if (unhealthyWorkers.length > 0) {
      return false;
    }

    // Check queue backlogs
    const queues = this.getQueueStatistics();
    const backloggedQueues = queues.filter(q => 
      (q.waiting + q.delayed) > this.config.alertThresholds.queueBacklog
    );
    if (backloggedQueues.length > 0) {
      return false;
    }

    // Check failure rates
    const highFailureQueues = queues.filter(q => 
      q.failureRate > this.config.alertThresholds.failureRate
    );
    if (highFailureQueues.length > 0) {
      return false;
    }

    return true;
  }

  // Get system health summary
  getHealthSummary(): {
    healthy: boolean;
    issues: string[];
    totalWorkers: number;
    totalQueues: number;
    totalJobsProcessed: number;
  } {
    const workers = this.getWorkerHealthStatuses();
    const queues = this.getQueueStatistics();
    const metrics = this.getJobMetrics();
    const issues: string[] = [];

    // Check for issues
    const unhealthyWorkers = workers.filter(w => w.status === 'unhealthy');
    if (unhealthyWorkers.length > 0) {
      issues.push(`${unhealthyWorkers.length} unhealthy workers`);
    }

    const backloggedQueues = queues.filter(q => 
      (q.waiting + q.delayed) > this.config.alertThresholds.queueBacklog
    );
    if (backloggedQueues.length > 0) {
      issues.push(`${backloggedQueues.length} queues with high backlog`);
    }

    const highFailureQueues = queues.filter(q => 
      q.failureRate > this.config.alertThresholds.failureRate
    );
    if (highFailureQueues.length > 0) {
      issues.push(`${highFailureQueues.length} queues with high failure rate`);
    }

    const totalJobsProcessed = metrics.reduce((sum, m) => sum + m.totalExecuted, 0);

    return {
      healthy: issues.length === 0,
      issues,
      totalWorkers: workers.length,
      totalQueues: queues.length,
      totalJobsProcessed,
    };
  }

  // Reset metrics for a specific job type
  resetJobMetrics(jobType: string): void {
    this.jobMetrics.delete(jobType);
    this.executionTimes.delete(jobType);
    this.emit('metrics:reset', jobType);
  }

  // Reset all metrics
  resetAllMetrics(): void {
    this.jobMetrics.clear();
    this.executionTimes.clear();
    this.emit('metrics:reset:all');
  }

  // Start cleanup interval to remove old data
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupOldData();
    }, this.config.metricsRetentionPeriod);
  }

  // Clean up old data based on retention period
  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - this.config.metricsRetentionPeriod);

    // Clean up worker health data for inactive workers
    for (const [workerId, health] of this.workerHealth.entries()) {
      if (health.lastHeartbeat < cutoffTime) {
        this.workerHealth.delete(workerId);
        this.emit('worker:removed', workerId);
      }
    }

    this.emit('cleanup:completed');
  }

  // Get monitoring configuration
  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  // Update monitoring configuration
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config:updated', this.config);
  }
}