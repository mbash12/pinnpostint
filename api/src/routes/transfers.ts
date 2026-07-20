import { Router } from 'express';
import {
  getAllTransfers,
  getTransferById,
  createTransfer,
  updateTransferStatus,
  deleteTransfer,
} from '../controllers/transferController';
import { adminAuth } from '../middleware/auth';

const router = Router();

// All transfer routes require admin authentication
router.get('/admin/transfers', adminAuth, getAllTransfers);
router.get('/admin/transfers/:transferId', adminAuth, getTransferById);
router.post('/admin/transfers', adminAuth, createTransfer);
router.put('/admin/transfers/:transferId/status', adminAuth, updateTransferStatus);
router.delete('/admin/transfers/:transferId', adminAuth, deleteTransfer);

export default router;
