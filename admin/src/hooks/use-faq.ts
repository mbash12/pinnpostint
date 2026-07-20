import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, PaginatedResponse } from "@/lib/api-types";
import { CreateFAQCategoryRequest, CreateFAQRequest, FAQ, FAQCategory, UpdateFAQCategoryRequest, UpdateFAQRequest } from "@/lib/api-types-faq";
import { useApiPagination } from "./use-api-pagination";

// FAQ Hooks
export function useFAQs(params?: { page?: number; limit?: number; isActive?: boolean; search?: string; categoryId?: string }) {
    return useApiPagination({
        queryKey: params ? ["faqs", params] : ["faqs"],
        queryFn: async (queryParams) => {
            const response = await apiClient.get<FAQ[]>("/admin/faqs", {
                ...queryParams,
                ...params,
            });
            return response as any as PaginatedResponse<FAQ>;
        },
        initialParams: params,
    });
}

export function useFAQ(id: string) {
    return useQuery({
        queryKey: ["faqs", id],
        queryFn: async () => {
            const response = await apiClient.get<ApiResponse<FAQ>>(`/admin/faqs/${id}`);
            return response;
        },
        enabled: !!id,
    });
}

export function useCreateFAQ() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (faqData: CreateFAQRequest) => {
            const response = await apiClient.post<ApiResponse<FAQ>>("/admin/faqs", faqData);
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["faqs"] });
        },
    });
}

export function useUpdateFAQ() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, faqData }: { id: string; faqData: UpdateFAQRequest }) => {
            const response = await apiClient.put<ApiResponse<FAQ>>(`/admin/faqs/${id}`, faqData);
            return response;
        },
        onSuccess: (response, { id }) => {
            if (response.success && response.data) {
                queryClient.setQueryData(["faqs", id], response);
                queryClient.setQueryData(["faqs"], (oldData: any) => {
                    if (!oldData) return oldData;
                    return {
                        ...oldData,
                        data: oldData.data?.map((faq: any) => faq.id === id ? response.data : faq),
                    };
                });
            }
        },
    });
}

export function useDeleteFAQ() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await apiClient.delete<ApiResponse<null>>(`/admin/faqs/${id}`);
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["faqs"] });
        },
    });
}

// FAQ Category Hooks
export function useFAQCategories(params?: { page?: number; limit?: number; isActive?: boolean; search?: string }) {
    return useApiPagination({
        queryKey: params ? ["faq-categories", params] : ["faq-categories"],
        queryFn: async (queryParams) => {
            const response = await apiClient.get<FAQCategory[]>("/admin/faq-categories", {
                ...queryParams,
                ...params,
            });
            return response as any as PaginatedResponse<FAQCategory>;
        },
        initialParams: params,
    });
}

export function useFAQCategory(id: string) {
    return useQuery({
        queryKey: ["faq-categories", id],
        queryFn: async () => {
            const response = await apiClient.get<ApiResponse<FAQCategory>>(`/admin/faq-categories/${id}`);
            return response.data;
        },
        enabled: !!id,
    });
}

export function useCreateFAQCategory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (categoryData: CreateFAQCategoryRequest) => {
            const response = await apiClient.post<ApiResponse<FAQCategory>>("/admin/faq-categories", categoryData);
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["faq-categories"] });
        },
    });
}

export function useUpdateFAQCategory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, categoryData }: { id: string; categoryData: UpdateFAQCategoryRequest }) => {
            const response = await apiClient.put<ApiResponse<FAQCategory>>(`/admin/faq-categories/${id}`, categoryData);
            return response;
        },
        onSuccess: (response, { id }) => {
            if (response.success && response.data) {
                queryClient.setQueryData(["faq-categories", id], response);
                queryClient.setQueryData(["faq-categories"], (oldData: any) => {
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

export function useDeleteFAQCategory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await apiClient.delete<ApiResponse<null>>(`/admin/faq-categories/${id}`);
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["faq-categories"] });
        },
    });
}
