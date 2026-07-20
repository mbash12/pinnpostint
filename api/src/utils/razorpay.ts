import Razorpay from 'razorpay';
import { config } from '../config/environment';
import * as crypto from 'crypto';

let razorpayInstance: Razorpay | null = null;

export const getRazorpayInstance = (): Razorpay => {
  if (!razorpayInstance) {
    console.log('Initializing Razorpay with keyId:', config.razorpay.keyId);
    if (!config.razorpay.keyId || !config.razorpay.keySecret) {
      throw new Error('Razorpay credentials not configured');
    }
    console.log('Razorpay keySecret length:', config.razorpay.keySecret?.length);
    razorpayInstance = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
    console.log('Razorpay instance created successfully');
  }
  return razorpayInstance;
};

export const createRazorpayOrder = async (amount: number, currency: string = 'INR') => {
  try {
    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: currency.toUpperCase(),
      receipt: `receipt_${Date.now()}`,
    });
    return order;
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    // Ensure we throw a proper Error object
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(typeof error === 'string' ? error : 'Failed to create Razorpay order');
  }
};

export const verifyRazorpaySignature = (
  orderId: string,
  paymentId: string,
  signature: string
): boolean => {
  const text = `${orderId}|${paymentId}`;
  if (!config.razorpay.keySecret) {
    throw new Error('Razorpay key secret not configured');
  }
  const generated_signature = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(text)
    .digest('hex');
  return generated_signature === signature;
};

export interface RazorpayPaymentDetails {
  id: string;
  method: string;
  vpa?: string | null;
  wallet?: string | null;
  bank?: string;
  card_id?: string | null;
  email?: string;
  contact?: string;
}

export const fetchRazorpayPaymentDetails = async (paymentId: string): Promise<RazorpayPaymentDetails | null> => {
  try {
    const razorpay = getRazorpayInstance();
    const payment: any = await razorpay.payments.fetch(paymentId);

    return {
      id: payment.id,
      method: payment.method || 'unknown',
      vpa: payment.vpa || null,
      wallet: payment.wallet || null,
      bank: payment.bank || '',
      card_id: payment.card_id || null,
      email: payment.email || '',
      contact: payment.contact || ''
    };
  } catch (error) {
    console.error('Failed to fetch Razorpay payment details:', error);
    return null;
  }
};

/**
 * Fetch payments for a Razorpay order to find a successful payment.
 * Used for recovery when the mobile's WebView callback was lost.
 */
export const fetchRazorpayOrderPayments = async (orderId: string): Promise<{ paymentId: string; signature: string } | null> => {
  try {
    const razorpay = getRazorpayInstance();
    const payments: any = await razorpay.orders.fetchPayments(orderId);
    
    if (Array.isArray(payments?.items)) {
      const captured = payments.items.find((p: any) => p.status === 'captured');
      if (captured) {
        // Generate the signature that Razorpay would produce
        const text = `${orderId}|${captured.id}`;
        const signature = crypto
          .createHmac('sha256', config.razorpay.keySecret!)
          .update(text)
          .digest('hex');
        return { paymentId: captured.id, signature };
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch Razorpay order payments:', error);
    return null;
  }
};
