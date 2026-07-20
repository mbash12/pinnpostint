import { Router } from 'express';
import { JobManagementController } from '../controllers/jobManagementController';
import { BullJobQueueManager } from '../background/queue-manager/job-queue-manager';
import { healthMonitor } from './monitoring';
import { config } from '../config/environment';

const router = Router();

// Initialize job management components only if jobs are enabled
let queueManager: BullJobQueueManager | null = null;
let jobManagementController: JobManagementController | null = null;

if (config.jobs.enabled) {
  queueManager = new BullJobQueueManager();
  if (healthMonitor) {
    jobManagementController = new JobManagementController(queueManager, healthMonitor);
  }
}

// Helper function to check if job management is available
const checkJobManagementAvailable = (res: any) => {
  if (!jobManagementController) {
    res.status(503).json({
      success: false,
      error: {
        code: 'JOB_MANAGEMENT_DISABLED',
        message: 'Job management is disabled because background job system is not enabled'
      }
    });
    return false;
  }
  return true;
};

// Job management routes
router.post('/jobs/trigger', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.triggerJob(req, res);
});

router.get('/jobs/counts', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.getJobCounts(req, res);
});

router.get('/jobs/failed', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.getFailedJobs(req, res);
});

router.get('/jobs/completed', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.getCompletedJobs(req, res);
});

router.post('/jobs/clean', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.cleanJobs(req, res);
});

// Individual job management
router.get('/jobs/:jobId', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.getJob(req, res);
});

router.get('/jobs/:jobId/status', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.getJobStatus(req, res);
});

router.post('/jobs/:jobId/retry', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.retryJob(req, res);
});

router.delete('/jobs/:jobId', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.removeJob(req, res);
});

// Worker management routes
router.get('/workers', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.getWorkers(req, res);
});

router.post('/workers/:workerId/start', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.startWorker(req, res);
});

router.post('/workers/:workerId/stop', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.stopWorker(req, res);
});

router.post('/workers/:workerId/pause/:queueName', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.pauseQueue(req, res);
});

router.post('/workers/:workerId/resume/:queueName', (req, res) => {
  if (!checkJobManagementAvailable(res)) return;
  jobManagementController!.resumeQueue(req, res);
});

// Export both router and controller for use in other parts of the application
export default router;
export { jobManagementController };