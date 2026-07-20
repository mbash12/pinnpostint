"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { PlatformAd, ApiResponse, CreatePlatformAdRequest, UpdatePlatformAdRequest } from '../lib/api-types';

const QUERY_KEYS = {
  platformAds: ['platform-ads'] as const,
  platformAd: (id: string) => ['platform-ads', id] as const,
};

export function usePlatformAds() {
  return useQuery({
    queryKey: QUERY_KEYS.platformAds,
    queryFn: async () => {
      const response = await apiClient.get<PlatformAd[]>('/admin/platform-ads');
      return response.data || [];
    },
  });
}

export function usePlatformAd(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.platformAd(id),
    queryFn: async () => {
      const response = await apiClient.get<PlatformAd>(`/admin/platform-ads/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useCreatePlatformAd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePlatformAdRequest) => {
      const response = await apiClient.post<ApiResponse<PlatformAd>>('/admin/platform-ads', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.platformAds });
    },
  });
}

export function useUpdatePlatformAd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePlatformAdRequest }) => {
      const response = await apiClient.put<ApiResponse<PlatformAd>>(`/admin/platform-ads/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.platformAds });
    },
  });
}

export function useDeletePlatformAd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiResponse>(`/admin/platform-ads/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.platformAds });
    },
  });
}
