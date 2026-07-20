import { EventEmitter } from 'events';
import IORedis from 'ioredis';
import { 
  SystemHealthOverview, 
  HealthCheckResult, 
  WorkerHealthStatus,
  QueueStatistics,
  MonitoringConfig 
} from './interfaces/monitoring.interface';
import { MetricsTracker } from './metrics-tracker';
import { BullJobQueueManager } from '../queue-manager/job-queue-manager';
import { BullWorker } from '../workers/worker';
import { getBullRedisOptions } from '../utils/redis-connection';

export class HealthMonitor extends EventEmitter {
  private metricsTracker: MetricsTracker;
  private queueManager: BullJobQueueManager;
  private workers: Map<string, BullWorker> = new Map();
  private redis: IORedis;
  private config: MonitoringConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime: Date;

  constructor(
    metricsTracker: MetricsTracker,
    queueManager: BullJobQueueManager,
    config: MonitoringConfig
  ) {
    super();
    this.metricsTracker = metricsTracker;
    this.queueManager = queueManager;
    this.config = config;
    // Reuse the shared Bull Redis client instead of creating a new connection
    this.redis = getBullRedisOptions().createClient('client') as IORedis;
    this.startTime = new Date();
    
    this.setupEventListeners();
  }

  // Start health monitoring
  start(): void {
    if (this.healthCheckInterval) {
      console.log('Health monitor is already running');
      return;
    }

    console.log('Starting health monitor...');
    
    // Start periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Perform initial health check
    this.performHealthCheck();
    
    console.log('Health monitor started');
    this.emit('monitor:started');
  }

