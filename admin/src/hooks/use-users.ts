"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useApiPagination, useApiSearch } from './use-api-pagination';
import type {
  User,
  UserRole,
  PaginatedResponse,
  ApiResponse,
  UpdateUserRequest,
  CreateUserRequest,
} from '@/lib/api-types';

const QUERY_KEYS = {
  users: ['users'] as const,
  user: (id: string) => ['users', id] as const,
  profile: ['users', 'profile'] as const,
};

// Get all users with pagination and filters
export function useUsers(params?: {
  search?: string;
  isActive?: boolean;
  role?: UserRole;
}) {
  return useApiPagination({
    queryKey: params ? [...QUERY_KEYS.users, params] : [...QUERY_KEYS.users],
    queryFn: async (queryParams) => {
      const response = await apiClient.get<User[]>('/admin/users', {
        ...queryParams,
        ...params,
      });
      return response as any as PaginatedResponse<User>;
    },
    initialParams: params,
  });
}

// Get all users with search functionality
export function useUsersSearch(params?: {
  isActive?: boolean;
  role?: UserRole;
}) {
  return useApiSearch(
    params ? [...QUERY_KEYS.users, params] : [...QUERY_KEYS.users],
    async (queryParams) => {
      const response = await apiClient.get<User[]>('/admin/users', {
        ...params,
        ...queryParams,
      });
      return response as any as PaginatedResponse<User>;
    },
    params
  );
}

// Get single user by ID
export function useUser(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.user(id),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<User>>(`/admin/users/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

// Get current admin profile
export function useProfile() {
  return useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<User>>('/admin/profile');
      return response;
    },
  });
}

// Update user
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserRequest }) => {
      const response = await apiClient.put<ApiResponse<User>>(`/admin/users/${id}`, data);
      return response;
    },
    onSuccess: (response, { id }) => {
      if (response.success && response.data) {
        // Update the cache directly instead of invalidating to avoid extra API calls
        queryClient.setQueryData(QUERY_KEYS.user(id), response);
        // Update the list cache if it exists
        queryClient.setQueryData(QUERY_KEYS.users, (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data?.map((user: any) => user.id === id ? response.data : user),
          };
        });
      }
    },
  });
}

// Update user active status
export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiClient.put<ApiResponse>(`/admin/users/${id}/active`, {
        isActive,
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate users queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users });
    },
  });
}

// Update user role
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const response = await apiClient.put<ApiResponse>(`/admin/users/${id}/role`, {
        role,
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate users queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users });
    },
  });
}

// Update user verification status
export function useUpdateUserVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isVerified }: { id: string; isVerified: boolean }) => {
      const response = await apiClient.put<ApiResponse>(`/admin/users/${id}/verification`, {
        isVerified,
      });
      return response;
    },
    onSuccess: (response, { id, isVerified }) => {
      // Update the cache directly to avoid extra API calls
      queryClient.setQueryData(QUERY_KEYS.user(id), (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          data: {
            ...oldData.data,
            isVerified,
          },
        };
      });
      // Update the list cache if it exists
      queryClient.setQueryData(QUERY_KEYS.users, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          data: oldData.data?.map((user: any) => user.id === id ? { ...user, isVerified } : user),
        };
      });
    },
  });
}

// Update current admin profile
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateUserRequest) => {
      const response = await apiClient.put<ApiResponse<User>>('/admin/profile', data);
      return response;
    },
    onSuccess: () => {
      // Invalidate profile query
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    },
  });
}

// Create user
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: CreateUserRequest) => {
      // Don't send role in user creation - backend doesn't accept it
      const { role, ...userDataWithoutRole } = userData;
      const response = await apiClient.post<User>('/admin/users', userDataWithoutRole);
      
      // If role is ADMIN and user was created successfully, promote them
      if (role === 'ADMIN' && response.success && response.data && response.data.id) {
        await apiClient.put(`/admin/users/${response.data.id}/role`, { role });
      }
      
      return response;
    },
    onSuccess: () => {
      // Invalidate users queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users });
    },
  });
}

// Delete user
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiResponse>(`/admin/users/${id}`);
      return response;
    },
    onSuccess: () => {
      // Invalidate users queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users });
    },
  });
}

// Upload avatar
interface UploadedFile {
  filename: string;
  originalName: string;
  path: string;
  url: string;
  size: number;
  mimetype: string;
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const response = await apiClient.uploadFile<UploadedFile>('/upload/image', file, 'image');
      return response;
    },
    onSuccess: () => {
      // Invalidate profile query to refresh with new avatar
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    },
  });
}
