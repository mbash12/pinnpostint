import { Router } from 'express';
import {
  createComplaint,
  getReceivedComplaints,
  getAllComplaints,
  getComplaintById,
  updateComplaintStatus,
  resolveWithRefund,
  completeWithoutRefund,
  closeComplaint,
} from '../controllers/complaintController';
import {
  sendMessage,
  getComplaintMessages,
} from '../controllers/complaintMessageController';
import { authenticate, adminAuth } from '../middleware/auth';

const router = Router();

// Buyer routes - File a complaint
router.post('/bookings/:bookingId/complaint', authenticate, createComplaint);

// Buyer route - Close a complaint (reporter/buyer only)
router.post('/complaints/:complaintId/close', authenticate, closeComplaint);

// Seller routes - View complaints received
router.get('/complaints/received', authenticate, getReceivedComplaints);

// Admin routes - Manage all complaints
router.get('/admin/complaints', adminAuth, getAllComplaints);
router.get('/admin/complaints/:complaintId', adminAuth, getComplaintById);
router.put('/admin/complaints/:complaintId/status', adminAuth, updateComplaintStatus);

// Admin message routes - For discussion threads
router.post('/admin/complaints/:complaintId/messages', adminAuth, sendMessage);
router.get('/admin/complaints/:complaintId/messages', adminAuth, getComplaintMessages);

// Complaint message routes - For discussion threads (mobile/user)
router.post('/complaints/:complaintId/messages', authenticate, sendMessage);
router.get('/complaints/:complaintId/messages', authenticate, getComplaintMessages);

// Complaint resolution routes
router.post('/complaints/:complaintId/resolve-with-refund', authenticate, resolveWithRefund);
router.post('/complaints/:complaintId/complete', authenticate, completeWithoutRefund);

export default router;
