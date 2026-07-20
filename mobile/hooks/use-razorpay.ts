import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { paymentService } from '@/services/payment.service';
import { settingsService } from '@/services/settings.service';
import { storageHelper } from '@/utils/storage.helper';

const RAZORPAY_KEY = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;

const STORAGE_KEY = '@pending_payment_verifications';

interface PendingVerification {
  orderId: string;
  paymentId: string;
  signature: string;
  adId?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  slotId?: string;
  bookingDate?: string;
  timestamp: number;
}

interface RazorpayOptions {
  amount: number;
  currency: string;
  orderId: string;
  name: string;
  description: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

/**
 * Retry a function with exponential backoff.
 * Delays: 1s, 2s, 4s for up to `maxRetries` attempts.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ── Pending verification persistence ──────────────────────────────

async function loadPending(): Promise<PendingVerification[]> {
  try {
    const raw = await storageHelper.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function savePending(verification: PendingVerification): Promise<void> {
  const pending = await loadPending();
  // Avoid duplicates by payment ID
  const filtered = pending.filter((p) => p.paymentId !== verification.paymentId);
  filtered.push(verification);
  await storageHelper.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

async function removePending(paymentId: string): Promise<void> {
  const pending = await loadPending();
  const filtered = pending.filter((p) => p.paymentId !== paymentId);
  await storageHelper.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// ── Pending order persistence (saved BEFORE WebView opens) ─────────

const PENDING_ORDER_KEY = '@pending_payment_orders';

interface PendingOrder {
  orderId: string;
  adId?: string;
  timestamp: number;
}

async function loadPendingOrders(): Promise<PendingOrder[]> {
  try {
    const raw = await storageHelper.getItem(PENDING_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePendingOrder(orderId: string, adId?: string): Promise<void> {
  const orders = await loadPendingOrders();
  const filtered = orders.filter((o) => o.orderId !== orderId);
  filtered.push({ orderId, adId, timestamp: Date.now() });
  await storageHelper.setItem(PENDING_ORDER_KEY, JSON.stringify(filtered));
}

export async function removePendingOrder(orderId: string): Promise<void> {
  const orders = await loadPendingOrders();
  const filtered = orders.filter((o) => o.orderId !== orderId);
  await storageHelper.setItem(PENDING_ORDER_KEY, JSON.stringify(filtered));
}

/**
 * Retry all pending payment verifications AND recover orphaned orders on app startup.
 * Call once at app root.
 */
export async function retryPendingVerifications(): Promise<number> {
  let succeeded = 0;

  // 1. Retry verifications that were saved with full payment data
  const pending = await loadPending();
  for (const v of pending) {
    try {
      await withRetry(() =>
        paymentService.verifyPayment({
          razorpay_order_id: v.orderId,
          razorpay_payment_id: v.paymentId,
          razorpay_signature: v.signature,
          adId: v.adId,
          startDate: v.startDate,
          endDate: v.endDate,
          notes: v.notes,
          slotId: v.slotId,
          bookingDate: v.bookingDate,
        }),
      );
      await removePending(v.paymentId);
      succeeded++;
    } catch {
      // Leave for next retry
    }
  }

  // 2. Recover orphaned orders (WebView callback was lost)
  const orders = await loadPendingOrders();
  for (const o of orders) {
    try {
      const result: any = await withRetry(() =>
        paymentService.recoverOrder(o.orderId, o.adId),
      );
      if (result?.success) {
        await removePendingOrder(o.orderId);
        succeeded++;
      }
    } catch {
      // Leave for next retry
    }
  }

  return succeeded;
}

// ── Hook ───────────────────────────────────────────────────────────

export const useRazorpay = () => {
  const [dynamicKey, setDynamicKey] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await settingsService.getPublicSystemSettings();
        if (response.success && response.data?.razorpayKeyId) {
          setDynamicKey(response.data.razorpayKeyId);
        }
      } catch (e) {
        // Fallback to env key
      }
    };
    fetchSettings();
  }, []);

  const getKey = () => dynamicKey || RAZORPAY_KEY || '';

  const createOrder = async (adId: string) => {
    return await paymentService.createOrder({
      adId,
      paymentProvider: 'RAZORPAY',
      currency: 'INR',
    });
  };

  const createBookingOrder = async (amount: number, adId: string) => {
    return await paymentService.createBookingOrder({
      adId,
      amount,
      paymentProvider: 'RAZORPAY',
      currency: 'INR',
    });
  };

  const createAdPaymentOrder = async (amount: number, adId?: string, description?: string) => {
    return await paymentService.createAdPayment({
      adId,
      amount,
      paymentProvider: 'RAZORPAY',
      currency: 'INR',
      description
    });
  };

  const verifyPayment = async (
    orderId: string,
    paymentId: string,
    signature: string,
    adId?: string,
    startDate?: string,
    endDate?: string,
    notes?: string,
    slotId?: string,
    bookingDate?: string
  ) => {
    const verification: PendingVerification = {
      orderId,
      paymentId,
      signature,
      adId,
      startDate,
      endDate,
      notes,
      slotId,
      bookingDate,
      timestamp: Date.now(),
    };

    // Persist before calling — if the app crashes mid-request, we recover
    await savePending(verification);

    try {
      const result = await withRetry(() =>
        paymentService.verifyPayment({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          adId,
          startDate,
          endDate,
          notes,
          slotId,
          bookingDate,
        }),
      );

      // Success — clear from both pending storages
      await removePending(paymentId);
      await removePendingOrder(orderId);
      return result;
    } catch (error) {
      // Leave in pending storage for startup retry
      throw error;
    }
  };

  const renewSubscription = async (adId: string) => {
    return await paymentService.renewSubscription({
      adId,
      paymentProvider: 'RAZORPAY',
      currency: 'INR',
    });
  };

  return {
    getKey,
    createOrder,
    createBookingOrder,
    createAdPaymentOrder,
    verifyPayment,
    renewSubscription,
  };
};
