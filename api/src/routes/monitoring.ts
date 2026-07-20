import { Router } from 'express';
import { MonitoringController } from '../controllers/monitoringController';
import { HealthMonitor } from '../background/monitoring/health-monitor';
import { MetricsTracker } from '../background/monitoring/metrics-tracker';
import { BullJobQueueManager } from '../background/queue-manager/job-queue-manager';
import { MonitoringConfig } from '../background/monitoring/interfaces/monitoring.interface';
import { config } from '../config/environment';

const router = Router();

// Initialize monitoring components only if jobs are enabled
let metricsTracker: MetricsTracker | null = null;
let queueManager: BullJobQueueManager | null = null;
let healthMonitor: HealthMonitor | null = null;
let monitoringController: MonitoringController | null = null;

if (config.jobs.enabled) {
  // Default monitoring configuration
  const defaultMonitoringConfig: MonitoringConfig = {
    healthCheckInterval: 30000, // 30 seconds
    metricsRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
    alertThresholds: {
      failureRate: 10, // 10%
      queueBacklog: 100, // 100 jobs
      workerResponseTime: 5000, // 5 seconds
    },
  };

  // Initialize monitoring components
  metricsTracker = new MetricsTracker(defaultMonitoringConfig);
  queueManager = new BullJobQueueManager();
  healthMonitor = new HealthMonitor(metricsTracker, queueManager, defaultMonitoringConfig);
  
  // Initialize monitoring controller
  monitoringController = new MonitoringController(healthMonitor, metricsTracker, queueManager);
}

// Helper function to check if monitoring is available
const checkMonitoringAvailable = (res: any) => {
  if (!monitoringController) {
    res.status(503).json({
      success: false,
      error: {
        code: 'MONITORING_DISABLED',
        message: 'Monitoring is disabled because background job system is not enabled'
      }
    });
    return false;
  }
  return true;
};

// Health monitoring routes
router.get('/health', (req, res) => {
  if (!checkMonitoringAvailable(res)) return;
  monitoringController!.getSystemHealth(req, res);
});

router.get('/health/summary', (req, res) => {
  if (!checkMonitoringAvailable(res)) return;
  monitoringController!.getHealthSummary(req, res);
});

// Worker monitoring routes
router.get('/workers', (req, res) => {
  if (!checkMonitoringAvailable(res)) return;
  monitoringController!.getWorkerHealth(req, res);
});

router.get('/workers/:workerId', (req, res) => {
  if (!checkMonitoringAvailable(res)) return;
  monitoringController!.getWorkerHealthById(req, res);
});

// Queue monitoring routes
router.get('/queues', (req, res) => {
  if (!checkMonitoringAvailable(res)) return;
  monitoringController!.getQueueStatistics(req, res);
});

router.get('/queues/:queueName', (req, res) => {
  if (!checkMonitoringAvailable(res)) return;
  monitoringController!.getQueueStatisticsById(req, res);
});

// Metrics routes
router.get('/metrics', (req, res) => {
  if (!checkMonitoringAvailable(res)) return;
  monitoringController!.getJobMetrics(req, res);
});

router.get('/metrics/:jobType', (req, res) => {
  if (!checkMonitoringAvailable(res)) return;
  monitoringController!.getJobMetricsByType(req, res);
});

router.delete('/metrics/:jobType', (req, res) => {
  if (!checkMonitoringAvailable(res)) return;
  monitoringController!.resetJobMetrics(req, res);
});

router.delete('/metrics', (req, res) => {
  if (!checkMonitoringAvailable(res)) return;
  monitoringController!.resetAllMetrics(req, res);
});

// Export both router and monitoring instances for use in other parts of the application
export default router;
export { healthMonitor, metricsTracker, queueManager };