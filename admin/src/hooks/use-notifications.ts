/**
 * Notifications Hook
 * Handles notification management for admin panel
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type NotificationType =
  | 'SUBSCRIPTION_EXPIRY'
  | 'AD_APPROVED'
  | 'AD_REJECTED'
  | 'GENERAL'
  | 'BOOKING_UPDATE'
  | 'SYSTEM'
  | 'BOOKING'
  | 'PROMOTION'
  | 'ADMIN_ALERT'
  | 'COMPLAINT';

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
}

export interface SendNotificationRequest {
  title: string;
  message: string;
  type: NotificationType;
  userId?: string;
  userIds?: string[];
  sendToAll?: boolean;
  data?: Record<string, any>;
  scheduledAt?: string;
}

export interface NotificationFilters {
  type?: NotificationType;
  isRead?: boolean;
  startDate?: string;
  endDate?: string;
  userId?: string;
}

export interface UseNotificationsOptions {
  page?: number;
  limit?: number;
  filters?: NotificationFilters;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseNotificationsResult {
  notifications: Notification[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  } | null;
  sendNotification: (request: SendNotificationRequest) => Promise<{ success: boolean; data?: any; error?: string }>;
  refreshNotifications: (skipLoadingOverlay?: boolean) => Promise<void>;
  setPage: (page: number) => void;
  setFilters: (filters: NotificationFilters) => void;
}

export const useNotifications = (options: UseNotificationsOptions = {}): UseNotificationsResult => {
  const {
    page: initialPage = 1,
    limit = 20,
    filters: initialFilters = {},
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  const [page, setPage] = useState(initialPage);
  const [filters, setFilters] = useState<NotificationFilters>(initialFilters);
  const queryClient = useQueryClient();

  const queryKey = ['notifications', page, limit, filters];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
      });
      // Always skip loading overlay for background data fetches
      const response = await apiClient.get<any>(`/admin/notifications?${params}`, {}, { skipLoading: true });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch notifications');
      }
      return {
        notifications: (response.data as Notification[]) || [],
        pagination: (response as any).pagination || null
      };
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async (request: SendNotificationRequest) => {
      const response = await apiClient.post<any>('/notifications/send', request);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to send notification');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const sendNotification = useCallback(async (request: SendNotificationRequest) => {
    try {
      const data = await sendNotificationMutation.mutateAsync(request);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [sendNotificationMutation]);

  const refreshNotifications = useCallback(async (skipLoadingOverlay = false) => {
    // If we wanted to force reload
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  return {
    notifications: data?.notifications || [],
    isLoading,
    error: error ? error.message : null,
    pagination: data?.pagination || null,
    sendNotification,
    refreshNotifications,
    setPage,
    setFilters,
  };
};

export const useNotificationStats = () => {
  return useQuery({
    queryKey: ['notifications', 'stats'],
    queryFn: async () => {
      const response = await apiClient.get<{ unread: number }>('/admin/notifications/stats', {}, { skipLoading: true });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch strict notification stats');
      }
      return response.data;
    }
  });
};

/**
 * Hook for managing user notification preferences
 */
export interface UseNotificationPreferencesResult {
  preferences: NotificationPreferences | null;
  isLoading: boolean;
  error: string | null;
  updatePreferences: (userId: string, preferences: Partial<NotificationPreferences>) => Promise<{ success: boolean; error?: string }>;
  refreshPreferences: (userId: string) => Promise<void>;
}

export const useNotificationPreferences = (): UseNotificationPreferencesResult => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get(`/admin/users/${userId}/notification-preferences`);

      if (response.success) {
        setPreferences(response.data as NotificationPreferences);
      } else {
        setError(response.error?.message || 'Failed to fetch notification preferences');
      }
    } catch (err) {
      setError('Failed to fetch notification preferences');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(async (userId: string, newPreferences: Partial<NotificationPreferences>) => {
    try {
      const response = await apiClient.put(`/admin/users/${userId}/notification-preferences`, newPreferences);

      if (response.success) {
        setPreferences(response.data as NotificationPreferences);
        return { success: true };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Failed to update notification preferences'
        };
      }
    } catch (err) {
      return {
        success: false,
        error: 'Failed to update notification preferences'
      };
    }
  }, []);

  const refreshPreferences = useCallback(async (userId: string) => {
    await fetchPreferences(userId);
  }, [fetchPreferences]);

  return {
    preferences,
    isLoading,
    error,
    updatePreferences,
    refreshPreferences,
  };
};

export default useNotifications;