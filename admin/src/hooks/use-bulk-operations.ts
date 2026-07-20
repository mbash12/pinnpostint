"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-types';

// Get user count based on criteria for bulk notifications
export function useGetUserCountByCriteria(params: {
  role?: 'user' | 'admin';
  isVerified?: boolean;
  locationId?: number;
  hasActiveAds?: boolean;
} = {}) {
  return useQuery({
    queryKey: ['user-count-by-criteria', params],
    queryFn: async () => {
      const response = await apiClient.getUserCountByCriteria(params);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch user count');
      }
      return response.data?.count || 0;
    },
  });
}

// Bulk update ad status
export function useBulkUpdateAdStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      adIds,
      status,
    }: {
      adIds: string[];
      status: 'pending' | 'approved' | 'rejected' | 'active' | 'inactive';
    }) => {
      const response = await apiClient.put<ApiResponse>('/admin/bulk-operations/ads/status', {
        adIds,
        status,
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate all ad queries
      queryClient.invalidateQueries({ queryKey: ['ads'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

// Send bulk notifications (announcements: in-app + queued push / email / SMS per system settings)
export function useSendBulkNotifications() {
  return useMutation({
    mutationFn: async ({
      criteria,
      notification,
      channels,
    }: {
      criteria: {
        isVerified?: boolean;
        locationId?: number;
        hasActiveAds?: boolean;
      };
      notification: {
        title: string;
        message: string;
        type: string;
        data?: { deepLink?: string; url?: string };
      };
      channels?: ('push' | 'email')[];
    }) => {
      const response = await apiClient.post<ApiResponse<{
        sentCount: number;
        channelsQueued?: ('push' | 'email' | 'sms')[];
      }>>('/admin/bulk-operations/users/notifications', {
        criteria,
        notification,
        ...(channels?.length ? { channels } : {}),
      });
      return response;
    },
  });
}

// Cleanup expired content
export function useCleanupExpired() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiResponse>('/admin/bulk-operations/cleanup/expired');
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

// Cleanup old notifications
export function useCleanupNotifications() {
  return useMutation({
    mutationFn: async ({ olderThanDays }: { olderThanDays: number }) => {
      const response = await apiClient.post<ApiResponse>('/admin/bulk-operations/notifications/cleanup', {
        olderThanDays,
      });
      return response;
    },
  });
}

// Bulk renew expired ads
export function useBulkRenewAds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      adIds,
      days,
    }: {
      adIds: string[];
      days: number;
    }) => {
      // This endpoint might need to be added to the backend
      const response = await apiClient.post<ApiResponse>('/admin/bulk-operations/ads/renew', {
        adIds,
        days,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

// Bulk archive ads
export function useBulkArchiveAds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ adIds }: { adIds: string[] }) => {
      // This endpoint might need to be added to the backend
      const response = await apiClient.post<ApiResponse>('/admin/bulk-operations/ads/archive', {
        adIds,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

// Bulk delete ads
export function useBulkDeleteAds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ adIds }: { adIds: string[] }) => {
      // This endpoint might need to be added to the backend
      const response = await apiClient.post<ApiResponse>('/admin/bulk-operations/ads/delete', {
        adIds,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
