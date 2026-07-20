"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useApiPagination, useApiSearch } from './use-api-pagination';
import type { Category, Subcategory, Attribute, PaginatedResponse, ApiResponse, CreateCategoryRequest, UpdateCategoryRequest, CreateSubcategoryRequest, UpdateSubcategoryRequest, CreateAttributeRequest, UpdateAttributeRequest } from '../lib/api-types';

const QUERY_KEYS = {
  categories: ['categories'] as const,
  category: (id: string) => ['categories', id] as const,
  subcategories: (categoryId: string) => ['categories', categoryId, 'subcategories'] as const,
  subcategory: (id: string) => ['subcategories', id] as const,
  attributes: (subcategoryId: string) => ['subcategories', subcategoryId, 'attributes'] as const,
  attribute: (id: string) => ['attributes', id] as const,
};

// Categories Management
export function useCategories(params?: {
  search?: string;
  isActive?: boolean;
}) {
  return useApiPagination({
    queryKey: params ? [...QUERY_KEYS.categories, params] : [...QUERY_KEYS.categories],
    queryFn: async (queryParams) => {
      const response = await apiClient.get<Category[]>('/admin/categories', {
        ...queryParams,
        ...params,
      });
      return response as any as PaginatedResponse<Category>;
    },
    initialParams: params,
  });
}

// Categories with search functionality
export function useCategoriesSearch(params?: {
  isActive?: boolean;
}) {
  return useApiSearch(
    [...QUERY_KEYS.categories],
    async (queryParams) => {
      const response = await apiClient.get<PaginatedResponse<Category>>('/admin/categories', {
        ...params,
        ...queryParams,
      });
      return response as PaginatedResponse<Category>;
    },
    params
  );
}

export function useCategory(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.category(id),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Category>>(`/admin/categories/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCategoryRequest) => {
      const response = await apiClient.post<ApiResponse<Category>>('/admin/categories', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categories });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCategoryRequest }) => {
      const response = await apiClient.put<ApiResponse<Category>>(`/admin/categories/${id}`, data);
      return response;
    },
    onSuccess: (response, { id }) => {
      if (response.success && response.data) {
        queryClient.setQueryData(QUERY_KEYS.category(id), response);
        queryClient.setQueryData(QUERY_KEYS.categories, (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data?.map((cat: any) => cat.id === id ? response.data : cat),
          };
        });
      }
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiResponse>(`/admin/categories/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categories });
    },
  });
}

// Subcategories Management
export function useSubcategories(categoryId: string, params?: {
  search?: string;
  isActive?: boolean;
}) {
  return useApiPagination({
    queryKey: [...QUERY_KEYS.subcategories(categoryId)],
    queryFn: async (queryParams) => {
      const response = await apiClient.get<Subcategory[]>(`/admin/categories/${categoryId}/subcategories`, {
        ...params,
        ...queryParams,
      });
      return response as any as PaginatedResponse<Subcategory>;
    },
    initialParams: params,
    enabled: !!categoryId,
  });
}

export function useSubcategory(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.subcategory(id),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Subcategory>>(`/admin/categories/subcategories/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useCreateSubcategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId, data }: { categoryId: string; data: CreateSubcategoryRequest }) => {
      const response = await apiClient.post<ApiResponse<Subcategory>>(`/admin/categories/${categoryId}/subcategories`, data);
      return response;
    },
    onSuccess: (_, { categoryId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subcategories(categoryId) });
    },
  });
}

export function useUpdateSubcategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSubcategoryRequest }) => {
      const response = await apiClient.put<ApiResponse<Subcategory>>(`/admin/categories/subcategories/${id}`, data);
      return response;
    },
    onSuccess: (response, { id }) => {
      if (response.success && response.data) {
        queryClient.setQueryData(QUERY_KEYS.subcategory(id), response);
      }
    },
  });
}

export function useDeleteSubcategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiResponse>(`/admin/categories/subcategories/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categories });
    },
  });
}

// Attributes Management
export function useAttributes(subcategoryId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.attributes(subcategoryId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Attribute[]>>(`/admin/subcategories/${subcategoryId}/attributes`);
      return response;
    },
    enabled: !!subcategoryId,
  });
}

export function useCreateAttribute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subcategoryId, data }: { subcategoryId: string; data: CreateAttributeRequest }) => {
      const response = await apiClient.post<ApiResponse<Attribute>>(`/admin/subcategories/${subcategoryId}/attributes`, data);
      return response;
    },
    onSuccess: (_, { subcategoryId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.attributes(subcategoryId) });
    },
  });
}

export function useAttribute(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.attribute(id),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Attribute>>(`/admin/attributes/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useUpdateAttribute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAttributeRequest }) => {
      const response = await apiClient.put<ApiResponse<Attribute>>(`/admin/attributes/${id}`, data);
      return response;
    },
    onSuccess: (response, { id }) => {
      if (response.success && response.data) {
        queryClient.setQueryData(QUERY_KEYS.attribute(id), response);
      }
    },
  });
}

export function useDeleteAttribute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiResponse>(`/admin/attributes/${id}`);
      return response;
    },
    onSuccess: (response, id) => {
      // We can't determine the subcategoryId from just the attribute id here
      // So we'll invalidate all attributes queries for all subcategories
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) &&
                 queryKey.length >= 3 &&
                 queryKey[0] === 'subcategories' &&
                 queryKey[2] === 'attributes';
        }
      });
    },
  });
}

// Upload category image
interface UploadedFile {
  filename: string;
  originalName: string;
  path: string;
  url: string;
  size: number;
  mimetype: string;
}

export function useUploadCategoryImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const response = await apiClient.uploadFile<UploadedFile>('/upload/image', file, 'image');
      return response;
    },
    onSuccess: () => {
      // Invalidate categories queries to refresh with new images
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categories });
    },
  });
}

export function useUploadSubcategoryImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const response = await apiClient.uploadFile<UploadedFile>('/upload/image', file, 'image');
      return response;
    },
    onSuccess: () => {
      // Invalidate subcategories queries to refresh with new images
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
    },
  });
}

export function useUploadAttributeImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const response = await apiClient.uploadFile<UploadedFile>('/upload/image', file, 'image');
      return response;
    },
    onSuccess: () => {
      // Invalidate attributes queries to refresh with new images
      queryClient.invalidateQueries({ queryKey: ['attributes'] });
    },
  });
}

// Find category by slug from all categories
export function useCategoryBySlug(slug: string) {
  return useQuery({
    queryKey: ['category-by-slug', slug],
    queryFn: async () => {
      // First try to get all categories
      const response = await apiClient.get<PaginatedResponse<Category>>('/admin/categories', { limit: 100 });
      const categories = response.data || [];

      // Find the category with matching slug
      const category = (categories as Category[]).find((cat: Category) => cat.slug === slug);

      if (!category) {
        throw new Error(`Category with slug "${slug}" not found`);
      }

      return { success: true, data: category } as ApiResponse<Category>;
    },
    enabled: !!slug,
  });
}
