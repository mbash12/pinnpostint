"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useApiPagination } from './use-api-pagination';
import type { State, City, PostalCode, PaginatedResponse, CreateStateRequest, UpdateStateRequest, CreateCityRequest, UpdateCityRequest, CreatePostalCodeRequest, UpdatePostalCodeRequest } from '../lib/api-types';

const QUERY_KEYS = {
  states: ['states'] as const,
  state: (id: string) => ['states', id] as const,
  cities: ['cities'] as const,
  city: (id: string) => ['cities', id] as const,
  postalCodes: ['postal-codes'] as const,
  postalCode: (id: string) => ['postal-codes', id] as const,
};

// States
export function useStates(params?: { page?: number; limit?: number; search?: string; isActive?: boolean }) {
  return useApiPagination({
    queryKey: params ? [...QUERY_KEYS.states, params] : [...QUERY_KEYS.states],
    queryFn: async (queryParams) => {
      const response = await apiClient.get<State[]>('/admin/granular-locations/states', {
        ...queryParams,
        ...params,
      });
      return response as any as PaginatedResponse<State>;
    },
    initialParams: params,
  });
}

export function useDeleteState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/granular-locations/states/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.states });
    },
  });
}


// Cities
export function useCities(params?: { page?: number; limit?: number; search?: string; stateId?: string; isActive?: boolean }) {
  return useApiPagination({
    queryKey: params ? [...QUERY_KEYS.cities, params] : [...QUERY_KEYS.cities],
    queryFn: async (queryParams) => {
      const response = await apiClient.get<City[]>('/admin/granular-locations/cities', {
        ...queryParams,
        ...params,
      });
      return response as any as PaginatedResponse<City>;
    },
    initialParams: params,
  });
}

export function useDeleteCity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/granular-locations/cities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cities });
    },
  });
}

// Postal Codes
export function usePostalCodes(params?: { page?: number; limit?: number; search?: string; cityId?: string; isActive?: boolean }) {
  return useApiPagination({
    queryKey: params ? [...QUERY_KEYS.postalCodes, params] : [...QUERY_KEYS.postalCodes],
    queryFn: async (queryParams) => {
      const response = await apiClient.get<PostalCode[]>('/admin/granular-locations/postal-codes', {
        ...queryParams,
        ...params,
      });
      return response as any as PaginatedResponse<PostalCode>;
    },
    initialParams: params,
  });
}

export function useDeletePostalCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/granular-locations/postal-codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.postalCodes });
    },
  });
}
