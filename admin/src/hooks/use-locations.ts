"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  Location,
  State,
  City,
  PostalCode,
  PaginatedResponse,
  ApiResponse,
  CreateLocationRequest,
  UpdateLocationRequest,
  CreateStateRequest,
  UpdateStateRequest,
  CreateCityRequest,
  UpdateCityRequest,
  CreatePostalCodeRequest,
  UpdatePostalCodeRequest,
} from '@/lib/api-types';

const QUERY_KEYS = {
  locations: ['locations'] as const,
  location: (id: string) => ['locations', id] as const,
  states: ['states'] as const,
  state: (id: string) => ['states', id] as const,
  cities: ['cities'] as const,
  city: (id: string) => ['cities', id] as const,
  postalCodes: ['postalCodes'] as const,
  postalCode: (id: string) => ['postalCodes', id] as const,
};

// ========== STATES MANAGEMENT ==========
export function useStates(params?: {
  page?: number;
  limit?: number;
  search?: string;
  country?: string;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.states, params],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<State>>('/admin/locations/states', params);
      return response;
    },
  });
}

export function useState(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.state(id),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<State>>(`/admin/locations/states/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useCreateState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateStateRequest) => {
      const response = await apiClient.post<ApiResponse<State>>('/admin/locations/states', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.states });
    },
  });
}

export function useUpdateState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateStateRequest }) => {
      const response = await apiClient.put<ApiResponse<State>>(`/admin/locations/states/${id}`, data);
      return response;
    },
    onSuccess: (response, { id, data }) => {
      if (response.success && response.data) {
        queryClient.setQueryData(QUERY_KEYS.state(id), response);
        queryClient.setQueryData(QUERY_KEYS.states, (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data?.map((state: any) => state.id === id ? response.data : state),
          };
        });
      }
    },
  });
}

export function useDeleteState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiResponse>(`/admin/locations/states/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.states });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cities });
    },
  });
}


// ========== CITIES MANAGEMENT ==========
export function useCities(params?: {
  page?: number;
  limit?: number;
  search?: string;
  stateId?: string;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.cities, params],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<City>>('/admin/locations/cities', params);
      return response;
    },
  });
}

export function useCity(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.city(id),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<City>>(`/admin/locations/cities/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useCreateCity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCityRequest) => {
      const response = await apiClient.post<ApiResponse<City>>('/admin/locations/cities', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cities });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.postalCodes });
    },
  });
}

export function useUpdateCity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCityRequest }) => {
      const response = await apiClient.put<ApiResponse<City>>(`/admin/locations/cities/${id}`, data);
      return response;
    },
    onSuccess: (response, { id }) => {
      if (response.success && response.data) {
        queryClient.setQueryData(QUERY_KEYS.city(id), response);
        queryClient.setQueryData(QUERY_KEYS.cities, (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data?.map((city: any) => city.id === id ? response.data : city),
          };
        });
        queryClient.setQueryData(QUERY_KEYS.postalCodes, (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data?.map((pc: any) => pc.cityId === id ? { ...pc, city: response.data } : pc),
          };
        });
      }
    },
  });
}

export function useDeleteCity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiResponse>(`/admin/locations/cities/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cities });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.postalCodes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.locations });
    },
  });
}

// ========== POSTAL CODES MANAGEMENT ==========
export function usePostalCodes(params?: {
  page?: number;
  limit?: number;
  search?: string;
  code?: string;
  cityId?: string;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.postalCodes, params],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<PostalCode>>('/admin/locations/postal-codes', params);
      return response;
    },
  });
}

export function usePostalCode(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.postalCode(id),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PostalCode>>(`/admin/locations/postal-codes/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useCreatePostalCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePostalCodeRequest) => {
      const response = await apiClient.post<ApiResponse<PostalCode>>('/admin/locations/postal-codes', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.postalCodes });
    },
  });
}

export function useUpdatePostalCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePostalCodeRequest }) => {
      const response = await apiClient.put<ApiResponse<PostalCode>>(`/admin/locations/postal-codes/${id}`, data);
      return response;
    },
    onSuccess: (response, { id }) => {
      if (response.success && response.data) {
        queryClient.setQueryData(QUERY_KEYS.postalCode(id), response);
        queryClient.setQueryData(QUERY_KEYS.postalCodes, (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data?.map((pc: any) => pc.id === id ? response.data : pc),
          };
        });
      }
    },
  });
}

export function useDeletePostalCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiResponse>(`/admin/locations/postal-codes/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.postalCodes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.locations });
    },
  });
}

// ========== LOCATIONS MANAGEMENT ==========
export function useLocations(params?: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  stateId?: string;
  cityId?: string;
  postalCodeId?: string;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.locations, params],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<Location>>('/admin/locations', params);
      return response;
    },
  });
}

export function useLocation(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.location(id),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Location>>(`/admin/locations/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLocationRequest) => {
      const response = await apiClient.post<ApiResponse<Location>>('/admin/locations', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.locations });
    },
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateLocationRequest }) => {
      const response = await apiClient.put<ApiResponse<Location>>(`/admin/locations/${id}`, data);
      return response;
    },
    onSuccess: (response, { id }) => {
      if (response.success && response.data) {
        queryClient.setQueryData(QUERY_KEYS.location(id), response);
        queryClient.setQueryData(QUERY_KEYS.locations, (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data?.map((location: any) => location.id === id ? response.data : location),
          };
        });
      }
    },
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiResponse>(`/admin/locations/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.locations });
    },
  });
}


