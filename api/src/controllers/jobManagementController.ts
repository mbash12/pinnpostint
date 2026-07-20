import { Request, Response } from 'express';
import { BullJobQueueManager } from '../background/queue-manager/job-queue-manager';
import { BullWorker } from '../background/workers/worker';
import { HealthMonitor } from '../background/monitoring/health-monitor';
import { JobOptions, JobPriority, JobStatus } from '../background/interfaces/job.interface';
import { ResponseHelper } from '../utils/response-helpers';

export class JobManagementController {
  private queueManager: BullJobQueueManager;
  private workers: Map<string, BullWorker> = new Map();
  private healthMonitor: HealthMonitor;

  constructor(queueManager: BullJobQueueManager, healthMonitor: HealthMonitor) {
    this.queueManager = queueManager;
    this.healthMonitor = healthMonitor;
  }

  // Register a worker for management
  registerWorker(workerId: string, worker: BullWorker): void {
    this.workers.set(workerId, worker);
    this.healthMonitor.registerWorker(workerId, worker);
  }

  // Unregister a worker
  unregisterWorker(workerId: string): void {
    this.workers.delete(workerId);
    this.healthMonitor.unregisterWorker(workerId);
  }

  /**
   * @swagger
   * /api/v1/admin/jobs/trigger:
   *   post:
   *     summary: Manually trigger a job
   *     tags: [Admin - Job Management]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - jobType
   *               - data
   *             properties:
   *               jobType:
   *                 type: string
 *                 enum: [ad-expiration-reminder, ad-after-expired-reminder, ad-expiration-cleanup, notification-delivery, data-cleanup]
   *               data:
   *                 type: object
   *               options:
   *                 type: object
   *                 properties:
   *                   delay:
   *                     type: number
   *                   attempts:
   *                     type: number
   *                   priority:
   *                     type: string
   *                     enum: [LOW, NORMAL, HIGH, CRITICAL]
   *                   timeout:
   *                     type: number
   *     responses:
   *       200:
   *         description: Job triggered successfully
   *       400:
   *         description: Invalid job type or data
   */
  triggerJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobType, data, options = {} } = req.body;

      if (!jobType || !data) {
        ResponseHelper.validationError(res, 'Job type and data are required');
        return;
      }

      // Validate job type
      const validJobTypes = [
        'ad-expiration-reminder',
        'ad-after-expired-reminder',
        'ad-expiration-cleanup',
        'notification-delivery',
        'data-cleanup'
      ];

      if (!validJobTypes.includes(jobType)) {
        ResponseHelper.validationError(res, `Invalid job type. Must be one of: ${validJobTypes.join(', ')}`);
        return;
      }

      // Parse options
      const jobOptions: JobOptions = {
        delay: options.delay,
        attempts: options.attempts || 3,
        priority: options.priority ? JobPriority[options.priority as keyof typeof JobPriority] : JobPriority.NORMAL,
        timeout: options.timeout,
      };

      // Add job to queue
      const job = await this.queueManager.addJob(jobType, data, jobOptions);

      ResponseHelper.success(res, {
        jobId: job.id,
        jobType: job.type,
        status: job.status,
        createdAt: job.createdAt,
      }, 'Job triggered successfully');
    } catch (error) {
      console.error('Error triggering job:', error);
      ResponseHelper.internalError(res, 'Failed to trigger job');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/jobs/{jobId}:
   *   get:
   *     summary: Get job details
   *     tags: [Admin - Job Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: jobId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Job details
   *       404:
   *         description: Job not found
   */
  getJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const job = await this.queueManager.getJob(jobId);

      if (!job) {
        ResponseHelper.notFound(res, 'Job not found');
        return;
      }

      ResponseHelper.success(res, job, 'Job details retrieved successfully');
    } catch (error) {
      console.error('Error getting job:', error);
      ResponseHelper.internalError(res, 'Failed to get job details');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/jobs/{jobId}/status:
   *   get:
   *     summary: Get job status
   *     tags: [Admin - Job Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: jobId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Job status
   *       404:
   *         description: Job not found
   */
  getJobStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const status = await this.queueManager.getJobStatus(jobId);

      ResponseHelper.success(res, { jobId, status }, 'Job status retrieved successfully');
    } catch (error) {
      console.error('Error getting job status:', error);
      ResponseHelper.internalError(res, 'Failed to get job status');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/jobs/{jobId}/retry:
   *   post:
   *     summary: Retry a failed job
   *     tags: [Admin - Job Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: jobId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Job retried successfully
   *       404:
   *         description: Job not found
   *       400:
   *         description: Job cannot be retried
   */
  retryJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      await this.queueManager.retryJob(jobId);

      ResponseHelper.success(res, { jobId }, 'Job retried successfully');
    } catch (error) {
      console.error('Error retrying job:', error);
      ResponseHelper.internalError(res, 'Failed to retry job');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/jobs/{jobId}:
   *   delete:
   *     summary: Remove a job from queue
   *     tags: [Admin - Job Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: jobId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Job removed successfully
   *       404:
   *         description: Job not found
   */
  removeJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      await this.queueManager.removeJob(jobId);

      ResponseHelper.success(res, { jobId }, 'Job removed successfully');
    } catch (error) {
      console.error('Error removing job:', error);
      ResponseHelper.internalError(res, 'Failed to remove job');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/jobs/counts:
   *   get:
   *     summary: Get job counts across all queues
   *     tags: [Admin - Job Management]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Job counts
   */
  getJobCounts = async (req: Request, res: Response): Promise<void> => {
    try {
      const counts = await this.queueManager.getJobCounts();
      ResponseHelper.success(res, counts, 'Job counts retrieved successfully');
    } catch (error) {
      console.error('Error getting job counts:', error);
      ResponseHelper.internalError(res, 'Failed to get job counts');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/jobs/failed:
   *   get:
   *     summary: Get failed jobs
   *     tags: [Admin - Job Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: number
   *           default: 50
   *     responses:
   *       200:
   *         description: Failed jobs
   */
  getFailedJobs = async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const failedJobs = await this.queueManager.getFailedJobs(limit);

      ResponseHelper.success(res, failedJobs, 'Failed jobs retrieved successfully');
    } catch (error) {
      console.error('Error getting failed jobs:', error);
      ResponseHelper.internalError(res, 'Failed to get failed jobs');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/jobs/completed:
   *   get:
   *     summary: Get completed jobs
   *     tags: [Admin - Job Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: number
   *           default: 50
   *     responses:
   *       200:
   *         description: Completed jobs
   */
  getCompletedJobs = async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const completedJobs = await this.queueManager.getCompletedJobs(limit);

      ResponseHelper.success(res, completedJobs, 'Completed jobs retrieved successfully');
    } catch (error) {
      console.error('Error getting completed jobs:', error);
      ResponseHelper.internalError(res, 'Failed to get completed jobs');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/jobs/clean:
   *   post:
   *     summary: Clean old jobs from queues
   *     tags: [Admin - Job Management]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - status
   *               - olderThan
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [completed, failed]
   *               olderThan:
   *                 type: number
   *                 description: Age in milliseconds
   *     responses:
   *       200:
   *         description: Jobs cleaned successfully
   */
  cleanJobs = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, olderThan } = req.body;

      if (!status || !olderThan) {
        ResponseHelper.validationError(res, 'Status and olderThan are required');
        return;
      }

      if (!['completed', 'failed'].includes(status)) {
        ResponseHelper.validationError(res, 'Status must be either "completed" or "failed"');
        return;
      }

      const cleanedCount = await this.queueManager.cleanJobs(status as JobStatus, olderThan);

      ResponseHelper.success(res, { 
        status, 
        olderThan, 
        cleanedCount 
      }, `Cleaned ${cleanedCount} ${status} jobs`);
    } catch (error) {
      console.error('Error cleaning jobs:', error);
      ResponseHelper.internalError(res, 'Failed to clean jobs');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/workers:
   *   get:
   *     summary: Get all workers status
   *     tags: [Admin - Worker Management]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Workers status
   */
  getWorkers = async (req: Request, res: Response): Promise<void> => {
    try {
      const workers = Array.from(this.workers.entries()).map(([workerId, worker]) => ({
        workerId,
        isRunning: worker.isRunning(),
        stats: worker.getStats(),
      }));

      ResponseHelper.success(res, workers, 'Workers status retrieved successfully');
    } catch (error) {
      console.error('Error getting workers:', error);
      ResponseHelper.internalError(res, 'Failed to get workers status');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/workers/{workerId}/start:
   *   post:
   *     summary: Start a worker
   *     tags: [Admin - Worker Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workerId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Worker started successfully
   *       404:
   *         description: Worker not found
   */
  startWorker = async (req: Request, res: Response): Promise<void> => {
    try {
      const { workerId } = req.params;
      const worker = this.workers.get(workerId);

      if (!worker) {
        ResponseHelper.notFound(res, 'Worker not found');
        return;
      }

      await worker.start();
      ResponseHelper.success(res, { workerId, status: 'started' }, 'Worker started successfully');
    } catch (error) {
      console.error('Error starting worker:', error);
      ResponseHelper.internalError(res, 'Failed to start worker');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/workers/{workerId}/stop:
   *   post:
   *     summary: Stop a worker
   *     tags: [Admin - Worker Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workerId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Worker stopped successfully
   *       404:
   *         description: Worker not found
   */
  stopWorker = async (req: Request, res: Response): Promise<void> => {
    try {
      const { workerId } = req.params;
      const worker = this.workers.get(workerId);

      if (!worker) {
        ResponseHelper.notFound(res, 'Worker not found');
        return;
      }

      await worker.stop();
      ResponseHelper.success(res, { workerId, status: 'stopped' }, 'Worker stopped successfully');
    } catch (error) {
      console.error('Error stopping worker:', error);
      ResponseHelper.internalError(res, 'Failed to stop worker');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/workers/{workerId}/pause/{queueName}:
   *   post:
   *     summary: Pause queue processing for a worker
   *     tags: [Admin - Worker Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workerId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: queueName
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Queue paused successfully
   *       404:
   *         description: Worker not found
   */
  pauseQueue = async (req: Request, res: Response): Promise<void> => {
    try {
      const { workerId, queueName } = req.params;
      const worker = this.workers.get(workerId);

      if (!worker) {
        ResponseHelper.notFound(res, 'Worker not found');
        return;
      }

      await worker.pauseQueue(queueName);
      ResponseHelper.success(res, { workerId, queueName, status: 'paused' }, 'Queue paused successfully');
    } catch (error) {
      console.error('Error pausing queue:', error);
      ResponseHelper.internalError(res, 'Failed to pause queue');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/workers/{workerId}/resume/{queueName}:
   *   post:
   *     summary: Resume queue processing for a worker
   *     tags: [Admin - Worker Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workerId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: queueName
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Queue resumed successfully
   *       404:
   *         description: Worker not found
   */
  resumeQueue = async (req: Request, res: Response): Promise<void> => {
    try {
      const { workerId, queueName } = req.params;
      const worker = this.workers.get(workerId);

      if (!worker) {
        ResponseHelper.notFound(res, 'Worker not found');
        return;
      }

      await worker.resumeQueue(queueName);
      ResponseHelper.success(res, { workerId, queueName, status: 'resumed' }, 'Queue resumed successfully');
    } catch (error) {
      console.error('Error resuming queue:', error);
      ResponseHelper.internalError(res, 'Failed to resume queue');
    }
  };
}