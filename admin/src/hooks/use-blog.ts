import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ApiResponse,
  PaginatedResponse,
  Blog,
  CreateBlogRequest,
  UpdateBlogRequest,
  BlogArticle,
  BlogCategory,
  CreateBlogCategoryRequest,
  UpdateBlogCategoryRequest
} from "@/lib/api-types";

// Get all blog articles
export function useBlog(params?: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: ["blogs", params],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<Blog>>("/admin/blogs", params);
      return response;
    },
  });
}

// Get single blog article
export function useBlogArticle(id: string) {
  return useQuery({
    queryKey: ["blogs", id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Blog>>(`/admin/blogs/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

// Create blog article
export function useCreateBlog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blogData: CreateBlogRequest) => {
      const { data } = await apiClient.post<ApiResponse<Blog>>("/admin/blogs", blogData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blogs"] });
    },
  });
}

// Update blog article
export function useUpdateBlog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, blogData }: { id: string; blogData: UpdateBlogRequest }) => {
      const response = await apiClient.put<ApiResponse<Blog>>(`/admin/blogs/${id}`, blogData);
      return response;
    },
    onSuccess: (response, { id }) => {
      if (response.success && response.data) {
        queryClient.setQueryData(["blogs", id], response);
        queryClient.setQueryData(["blogs"], (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data?.map((blog: any) => blog.id === id ? response.data : blog),
          };
        });
      }
    },
  });
}

// Delete blog article
export function useDeleteBlog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<null>>(`/admin/blogs/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blogs"] });
    },
  });
}

// Blog Category Hooks
// Get all blog categories
export function useBlogCategories(params?: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: ["blog-categories", params],
    queryFn: async () => {
      const fullResponse = await apiClient.get<PaginatedResponse<BlogCategory>>("/admin/blog-categories", params);
      return fullResponse;
    },
  });
}

// Get single blog category
export function useBlogCategory(id: string) {
  return useQuery({
    queryKey: ["blog-categories", id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<BlogCategory>>(`/admin/blog-categories/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

// Create blog category
export function useCreateBlogCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryData: CreateBlogCategoryRequest) => {
      const { data } = await apiClient.post<ApiResponse<BlogCategory>>("/admin/blog-categories", categoryData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-categories"] });
    },
  });
}

// Update blog category
export function useUpdateBlogCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, categoryData }: { id: string; categoryData: UpdateBlogCategoryRequest }) => {
      const response = await apiClient.put<ApiResponse<BlogCategory>>(`/admin/blog-categories/${id}`, categoryData);
      return response;
    },
    onSuccess: (response, { id }) => {
      if (response.success && response.data) {
        queryClient.setQueryData(["blog-categories", id], response);
        queryClient.setQueryData(["blog-categories"], (oldData: any) => {
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

// Delete blog category
export function useDeleteBlogCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<null>>(`/admin/blog-categories/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-categories"] });
    },
  });
}