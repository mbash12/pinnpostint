import { Router } from 'express';
import {
  getOutboxOverview,
  getSmsForecast,
  retryOutboxRowHandler,
  triggerOutboxDrainHandler,
} from '../controllers/adminSmsOutboxController';

const router = Router();

router.get('/forecast', getSmsForecast);
router.get('/', getOutboxOverview);
router.post('/drain', triggerOutboxDrainHandler);
router.post('/:id/retry', retryOutboxRowHandler);

export default router;
