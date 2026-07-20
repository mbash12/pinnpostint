"use client";

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  DashboardStats,
  UserAnalytics,
  AdAnalytics,
  RevenueAnalytics,
  LocationAnalytics,
  WishlistAnalytics,
  ApiResponse,
} from '@/lib/api-types';

const QUERY_KEYS = {
  dashboardStats: ['analytics', 'dashboard'] as const,
  userAnalytics: ['analytics', 'users'] as const,
  adAnalytics: ['analytics', 'ads'] as const,
  revenueAnalytics: ['analytics', 'revenue'] as const,
  locationAnalytics: ['analytics', 'locations'] as const,
  wishlistAnalytics: ['analytics', 'wishlists'] as const,
};

// Combined query to fetch all dashboard data in ONE request
export function useDashboardAllData(period: string = '30d') {
  return useQuery({
    queryKey: ['analytics', 'all', period],
    queryFn: async () => {
      // Fetch all data in parallel using Promise.all
      const [dashboardRes, adRes, revenueRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: DashboardStats }>('/admin/analytics/dashboard', { period }),
        apiClient.get<AdAnalytics>('/admin/analytics/ads', { period }),
        apiClient.get<RevenueAnalytics>('/admin/analytics/revenue', { period }),
      ]);

      return {
        dashboard: dashboardRes,
        ads: adRes,
        revenue: revenueRes,
      };
    },
    // Ensure queries run in parallel, not sequentially
    staleTime: 1000 * 30, // 30 seconds - keep data fresh but prevent rapid refetches
  });
}

// Get dashboard statistics
export function useDashboardStats(period: string = '30d') {
  return useQuery({
    queryKey: [...QUERY_KEYS.dashboardStats, period],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: DashboardStats }>('/admin/analytics/dashboard', { period });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch dashboard stats');
      }
      return response;
    },
  });
}

// Get user analytics
export function useUserAnalytics(period: string = '30d') {
  return useQuery({
    queryKey: [...QUERY_KEYS.userAnalytics, period],
    queryFn: async () => {
      const response = await apiClient.get<UserAnalytics>('/admin/analytics/users', { period });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch user analytics');
      }
      return response;
    },
  });
}

// Get ad analytics
export function useAdAnalytics(period: string = '30d') {
  return useQuery({
    queryKey: [...QUERY_KEYS.adAnalytics, period],
    queryFn: async () => {
      const response = await apiClient.get<AdAnalytics>('/admin/analytics/ads', { period });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch ad analytics');
      }
      return response;
    },
  });
}

// Get revenue analytics
export function useRevenueAnalytics(period: string = '30d') {
  return useQuery({
    queryKey: [...QUERY_KEYS.revenueAnalytics, period],
    queryFn: async () => {
      const response = await apiClient.get<RevenueAnalytics>('/admin/analytics/revenue', { period });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch revenue analytics');
      }
      return response;
    },
  });
}

// Get location analytics
export function useLocationAnalytics(period: string = '30d') {
  return useQuery({
    queryKey: [...QUERY_KEYS.locationAnalytics, period],
    queryFn: async () => {
      const response = await apiClient.get<LocationAnalytics>('/admin/analytics/locations', { period });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch location analytics');
      }
      return response;
    },
  });
}

// Get wishlist analytics
export function useWishlistAnalytics(period: string = '30d') {
  return useQuery({
    queryKey: [...QUERY_KEYS.wishlistAnalytics, period],
    queryFn: async () => {
      const response = await apiClient.get<WishlistAnalytics>('/admin/analytics/wishlists', { period });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch wishlist analytics');
      }
      return response;
    },
  });
}
