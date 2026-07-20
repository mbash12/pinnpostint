"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  Ad,
  AdStatus,
  PaginatedResponse,
  ApiResponse,
  CreateAdRequest,
  UpdateAdRequest,
} from '@/lib/api-types';

const QUERY_KEYS = {
  ads: ['ads'] as const,
  ad: (id: string) => ['ads', id] as const,
  adStats: (id: string) => ['ads', id, 'stats'] as const,
  pendingAds: ['ads', 'pending'] as const,
  expiredAds: ['ads', 'expired'] as const,
};

import { useApiPagination, useApiSearch } from './use-api-pagination';

// Get all ads with pagination and filters
export function useAds(params?: {
  status?: AdStatus;
  search?: string;
}) {
  return useApiPagination({
    queryKey: params ? [...QUERY_KEYS.ads, params] : [...QUERY_KEYS.ads],
    queryFn: async (queryParams) => {
      const response = await apiClient.get<Ad[]>('/admin/ads', {
        ...queryParams,
        ...params,
      });
      return response as any as PaginatedResponse<Ad>;
    },
    initialParams: params,
  });
}

// Get all ads with search functionality
export function useAdsSearch(params?: {
  status?: AdStatus;
}) {
  return useApiSearch(
    [...QUERY_KEYS.ads],
    async (queryParams) => {
      const response = await apiClient.get<Ad[]>('/admin/ads', {
        ...params,
        ...queryParams,
      });
      return response as any as PaginatedResponse<Ad>;
    },
    params
  );
}

// Get pending ads for moderation with pagination
export function usePendingAds(params?: { search?: string }) {
  return useApiPagination({
    queryKey: params ? [...QUERY_KEYS.pendingAds, params] : [...QUERY_KEYS.pendingAds],
    queryFn: async (queryParams) => {
      const response = await apiClient.get<Ad[]>('/admin/ads/pending', {
        ...queryParams,
        ...params,
      });
      return response as any as PaginatedResponse<Ad>;
    },
    initialParams: params,
  });
}

// Get expired ads with pagination
export function useExpiredAds(params?: { search?: string }) {
  return useApiPagination({
    queryKey: params ? [...QUERY_KEYS.expiredAds, params] : [...QUERY_KEYS.expiredAds],
    queryFn: async (queryParams) => {
      const response = await apiClient.get<Ad[]>('/admin/ads/expired', {
        ...queryParams,
        ...params,
      });
      return response as any as PaginatedResponse<Ad>;
    },
    initialParams: params,
  });
}

// Get single ad by ID
export function useAd(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ad(id)],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Ad>>(`/admin/ads/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

// Create ad
export function useCreateAd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAdRequest) => {
      const response = await apiClient.post<ApiResponse<Ad>>('/admin/ads', data);
      return response;
    },
    onSuccess: () => {
      // Invalidate all ad queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ads });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingAds });
    },
  });
}

// Update ad
export function useUpdateAd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAdRequest }) => {
      const response = await apiClient.put<ApiResponse<Ad>>(`/admin/ads/${id}`, data);
      return response;
    },
    onSuccess: (response, { id }) => {
      // Invalidate the specific ad query to force a fresh fetch from the server
      // This ensures we get the latest data with all fields correctly set
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ad(id) });

      if (response.success && response.data) {
        // Update list caches if they exist
        queryClient.setQueryData(QUERY_KEYS.ads, (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data?.map((ad: any) => ad.id === id ? response.data : ad),
          };
        });
        queryClient.setQueryData(QUERY_KEYS.pendingAds, (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data?.map((ad: any) => ad.id === id ? response.data : ad),
          };
        });
        queryClient.setQueryData(QUERY_KEYS.expiredAds, (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data?.map((ad: any) => ad.id === id ? response.data : ad),
          };
        });
      }
    },
  });
}

// Moderate ad status (approve/reject)
export function useModerateAd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      rejectionReason,
    }: {
      id: string;
      status: 'APPROVED' | 'REJECTED';
      rejectionReason?: string;
    }) => {
      const response = await apiClient.put<ApiResponse>(`/admin/ads/${id}/status`, {
        status,
        reason: rejectionReason,
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate all ad queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ads });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingAds });
    },
  });
}

// Update ad status (for unpublish, etc.)
export function useUpdateAdStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: AdStatus;
    }) => {
      const response = await apiClient.put<ApiResponse>(`/admin/ads/${id}/status`, {
        status,
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate all ad queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ads });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingAds });
    },
  });
}

// Feature/unfeature ad
export function useToggleAdFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isFeatured }: { id: string; isFeatured: boolean }) => {
      const response = await apiClient.put<ApiResponse>(`/admin/ads/${id}/featured`, {
        isFeatured,
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate ads queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ads });
    },
  });
}

// Delete ad
export function useDeleteAd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiResponse>(`/admin/ads/${id}`);
      return response;
    },
    onSuccess: () => {
      // Invalidate all ad queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ads });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingAds });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expiredAds });
    },
  });
}

// Flag ad for review
export function useFlagAd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      flagReason,
    }: {
      id: string;
      flagReason?: string;
    }) => {
      const response = await apiClient.put<ApiResponse>(`/admin/ads/${id}/flag`, {
        flagReason,
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate all ad queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ads });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingAds });
    },
  });
}

// Get ad stats (views, favorites, shares, bookings)
export function useAdStats(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.adStats(id)],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<{ views: number; favorites: number; shares: number; bookings: number }>>(`/admin/ads/${id}/stats`);
      return response;
    },
    enabled: !!id,
  });
}
