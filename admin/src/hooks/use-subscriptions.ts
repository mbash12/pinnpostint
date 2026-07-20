import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiResponse, PaginatedResponse, Subscription } from '@/lib/api-types';
import { apiClient } from '@/lib/api-client';

// API response types
interface SubscriptionsResponse extends PaginatedResponse<Subscription & {
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
    };
    ad?: {
        id: string;
        title: string;
        price: number;
        status: string;
    };
}> {}

interface SubscriptionResponse extends ApiResponse<Subscription & {
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
    };
    ad?: {
        id: string;
        title: string;
        price: number;
        status: string;
    };
}> {}

// API keys
const SUBSCRIPTIONS_QUERY_KEY = ['subscriptions'];
const SUBSCRIPTION_QUERY_KEY = (id: string) => ['subscription', id];

// API functions
const fetchSubscriptions = async (params: {
    page?: number;
    limit?: number;
    status?: 'active' | 'inactive' | 'all';
    search?: string;
}): Promise<SubscriptionsResponse> => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.status && params.status !== 'all') searchParams.append('status', params.status);
    if (params.search) searchParams.append('search', params.search);

    const response = await apiClient.get(`/admin/subscriptions?${searchParams.toString()}`);
    return response as SubscriptionsResponse;
};

const fetchSubscription = async (id: string): Promise<SubscriptionResponse> => {
    const response = await apiClient.get(`/admin/subscriptions/${id}`);
    return response as SubscriptionResponse;
};

const extendSubscription = async (data: {
    id: string;
    days: number;
}): Promise<ApiResponse<Subscription>> => {
    const response = await apiClient.post<ApiResponse<Subscription>>(`/admin/subscriptions/${data.id}/extend`, {
        days: data.days
    });
    return response as any;
};

const cancelSubscription = async (id: string): Promise<ApiResponse<Subscription>> => {
    const response = await apiClient.post<ApiResponse<Subscription>>(`/admin/subscriptions/${id}/cancel`);
    return response as any;
};

const reactivateSubscription = async (id: string): Promise<ApiResponse<Subscription>> => {
    const response = await apiClient.post<ApiResponse<Subscription>>(`/admin/subscriptions/${id}/reactivate`);
    return response as any;
};

// Hooks
export const useSubscriptions = (params: {
    page?: number;
    limit?: number;
    status?: 'active' | 'inactive' | 'all';
    search?: string;
} = {}) => {
    return useQuery({
        queryKey: [...SUBSCRIPTIONS_QUERY_KEY, params],
        queryFn: () => fetchSubscriptions(params),
    });
};

export const useSubscription = (id: string) => {
    return useQuery({
        queryKey: SUBSCRIPTION_QUERY_KEY(id),
        queryFn: () => fetchSubscription(id),
        enabled: !!id,
    });
};

export const useExtendSubscription = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: extendSubscription,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
            if (data?.data?.id) {
                queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY(data.data.id) });
            }
        },
    });
};

export const useCancelSubscription = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: cancelSubscription,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
            if (data?.data?.id) {
                queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY(data.data.id) });
            }
        },
    });
};

export const useReactivateSubscription = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: reactivateSubscription,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
            if (data?.data?.id) {
                queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY(data.data.id) });
            }
        },
    });
};