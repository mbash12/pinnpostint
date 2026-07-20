/**
 * Bookings Service
 * Handles all booking-related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_ENDPOINTS } from '@/config/api.config';

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: 'SUBMITTED' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentProvider: 'RAZORPAY';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  adId: string;
  userId: string;
  status: 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  startDate?: string;
  endDate?: string;
  slotId?: string;
  bookingDate?: string;
  notes?: string;
  _count?: {
    complaints: number;
  };
  complaints?: Array<{
    id: string;
    status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED';
    updatedAt: string;
  }>;
  transactions?: Transaction[];
  ad: {
    id: string;
    title: string;
    price: number;
    images?: string[]; // Make optional, as it might not always be returned or needed
    userId: string;
    category?: {
      id: string;
      name: string;
    };
    slots?: Array<{
      id: string;
      startTime: string;
      endTime: string;
    }>;
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string; // Make optional as not always returned
    email?: string; // Make optional as not always returned
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingRequest {
  adId: string;
  startDate?: string;
  endDate?: string;
  slotId?: string;
  bookingDate?: string;
  notes?: string;
}

export interface UpdateBookingStatusRequest {
  status: 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
}

class BookingsService {
  /**
   * Get all bookings (merge outgoing and incoming)
   */
  async getBookings(): Promise<ApiResponse<Booking[]>> {
    try {
      const [outgoing, incoming] = await Promise.all([
        this.getOutgoingBookings(),
        this.getIncomingBookings(),
      ]);
      const combined = [
        ...(outgoing.success && outgoing.data ? outgoing.data : []),
        ...(incoming.success && incoming.data ? incoming.data : []),
      ];
      return { success: true, data: combined };
    } catch (error: any) {
      return { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch bookings' } as any };
    }
  }

  /**
   * Get outgoing bookings (bookings I made)
   */
  async getOutgoingBookings(params?: { page?: number; limit?: number; status?: string; search?: string }): Promise<ApiResponse<Booking[]>> {
    return apiService.get<Booking[]>(API_ENDPOINTS.BOOKINGS.USER_OUTGOING, params);
  }

  /**
   * Get incoming bookings (bookings on my ads)
   */
  async getIncomingBookings(params?: { page?: number; limit?: number; status?: string; search?: string }): Promise<ApiResponse<Booking[]>> {
    return apiService.get<Booking[]>(API_ENDPOINTS.BOOKINGS.USER_INCOMING, params);
  }

  /**
   * Get single booking
   */
  async getBooking(bookingId: string): Promise<ApiResponse<Booking>> {
    return apiService.get<Booking>(API_ENDPOINTS.BOOKINGS.DETAIL(bookingId));
  }

  /**
   * Create booking
   */
  async createBooking(data: CreateBookingRequest): Promise<ApiResponse<Booking>> {
    return apiService.post<Booking>(API_ENDPOINTS.BOOKINGS.BASE, data);
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(
    bookingId: string,
    data: UpdateBookingStatusRequest
  ): Promise<ApiResponse<Booking>> {
    return apiService.put<Booking>(
      API_ENDPOINTS.BOOKINGS.UPDATE_STATUS(bookingId),
      data
    );
  }

  /**
   * Confirm booking
   */
  async confirmBooking(bookingId: string): Promise<ApiResponse<Booking>> {
    return apiService.post<Booking>(API_ENDPOINTS.BOOKINGS.CONFIRM(bookingId));
  }

  /**
   * Reject booking
   */
  async rejectBooking(bookingId: string, reason: string): Promise<ApiResponse<Booking>> {
    return apiService.post<Booking>(API_ENDPOINTS.BOOKINGS.REJECT(bookingId), { reason });
  }

  /**
   * Cancel booking
   */
  async cancelBooking(bookingId: string): Promise<ApiResponse<Booking>> {
    return apiService.post<Booking>(API_ENDPOINTS.BOOKINGS.CANCEL(bookingId));
  }

  /**
   * Approve cancellation request (for sellers)
   */
  async approveCancellation(bookingId: string): Promise<ApiResponse<Booking>> {
    return apiService.post<Booking>(`/bookings/${bookingId}/approve-cancellation`);
  }

  /**
   * Reject cancellation request (for sellers)
   */
  async rejectCancellation(bookingId: string, reason: string): Promise<ApiResponse<Booking>> {
    return apiService.post<Booking>(`/bookings/${bookingId}/reject-cancellation`, { reason });
  }

  /**
   * Complete booking
   */
  async completeBooking(bookingId: string): Promise<ApiResponse<Booking>> {
    return apiService.post<Booking>(API_ENDPOINTS.BOOKINGS.COMPLETE(bookingId));
  }

  /**
   * Get bookings for a specific ad (for ad owners)
   */
  async getAdBookings(adId: string): Promise<ApiResponse<Booking[]>> {
    return apiService.get<Booking[]>(`/users/me/ads/${adId}/bookings`);
  }

  /**
   * Get transactions for a booking
   */
  async getBookingTransactions(bookingId: string): Promise<ApiResponse<Transaction[]>> {
    return apiService.get<Transaction[]>(`/bookings/${bookingId}/transactions`);
  }
}

// Export singleton instance
export const bookingsService = new BookingsService();
export default bookingsService;
