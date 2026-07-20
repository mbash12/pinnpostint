import { BullWorker } from '../workers/worker';
import { BullJobQueueManager } from '../queue-manager/job-queue-manager';
import { HealthMonitor } from './health-monitor';
import { MetricsTracker } from './metrics-tracker';
import { MonitoringConfig } from './interfaces/monitoring.interface';
import { Job } from '../interfaces/job.interface';

export class MonitoringIntegration {
  private metricsTracker: MetricsTracker;
  private healthMonitor: HealthMonitor;
  private queueManager: BullJobQueueManager;
  private workers: Map<string, BullWorker> = new Map();

  constructor(config: MonitoringConfig, queueManager?: BullJobQueueManager) {
    this.metricsTracker = new MetricsTracker(config);
    this.queueManager = queueManager || new BullJobQueueManager();
    this.healthMonitor = new HealthMonitor(this.metricsTracker, this.queueManager, config);
  }

  // Initialize monitoring for the background system
  initialize(): void {
    console.log('Initializing background job monitoring...');
    
    // Start health monitoring
    this.healthMonitor.start();
    
    console.log('Background job monitoring initialized successfully');
  }

  // Register a worker with monitoring
  registerWorker(workerId: string, worker: BullWorker): void {
    this.workers.set(workerId, worker);
    this.healthMonitor.registerWorker(workerId, worker);
    
    // Set up job execution tracking
    this.setupJobTracking(worker);
    
    console.log(`Worker ${workerId} registered with monitoring`);
  }

  // Unregister a worker from monitoring
  unregisterWorker(workerId: string): void {
    this.workers.delete(workerId);
    this.healthMonitor.unregisterWorker(workerId);
    
    console.log(`Worker ${workerId} unregistered from monitoring`);
  }

  // Set up job execution tracking for a worker
  private setupJobTracking(worker: BullWorker): void {
    const jobStartTimes = new Map<string, number>();

    worker.on('job:started', (job: Job) => {
      jobStartTimes.set(job.id, Date.now());
    });

    worker.on('job:completed', (job: Job) => {
      const startTime = jobStartTimes.get(job.id);
      if (startTime) {
        const executionTime = Date.now() - startTime;
        this.metricsTracker.trackJobExecution(job, executionTime, true);
        jobStartTimes.delete(job.id);
      }
    });

    worker.on('job:failed', (job: Job, error: Error) => {
      const startTime = jobStartTimes.get(job.id);
      if (startTime) {
        const executionTime = Date.now() - startTime;
        this.metricsTracker.trackJobExecution(job, executionTime, false, error);
        jobStartTimes.delete(job.id);
      }
    });

    worker.on('job:dead', (job: Job) => {
      // Clean up tracking for dead jobs
      jobStartTimes.delete(job.id);
    });
  }

  // Get monitoring instances for external use
  getMetricsTracker(): MetricsTracker {
    return this.metricsTracker;
  }

  getHealthMonitor(): HealthMonitor {
    return this.healthMonitor;
  }

  getQueueManager(): BullJobQueueManager {
    return this.queueManager;
  }

  // Shutdown monitoring
  shutdown(): void {
    console.log('Shutting down background job monitoring...');
    
    this.healthMonitor.stop();
    
    // Unregister all workers
    for (const workerId of this.workers.keys()) {
      this.unregisterWorker(workerId);
    }
    
    console.log('Background job monitoring shut down successfully');
  }
}