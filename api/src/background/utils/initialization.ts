import { BullJobQueueManager } from '../queue-manager/job-queue-manager';
import { CronScheduler } from '../scheduler/cron-scheduler';
import { BullWorker } from '../workers/worker';
import { registerJobHandlers } from '../workers/job-handlers-setup';
import { createRedisConnection, closeRedisConnection } from './redis-connection';
import { MonitoringIntegration } from '../monitoring/monitoring-integration';
import { MonitoringConfig } from '../monitoring/interfaces/monitoring.interface';
import { config } from '../../config/environment';

let jobQueueManager: BullJobQueueManager | null = null;
let cronScheduler: CronScheduler | null = null;
let worker: BullWorker | null = null;
let monitoringIntegration: MonitoringIntegration | null = null;
let isInitializing = false;

export const initializeJobQueue = async (): Promise<BullJobQueueManager> => {
  if (jobQueueManager) {
    return jobQueueManager;
  }

  // Prevent multiple simultaneous initialization
  if (isInitializing) {
    console.log('Job queue initialization already in progress...');
    await new Promise<void>((resolve) => {
      const checkInit = setInterval(() => {
        if (!isInitializing && jobQueueManager) {
          clearInterval(checkInit);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInit);
        resolve();
      }, 15000);
    });
    
    if (jobQueueManager) {
      return jobQueueManager;
    }
  }

  isInitializing = true;

  try {
    // Initialize Redis connection with retry logic
    console.log('🔄 Connecting to Redis for job queue...');
    await createRedisConnection();
    console.log('✅ Redis connection established for job queue');

    // Initialize job queue manager first
    jobQueueManager = new BullJobQueueManager();

    // Pre-initialize all queues to ensure they exist before the worker starts
    jobQueueManager.initializeAllQueues();

    // Create worker and register handlers (but don't start yet)
    worker = await createWorker();

    // Set up bidirectional queue providers BEFORE starting worker
    // 1. JobQueueManager uses worker's queues
    jobQueueManager.setQueueProvider((jobType: string) => worker!.getQueue(jobType));

    // 2. Worker uses queues from JobQueueManager (including ones created by scheduler)
    worker!.setQueueProvider((jobType: string) => jobQueueManager!.getQueueInstance(jobType));

    // NOW start the worker (it will use shared queues)
    await worker!.start();
    console.log('✅ Worker started and ready to process jobs');

    console.log('✅ Job queue manager initialized');

    // Initialize monitoring if not already done
    await initializeMonitoring();

    return jobQueueManager;
  } catch (error) {
    console.error('❌ Failed to initialize job queue:', error);
    
    // Cleanup on failure
    jobQueueManager = null;
    worker = null;
    
    // Don't throw in production - allow server to start without jobs
    if (config.server.nodeEnv === 'production') {
      console.warn('⚠️  Starting server without background job system');
    }
    
    throw error;
  } finally {
    isInitializing = false;
  }
};

/**
 * Create the worker and register handlers (but don't start yet)
 */
const createWorker = async (): Promise<BullWorker> => {
  if (worker) {
    return worker;
  }

  try {
    // Create worker
    worker = new BullWorker();

    // Register all job handlers (email-otp, sms-otp, etc.)
    registerJobHandlers(worker);

    console.log('✅ Worker created and handlers registered');

    return worker;
  } catch (error) {
    console.error('❌ Failed to create worker:', error);
    throw error;
  }
};

export const initializeScheduler = async (): Promise<CronScheduler> => {
  if (cronScheduler) {
    return cronScheduler;
  }

  try {
    // Ensure job queue manager is initialized first
    const queueManager = await initializeJobQueue();

    // Initialize cron scheduler
    cronScheduler = new CronScheduler(queueManager);
    await cronScheduler.initializeSchedules();
    console.log('✅ Cron scheduler initialized');

    return cronScheduler;
  } catch (error) {
    console.error('❌ Failed to initialize cron scheduler:', error);
    throw error;
  }
};

export const getJobQueueManager = (): BullJobQueueManager | null => {
  return jobQueueManager;
};

export const getCronScheduler = (): CronScheduler | null => {
  return cronScheduler;
};

export const getWorker = (): BullWorker | null => {
  return worker;
};

export const initializeMonitoring = async (): Promise<MonitoringIntegration> => {
  if (monitoringIntegration) {
    return monitoringIntegration;
  }

  try {
    // Default monitoring configuration
    const monitoringConfig: MonitoringConfig = {
      healthCheckInterval: 120000, // 120 seconds (was 30s - too aggressive)
      metricsRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      alertThresholds: {
        failureRate: 10, // 10%
        queueBacklog: 100, // 100 jobs
        workerResponseTime: 5000, // 5 seconds
      },
    };

    // Initialize monitoring integration, reusing existing queue manager to avoid duplicate Redis connections
    monitoringIntegration = new MonitoringIntegration(monitoringConfig, jobQueueManager || undefined);
    monitoringIntegration.initialize();
    console.log('✅ Monitoring integration initialized');

    return monitoringIntegration;
  } catch (error) {
    console.error('❌ Failed to initialize monitoring:', error);
    throw error;
  }
};

export const getMonitoringIntegration = (): MonitoringIntegration | null => {
  return monitoringIntegration;
};

export const shutdownJobQueue = async (): Promise<void> => {
  if (monitoringIntegration) {
    monitoringIntegration.shutdown();
    monitoringIntegration = null;
    console.log('✅ Monitoring integration shut down');
  }

  if (cronScheduler) {
    try {
      await cronScheduler.shutdown();
    } catch (error) {
      console.error('❌ Error shutting down cron scheduler:', error);
    }
    cronScheduler = null;
    console.log('✅ Cron scheduler shut down');
  }

  if (worker) {
    await worker.stop();
    worker = null;
    console.log('✅ Worker shut down');
  }

  if (jobQueueManager) {
    await jobQueueManager.closeAllQueues();
    jobQueueManager = null;
    console.log('✅ Job queue manager shut down');
  }

  // Close Redis connection
  await closeRedisConnection();
};