  // Stop health monitoring
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    console.log('Health monitor stopped');
    this.emit('monitor:stopped');
  }

  // Register a worker for monitoring
  registerWorker(workerId: string, worker: BullWorker): void {
    this.workers.set(workerId, worker);
    
    // Set up worker event listeners
    worker.on('job:started', () => {
      this.metricsTracker.updateWorkerHealth(workerId, {
        activeJobs: this.getWorkerActiveJobs(workerId) + 1,
      });
    });

    worker.on('job:completed', () => {
      this.metricsTracker.updateWorkerHealth(workerId, {
        processedJobs: this.getWorkerProcessedJobs(workerId) + 1,
        activeJobs: Math.max(0, this.getWorkerActiveJobs(workerId) - 1),
      });
    });

    worker.on('job:failed', () => {
      this.metricsTracker.updateWorkerHealth(workerId, {
        failedJobs: this.getWorkerFailedJobs(workerId) + 1,
        activeJobs: Math.max(0, this.getWorkerActiveJobs(workerId) - 1),
      });
    });

    console.log(`Worker ${workerId} registered for monitoring`);
    this.emit('worker:registered', workerId);
  }

  // Unregister a worker from monitoring
  unregisterWorker(workerId: string): void {
    this.workers.delete(workerId);
    console.log(`Worker ${workerId} unregistered from monitoring`);
    this.emit('worker:unregistered', workerId);
  }

  // Perform comprehensive health check
  async performHealthCheck(): Promise<SystemHealthOverview> {
    const timestamp = new Date();
    const healthChecks: HealthCheckResult[] = [];

    try {
      // Check Redis connectivity
      const redisHealth = await this.checkRedisHealth();
      healthChecks.push(redisHealth);

      // Check worker health
      const workerHealthStatuses = await this.checkWorkersHealth();
      
      // Check queue statistics
      const queueStatistics = await this.updateQueueStatistics();

      // Get job execution metrics
      const jobMetrics = this.metricsTracker.getJobMetrics();

      // Determine overall system status
      const systemStatus = this.determineSystemStatus(healthChecks, workerHealthStatuses, queueStatistics);

      const healthOverview: SystemHealthOverview = {
        status: systemStatus,
        timestamp,
        workers: workerHealthStatuses,
        queues: queueStatistics,
        metrics: jobMetrics,
        redis: {
          connected: redisHealth.status === 'healthy',
          memory: (redisHealth.details as { memory?: string })?.memory || 'unknown',
          connectedClients: (redisHealth.details as { connectedClients?: number })?.connectedClients || 0,
          role: (redisHealth.details as { role?: string })?.role,
          connectedSlaves: (redisHealth.details as { connectedSlaves?: number })?.connectedSlaves,
        },
      };

      this.emit('health:checked', healthOverview);
      return healthOverview;
    } catch (error) {
      console.error('Health check failed:', error);
      
      const errorOverview: SystemHealthOverview = {
        status: 'unhealthy',
        timestamp,
        workers: [],
        queues: [],
        metrics: [],
        redis: {
          connected: false,
          memory: 'unknown',
          connectedClients: 0,
        },
      };

      this.emit('health:error', error);
      return errorOverview;
    }
  }

  // Check Redis health
  private async checkRedisHealth(): Promise<HealthCheckResult> {
    try {
      const [memory, clients, replication] = await Promise.all([
        this.redis.info('memory'),
        this.redis.info('clients'),
        this.redis.info('replication'),
      ]);

      const memoryMatch = memory.match(/used_memory_human:(.+)/);
      const clientsMatch = clients.match(/connected_clients:(\d+)/);
      // `role` is `master` on the primary and `slave` on a replica.
      // We surface it so a misrouted client (writing against a replica)
      // becomes visible in the health endpoint instead of bubbling up
      // as a confusing READONLY reply.
      const roleMatch = replication.match(/^role:(\S+)/m);
      const connectedSlavesMatch = replication.match(/^connected_slaves:(\d+)/m);

      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'unknown';
      const connectedClients = clientsMatch ? parseInt(clientsMatch[1]) : 0;
      const role = roleMatch ? roleMatch[1] : 'unknown';
      const connectedSlaves = connectedSlavesMatch
        ? parseInt(connectedSlavesMatch[1])
        : 0;

      return {
        component: 'redis',
        status: 'healthy',
        message: 'Redis is connected and responsive',
        details: {
          memory: memoryUsage,
          connectedClients,
          role,
          connectedSlaves,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        component: 'redis',
        status: 'unhealthy',
        message: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
    }
  }

  // Check all workers health
  private async checkWorkersHealth(): Promise<WorkerHealthStatus[]> {
    const workerHealthStatuses: WorkerHealthStatus[] = [];

    for (const [workerId, worker] of this.workers.entries()) {
      try {
        const uptime = Date.now() - this.startTime.getTime();
        const memoryUsage = process.memoryUsage();
        const isRunning = worker.isRunning();
        const stats = worker.getStats();

        const healthStatus: WorkerHealthStatus = {
          workerId,
          status: isRunning ? 'healthy' : 'stopped',
          uptime,
          lastHeartbeat: new Date(),
          processedJobs: stats.processed,
          failedJobs: stats.failed,
          activeJobs: stats.active,
          memoryUsage,
        };

        // Update metrics tracker
        this.metricsTracker.updateWorkerHealth(workerId, healthStatus);
        workerHealthStatuses.push(healthStatus);
      } catch (error) {
        console.error(`Error checking health for worker ${workerId}:`, error);
        
        const unhealthyStatus: WorkerHealthStatus = {
          workerId,
          status: 'unhealthy',
          uptime: 0,
          lastHeartbeat: new Date(),
          processedJobs: 0,
          failedJobs: 0,
          activeJobs: 0,
          memoryUsage: process.memoryUsage(),
        };

        workerHealthStatuses.push(unhealthyStatus);
      }
    }

    return workerHealthStatuses;
  }

  // Update queue statistics for all queues
  private async updateQueueStatistics(): Promise<QueueStatistics[]> {
    const queueStatistics: QueueStatistics[] = [];
    const jobTypes = [
      'ad-expiration-reminder',
      'ad-after-expired-reminder',
      'ad-expiration-cleanup',
      'notification-delivery',
      'data-cleanup'
    ];

    for (const jobType of jobTypes) {
      try {
        const stats = await this.queueManager.getQueueStats(jobType);
        
        const queueStats: QueueStatistics = {
          queueName: jobType,
          waiting: stats.waiting,
          active: stats.active,
          completed: stats.completed,
          failed: stats.failed,
          delayed: 0, // Bull doesn't provide delayed count in basic stats
          paused: false, // Would need to check queue instance for this
          processingRate: 0, // Would need historical data to calculate
          failureRate: stats.completed + stats.failed > 0 ? (stats.failed / (stats.completed + stats.failed)) * 100 : 0,
        };

        // Update metrics tracker
        this.metricsTracker.updateQueueStatistics(jobType, queueStats);
        queueStatistics.push(queueStats);
      } catch (error) {
        console.error(`Error getting stats for queue ${jobType}:`, error);
        
        // Add empty stats for failed queue
        const emptyStats: QueueStatistics = {
          queueName: jobType,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
          processingRate: 0,
          failureRate: 0,
        };
        
        queueStatistics.push(emptyStats);
      }
    }

    return queueStatistics;
  }

  // Determine overall system status
  private determineSystemStatus(
    healthChecks: HealthCheckResult[],
    workers: WorkerHealthStatus[],
    queues: QueueStatistics[]
  ): 'healthy' | 'degraded' | 'unhealthy' {
    // Check if Redis is unhealthy
    const redisCheck = healthChecks.find(check => check.component === 'redis');
    if (redisCheck && redisCheck.status === 'unhealthy') {
      return 'unhealthy';
    }

    // Check for unhealthy workers
    const unhealthyWorkers = workers.filter(w => w.status === 'unhealthy');
    if (unhealthyWorkers.length > 0) {
      return workers.length === unhealthyWorkers.length ? 'unhealthy' : 'degraded';
    }

    // Check for high failure rates or backlogs
    const problematicQueues = queues.filter(q => 
      q.failureRate > this.config.alertThresholds.failureRate ||
      (q.waiting + q.delayed) > this.config.alertThresholds.queueBacklog
    );

    if (problematicQueues.length > 0) {
      return problematicQueues.length === queues.length ? 'unhealthy' : 'degraded';
    }

    return 'healthy';
  }

  // Helper methods to get worker stats
  private getWorkerActiveJobs(workerId: string): number {
    const health = this.metricsTracker.getWorkerHealth(workerId);
    return health?.activeJobs || 0;
  }

  private getWorkerProcessedJobs(workerId: string): number {
    const health = this.metricsTracker.getWorkerHealth(workerId);
    return health?.processedJobs || 0;
  }

  private getWorkerFailedJobs(workerId: string): number {
    const health = this.metricsTracker.getWorkerHealth(workerId);
    return health?.failedJobs || 0;
  }

  // Set up event listeners
  private setupEventListeners(): void {
    // Listen to metrics tracker events
    this.metricsTracker.on('metrics:updated', (jobType, metrics) => {
      this.emit('metrics:updated', jobType, metrics);
    });

    this.metricsTracker.on('worker:updated', (workerId, health) => {
      this.emit('worker:health:updated', workerId, health);
    });

    this.metricsTracker.on('queue:updated', (queueName, stats) => {
      this.emit('queue:stats:updated', queueName, stats);
    });
  }

  // Get current system health overview
  async getSystemHealth(): Promise<SystemHealthOverview> {
    return this.performHealthCheck();
  }

  // Get health summary
  getHealthSummary() {
    return this.metricsTracker.getHealthSummary();
  }

  // Check if monitoring is running
  isRunning(): boolean {
    return this.healthCheckInterval !== undefined;
  }
}
