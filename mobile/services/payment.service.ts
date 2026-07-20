import { apiService } from './api.service';

export interface CreateOrderParams {
  adId: string;
  paymentProvider: 'RAZORPAY';
  currency?: string;
}

export interface CreateBookingOrderParams {
  adId: string;
  amount: number;
  paymentProvider: 'RAZORPAY';
  currency?: string;
}

export interface CreateAdPaymentParams {
  adId?: string;
  amount: number;
  paymentProvider: 'RAZORPAY';
  currency?: string;
  description?: string;
}

export interface PaymentOrderResponse {
  id: string;
  amount: number;
  currency: string;
  paymentIntentId: string;
  paymentProvider: string;
  status: string;
  description?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface VerifyPaymentParams {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  adId?: string;
  startDate?: string;
  endDate?: string;
  slotId?: string;
  bookingDate?: string;
  notes?: string;
}

export interface RenewSubscriptionParams {
  adId: string;
  paymentProvider: 'RAZORPAY';
  currency?: string;
}

export const paymentService = {
  createOrder: async (params: CreateOrderParams): Promise<PaymentOrderResponse> => {
    const response = await apiService.post(
      `/subscriptions/${params.adId}/renew`,
      {
        paymentProvider: params.paymentProvider,
        currency: params.currency || 'INR',
      }
    );
    return response.data as PaymentOrderResponse;
  },

  createBookingOrder: async (params: CreateBookingOrderParams): Promise<PaymentOrderResponse> => {
    const response = await apiService.post(
      '/bookings/payment/create',
      {
        adId: params.adId,
        amount: params.amount,
        paymentProvider: params.paymentProvider,
        currency: params.currency || 'INR',
      }
    );
    return response.data as PaymentOrderResponse;
  },

  createAdPayment: async (params: CreateAdPaymentParams): Promise<PaymentOrderResponse> => {
    const response = await apiService.post(
      '/ads/payment/create',
      {
        adId: params.adId,
        amount: params.amount,
        paymentProvider: params.paymentProvider,
        currency: params.currency || 'INR',
        description: params.description || 'Ad creation payment'
      }
    );
    return response.data as PaymentOrderResponse;
  },

  verifyPayment: async (params: VerifyPaymentParams) => {
    const response = await apiService.post('/payments/razorpay/verify', params);
    return response.data;
  },

  recoverOrder: async (orderId: string, adId?: string) => {
    const response = await apiService.post(`/payments/order/${orderId}/recover`, { adId });
    return response.data;
  },

  getUserTransactions: async (page = 1, limit = 10) => {
    const response = await apiService.get('/users/me/transactions', {
      params: { page, limit },
    });
    return response.data;
  },

  getUserSubscriptions: async (page = 1, limit = 10) => {
    const response = await apiService.get('/users/me/subscriptions', {
      params: { page, limit },
    });
    return response.data;
  },

  renewSubscription: async (params: RenewSubscriptionParams): Promise<PaymentOrderResponse> => {
    const response = await apiService.post(
      `/subscriptions/${params.adId}/renew`,
      {
        paymentProvider: params.paymentProvider,
        currency: params.currency || 'INR',
      }
    );
    return response.data as PaymentOrderResponse;
  },
};
