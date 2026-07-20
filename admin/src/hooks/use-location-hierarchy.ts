import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { State, City, PostalCode } from "@/lib/api-types";

interface PaginatedResponse<T> {
    data: T[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// States
export function useStates() {
    return useQuery({
        queryKey: ["states"],
        queryFn: async () => {
            const response = await apiClient.get<PaginatedResponse<State>>("/admin/granular-locations/states", { limit: 100 });
            return response;
        },
    });
}

// Cities
export function useCities(stateId?: string) {
    return useQuery({
        queryKey: ["cities", stateId],
        queryFn: async () => {
            const params: any = { limit: 100 };
            if (stateId) params.stateId = stateId;
            const response = await apiClient.get<PaginatedResponse<City>>("/admin/granular-locations/cities", params);
            return response;
        },
        enabled: !!stateId,
    });
}

// Postal Codes
export function usePostalCodes(cityId?: string) {
    return useQuery({
        queryKey: ["postal-codes", cityId],
        queryFn: async () => {
            const params = cityId ? { cityId, limit: 100 } : { limit: 100 };
            const response = await apiClient.get<PaginatedResponse<PostalCode>>("/admin/granular-locations/postal-codes", params);
            return response;
        },
        enabled: !!cityId,
    });
}

// Search functions for SearchableSelect
export async function searchStates(query: string): Promise<State[]> {
    const params: any = { limit: 100 };
    if (query) params.search = query;
    const response = await apiClient.get<any>("/admin/granular-locations/states", params, { skipLoading: true });
    // The API returns a PaginatedResponse structure: { success, data: [...], pagination, message, error }
    return response.data || [];
}

export async function searchCities(query: string, stateId?: string): Promise<City[]> {
    const params: any = { limit: 100 };
    if (query) params.search = query;
    if (stateId) params.stateId = stateId;
    const response = await apiClient.get<any>("/admin/granular-locations/cities", params, { skipLoading: true });
    return response.data || [];
}

export async function searchPostalCodes(query: string, cityId?: string): Promise<PostalCode[]> {
    const params: any = { limit: 100 };
    if (query) params.search = query;
    if (cityId) params.cityId = cityId;
    const response = await apiClient.get<any>("/admin/granular-locations/postal-codes", params, { skipLoading: true });
    return response.data || [];
}
