import { Router } from 'express';
import {
  createBooking,
  getOutgoingBookings,
  getIncomingBookings,
  confirmBooking,
  rejectBooking,
  cancelBooking,
  completeBooking,
  getAllBookings,
  getBookingById,
  getBookingTransactions,
  updateBookingStatus,
  deleteBooking,
  approveCancellationRequest,
  rejectCancellationRequest,
  adminApproveCancellationRequest,
  adminRejectCancellationRequest
} from '../controllers/bookingController';
import { authenticate, adminAuth } from '../middleware/auth';

const router = Router();

// Booking creation (require authentication)
router.post('/bookings', authenticate, createBooking);

// User booking routes (require authentication)
router.get('/users/me/bookings/outgoing', authenticate, getOutgoingBookings);
router.get('/users/me/bookings/incoming', authenticate, getIncomingBookings);

// Get single booking (require authentication)
router.get('/bookings/:bookingId', authenticate, getBookingById);
router.get('/bookings/:bookingId/transactions', authenticate, getBookingTransactions);

// Booking actions (require authentication)
router.post('/bookings/:bookingId/confirm', authenticate, confirmBooking);
router.post('/bookings/:bookingId/reject', authenticate, rejectBooking);
router.post('/bookings/:bookingId/cancel', authenticate, cancelBooking);
router.post('/bookings/:bookingId/complete', authenticate, completeBooking);
router.post('/bookings/:bookingId/approve-cancellation', authenticate, approveCancellationRequest);
router.post('/bookings/:bookingId/reject-cancellation', authenticate, rejectCancellationRequest);

// Admin booking routes (require admin authentication)
router.get('/admin/bookings', adminAuth, getAllBookings);
router.get('/admin/bookings/:bookingId', adminAuth, getBookingById);
router.put('/admin/bookings/:bookingId', adminAuth, updateBookingStatus);
router.post('/admin/bookings/:bookingId/approve-cancellation', adminAuth, adminApproveCancellationRequest);
router.post('/admin/bookings/:bookingId/reject-cancellation', adminAuth, adminRejectCancellationRequest);
router.delete('/bookings/:bookingId', adminAuth, deleteBooking);

export default router;