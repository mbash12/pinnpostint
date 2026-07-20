/**
 * User Service
 * Handles all user-related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_ENDPOINTS } from '@/config/api.config';
import { User } from './auth.service';

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  address?: string;
  cityId?: string;
  stateId?: string;
  country?: string;
  postalCodeId?: string;
  gender?: 'male' | 'female';
}

export interface SavedLocation {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country: string;
  pincode?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // User-specific fields for saved locations
  userId?: string;
  isDefault?: boolean;
}

export interface CreateLocationRequest {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  isDefault?: boolean;
}

export interface UpdateLocationRequest {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  isDefault?: boolean;
}

export interface WishlistItem {
  id: string;
  adId: string;
  userId: string;
  ad: {
    id: string;
    slug: string;
    title: string;
    price: number;
    images: string[];
    status: string;
    locationCity?: string;
    locationState?: string;
    locationCountry?: string;
    locationFormatted?: string;
    category?: {
      id?: string;
      name?: string;
      adPlaceholder?: string;
    };
    subcategory?: {
      id?: string;
      name?: string;
    };
  };
  createdAt: string;
}

export type NotificationType =
  | 'SUBSCRIPTION_EXPIRY'
  | 'AD_APPROVED'
  | 'AD_REJECTED'
  | 'GENERAL'
  | 'BOOKING_UPDATE'
  | 'SYSTEM'
  | 'BOOKING'
  | 'PROMOTION'
  | 'COMPLAINT'
  | 'PAYMENT';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  data?: Record<string, any>;
  sentAt: string;
  scheduledAt?: string;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  bookingNotifications: boolean;
  adStatusNotifications: boolean;
  systemNotifications: boolean;
  promotionNotifications: boolean;
}

class UserService {
  /**
   * Get current user profile
   */
  async getProfile(): Promise<ApiResponse<User>> {
    return apiService.get<User>(API_ENDPOINTS.USER.ME);
  }

  /**
   * Get user by ID (public)
   */
  async getUserById(userId: string): Promise<ApiResponse<User>> {
    return apiService.get<User>(API_ENDPOINTS.PUBLIC.USER(userId));
  }

  /**
   * Get user ads by user ID (public)
   */
  async getUserAds(userId: string, params?: { page?: number; limit?: number }): Promise<ApiResponse<any>> {
    return apiService.get<any>(API_ENDPOINTS.PUBLIC.USER_ADS(userId), params);
  }

  /**
   * Update current user profile
   */
  async updateProfile(data: UpdateUserRequest): Promise<ApiResponse<User>> {
    return apiService.put<User>(API_ENDPOINTS.USER.UPDATE_ME, data);
  }

  /**
   * Update FCM token for push notifications
   */
  async updateFcmToken(fcmToken: string): Promise<ApiResponse<void>> {
    return apiService.put<void>(API_ENDPOINTS.USER.UPDATE_FCM_TOKEN, {
      fcmToken,
    });
  }

  /**
   * Get states for profile selection
   */
  async getStates(params?: { search?: string }): Promise<ApiResponse<any[]>> {
    return apiService.get<any[]>(API_ENDPOINTS.PUBLIC.STATES, params);
  }

  /**
   * Get cities for profile selection
   */
  async getCities(params?: { stateId?: string; search?: string }): Promise<ApiResponse<any[]>> {
    return apiService.get<any[]>(API_ENDPOINTS.PUBLIC.CITIES, params);
  }

  /**
   * Get postal codes for profile selection
   */
  async getPostalCodes(params?: { cityId?: string; search?: string }): Promise<ApiResponse<any[]>> {
    return apiService.get<any[]>(API_ENDPOINTS.PUBLIC.POSTAL_CODES, params);
  }

  /**
   * Get saved locations
   */
  async getLocations(): Promise<ApiResponse<SavedLocation[]>> {
    return apiService.get<SavedLocation[]>(API_ENDPOINTS.USER.LOCATIONS);
  }

  /**
   * Add saved location
   */
  async addLocation(data: CreateLocationRequest): Promise<ApiResponse<SavedLocation>> {
    return apiService.post<SavedLocation>(API_ENDPOINTS.USER.LOCATIONS, data);
  }

  /**
   * Update saved location
   */
  async updateLocation(
    locationId: string,
    data: UpdateLocationRequest
  ): Promise<ApiResponse<SavedLocation>> {
    return apiService.put<SavedLocation>(
      API_ENDPOINTS.USER.LOCATION(locationId),
      data
    );
  }

  /**
   * Delete saved location
   */
  async deleteLocation(locationId: string): Promise<ApiResponse<void>> {
    return apiService.delete<void>(API_ENDPOINTS.USER.LOCATION(locationId));
  }

  /**
   * Get wishlist
   */
  async getWishlist(params?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse<WishlistItem[]>> {
    return apiService.get<WishlistItem[]>(API_ENDPOINTS.USER.WISHLIST, params);
  }

  /**
   * Add to wishlist
   */
  async addToWishlist(adId: string): Promise<ApiResponse<WishlistItem>> {
    return apiService.post<WishlistItem>(API_ENDPOINTS.USER.WISHLIST, {
      adId,
    });
  }

  /**
   * Remove from wishlist
   */
  async removeFromWishlist(adId: string): Promise<ApiResponse<void>> {
    return apiService.delete<void>(API_ENDPOINTS.USER.WISHLIST_ITEM(adId));
  }

  /**
   * Get notifications
   */
  async getNotifications(params?: { page?: number; limit?: number; type?: string; isRead?: boolean }): Promise<ApiResponse<Notification[]>> {
    return apiService.get<Notification[]>(API_ENDPOINTS.USER.NOTIFICATIONS, params);
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(): Promise<ApiResponse<{
    emailNotifications: boolean;
    pushNotifications: boolean;
  }>> {
    return apiService.get(API_ENDPOINTS.USER.NOTIFICATION_PREFERENCES);
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(preferences: {
    emailNotifications: boolean;
    pushNotifications: boolean;
  }): Promise<ApiResponse<void>> {
    return apiService.put(API_ENDPOINTS.USER.NOTIFICATION_PREFERENCES, preferences);
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string): Promise<ApiResponse<void>> {
    return apiService.put<void>(
      API_ENDPOINTS.USER.NOTIFICATION(notificationId) + '/read'
    );
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead(): Promise<ApiResponse<void>> {
    return apiService.put<void>(API_ENDPOINTS.USER.MARK_ALL_READ);
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<ApiResponse<void>> {
    return apiService.delete<void>(API_ENDPOINTS.USER.NOTIFICATION(notificationId));
  }

  /**
   * Delete user account
   */
  async deleteAccount(): Promise<ApiResponse<void>> {
    return apiService.delete<void>(API_ENDPOINTS.USER.ME);
  }
}

// Export singleton instance
export const userService = new UserService();
export default userService;
