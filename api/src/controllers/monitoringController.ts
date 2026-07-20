import { Request, Response } from 'express';
import { HealthMonitor } from '../background/monitoring/health-monitor';
import { MetricsTracker } from '../background/monitoring/metrics-tracker';
import { BullJobQueueManager } from '../background/queue-manager/job-queue-manager';
import { ResponseHelper } from '../utils/response-helpers';

export class MonitoringController {
  private healthMonitor: HealthMonitor;
  private metricsTracker: MetricsTracker;
  private queueManager: BullJobQueueManager;

  constructor(
    healthMonitor: HealthMonitor,
    metricsTracker: MetricsTracker,
    queueManager: BullJobQueueManager
  ) {
    this.healthMonitor = healthMonitor;
    this.metricsTracker = metricsTracker;
    this.queueManager = queueManager;
  }

  /**
   * @swagger
   * /api/v1/admin/monitoring/health:
   *   get:
   *     summary: Get system health overview
   *     tags: [Admin - Monitoring]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: System health overview
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     status:
   *                       type: string
   *                       enum: [healthy, degraded, unhealthy]
   *                     timestamp:
   *                       type: string
   *                       format: date-time
   *                     workers:
   *                       type: array
   *                       items:
   *                         type: object
   *                     queues:
   *                       type: array
   *                       items:
   *                         type: object
   *                     metrics:
   *                       type: array
   *                       items:
   *                         type: object
   *                     redis:
   *                       type: object
   */
  getSystemHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const healthOverview = await this.healthMonitor.getSystemHealth();
      ResponseHelper.success(res, healthOverview, 'System health retrieved successfully');
    } catch (error) {
      console.error('Error getting system health:', error);
      ResponseHelper.internalError(res, 'Failed to get system health');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/monitoring/health/summary:
   *   get:
   *     summary: Get health summary
   *     tags: [Admin - Monitoring]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Health summary
   */
  getHealthSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const summary = this.healthMonitor.getHealthSummary();
      ResponseHelper.success(res, summary, 'Health summary retrieved successfully');
    } catch (error) {
      console.error('Error getting health summary:', error);
      ResponseHelper.internalError(res, 'Failed to get health summary');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/monitoring/workers:
   *   get:
   *     summary: Get worker health statuses
   *     tags: [Admin - Monitoring]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Worker health statuses
   */
  getWorkerHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const workers = this.metricsTracker.getWorkerHealthStatuses();
      ResponseHelper.success(res, workers, 'Worker health statuses retrieved successfully');
    } catch (error) {
      console.error('Error getting worker health:', error);
      ResponseHelper.internalError(res, 'Failed to get worker health');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/monitoring/workers/{workerId}:
   *   get:
   *     summary: Get specific worker health status
   *     tags: [Admin - Monitoring]
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
   *         description: Worker health status
   *       404:
   *         description: Worker not found
   */
  getWorkerHealthById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { workerId } = req.params;
      const workerHealth = this.metricsTracker.getWorkerHealth(workerId);
      
      if (!workerHealth) {
        ResponseHelper.notFound(res, 'Worker not found');
        return;
      }

      ResponseHelper.success(res, workerHealth, 'Worker health status retrieved successfully');
    } catch (error) {
      console.error('Error getting worker health by ID:', error);
      ResponseHelper.internalError(res, 'Failed to get worker health');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/monitoring/queues:
   *   get:
   *     summary: Get queue statistics
   *     tags: [Admin - Monitoring]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Queue statistics
   */
  getQueueStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const queues = this.metricsTracker.getQueueStatistics();
      ResponseHelper.success(res, queues, 'Queue statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting queue statistics:', error);
      ResponseHelper.internalError(res, 'Failed to get queue statistics');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/monitoring/queues/{queueName}:
   *   get:
   *     summary: Get specific queue statistics
   *     tags: [Admin - Monitoring]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: queueName
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Queue statistics
   *       404:
   *         description: Queue not found
   */
  getQueueStatisticsById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { queueName } = req.params;
      const queueStats = this.metricsTracker.getQueueStatisticsByName(queueName);
      
      if (!queueStats) {
        ResponseHelper.notFound(res, 'Queue not found');
        return;
      }

      ResponseHelper.success(res, queueStats, 'Queue statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting queue statistics by name:', error);
      ResponseHelper.internalError(res, 'Failed to get queue statistics');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/monitoring/metrics:
   *   get:
   *     summary: Get job execution metrics
   *     tags: [Admin - Monitoring]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Job execution metrics
   */
  getJobMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const metrics = this.metricsTracker.getJobMetrics();
      ResponseHelper.success(res, metrics, 'Job metrics retrieved successfully');
    } catch (error) {
      console.error('Error getting job metrics:', error);
      ResponseHelper.internalError(res, 'Failed to get job metrics');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/monitoring/metrics/{jobType}:
   *   get:
   *     summary: Get specific job type metrics
   *     tags: [Admin - Monitoring]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: jobType
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Job type metrics
   *       404:
   *         description: Job type not found
   */
  getJobMetricsByType = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobType } = req.params;
      const metrics = this.metricsTracker.getJobMetricsByType(jobType);
      
      if (!metrics) {
        ResponseHelper.notFound(res, 'Job type metrics not found');
        return;
      }

      ResponseHelper.success(res, metrics, 'Job type metrics retrieved successfully');
    } catch (error) {
      console.error('Error getting job metrics by type:', error);
      ResponseHelper.internalError(res, 'Failed to get job metrics');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/monitoring/metrics/{jobType}:
   *   delete:
   *     summary: Reset metrics for specific job type
   *     tags: [Admin - Monitoring]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: jobType
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Metrics reset successfully
   */
  resetJobMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobType } = req.params;
      this.metricsTracker.resetJobMetrics(jobType);
      ResponseHelper.success(res, null, `Metrics for job type ${jobType} reset successfully`);
    } catch (error) {
      console.error('Error resetting job metrics:', error);
      ResponseHelper.internalError(res, 'Failed to reset job metrics');
    }
  };

  /**
   * @swagger
   * /api/v1/admin/monitoring/metrics:
   *   delete:
   *     summary: Reset all metrics
   *     tags: [Admin - Monitoring]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: All metrics reset successfully
   */
  resetAllMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      this.metricsTracker.resetAllMetrics();
      ResponseHelper.success(res, null, 'All metrics reset successfully');
    } catch (error) {
      console.error('Error resetting all metrics:', error);
      ResponseHelper.internalError(res, 'Failed to reset all metrics');
    }
  };
}