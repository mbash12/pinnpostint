import { Router } from 'express';
import {
  createSetting,
  getAllSettings,
  getSettingById,
  updateSetting,
  deleteSetting,
  testSmsConfig
} from '../controllers/adminSettingsController';

const router = Router();

// Admin Settings Routes
router.post('/', createSetting);
router.get('/', getAllSettings);
router.put('/', updateSetting); // Update all system settings
router.get('/:settingId', getSettingById);
router.delete('/:settingId', deleteSetting);
router.post('/test-sms', testSmsConfig);

export default router;
