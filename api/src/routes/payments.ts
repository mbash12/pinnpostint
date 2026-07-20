import { Router } from 'express';
import {
  renewSubscription,
  getPaymentStatus,
  getUserSubscriptions,
  getUserTransactions,
  verifyRazorpayPayment,
  extendAdSubscription,
  getAllTransactions,
  getTransactionById,
  refundTransaction,
  getAllSubscriptions,
  getSubscriptionById,
  getExpiringSubscriptions,
  createBookingPayment,
  createAdPayment,
  cancelSubscription,
  reactivateSubscription,
  recoverOrderPayment
} from '../controllers/paymentController';
import { authenticate, adminAuth } from '../middleware/auth';

const router = Router();

// Booking payment routes (require authentication)
router.post('/bookings/payment/create', authenticate, createBookingPayment);

// Ad creation payment routes (require authentication)
router.post('/ads/payment/create', authenticate, createAdPayment);

// Subscription routes (require authentication)
router.post('/subscriptions/:adId/renew', authenticate, renewSubscription);

// Payment status routes (require authentication)
router.get('/payments/:paymentIntentId/status', authenticate, getPaymentStatus);

// User subscription and transaction routes (require authentication)
router.get('/users/me/subscriptions', authenticate, getUserSubscriptions);
router.get('/users/me/transactions', authenticate, getUserTransactions);


// Razorpay payment verification (require authentication)
router.post('/payments/razorpay/verify', authenticate, verifyRazorpayPayment);

// Order recovery route (for when mobile WebView callback was lost)
router.post('/payments/order/:orderId/recover', authenticate, recoverOrderPayment);

// Admin routes (require admin authentication)
router.post('/admin/ads/:adId/subscription/extend', adminAuth, extendAdSubscription);
router.get('/admin/subscriptions', adminAuth, getAllSubscriptions);
router.get('/admin/subscriptions/expiring', adminAuth, getExpiringSubscriptions);
router.get('/admin/subscriptions/:subscriptionId', adminAuth, getSubscriptionById);
router.post('/admin/subscriptions/:subscriptionId/cancel', adminAuth, cancelSubscription);
router.post('/admin/subscriptions/:subscriptionId/reactivate', adminAuth, reactivateSubscription);
router.get('/admin/transactions', adminAuth, getAllTransactions);
router.get('/admin/transactions/:transactionId', adminAuth, getTransactionById);
router.post('/admin/transactions/:transactionId/refund', adminAuth, refundTransaction);

export default router;
