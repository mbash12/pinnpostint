import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiResponse, PaginatedResponse } from '@/lib/api-client';
import { apiClient } from '@/lib/api-client';

export interface Transaction {
    id: string;
    amount: string | number;
    currency: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
    paymentProvider: 'RAZORPAY';
    paymentMethod?: string;
    paymentIntentId: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        email?: string;
        phone: string;
    };
    subscription?: {
        id: string;
        startDate: string;
        endDate: string;
        ad: {
            id: string;
            title: string;
            price: number;
        };
    };
}

// API response types
interface TransactionsResponse extends PaginatedResponse<Transaction> { }

interface TransactionResponse extends ApiResponse<Transaction> { }

// API keys
const TRANSACTIONS_QUERY_KEY = ['transactions'];
const TRANSACTION_QUERY_KEY = (id: string) => ['transaction', id];

// API functions
const fetchTransactions = async (params: {
    page?: number;
    limit?: number;
    status?: string;
    paymentProvider?: string;
    search?: string;
}): Promise<TransactionsResponse> => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.status) searchParams.append('status', params.status);
    if (params.paymentProvider) searchParams.append('paymentProvider', params.paymentProvider);
    if (params.search) searchParams.append('search', params.search);

    const response = await apiClient.get(`/admin/transactions?${searchParams.toString()}`);
    return response as TransactionsResponse;
};

const fetchTransaction = async (id: string): Promise<TransactionResponse> => {
    const response = await apiClient.get(`/admin/transactions/${id}`);
    return response as TransactionResponse;
};

const refundTransaction = async (data: {
    id: string;
    reason: string;
    amount: number;
}): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.post<ApiResponse<Transaction>>(`/admin/transactions/${data.id}/refund`, {
        reason: data.reason,
        amount: data.amount
    });
    return response as any;
};

// Hooks
export const useTransactions = (params: {
    page?: number;
    limit?: number;
    status?: string;
    paymentProvider?: string;
    search?: string;
} = {}) => {
    return useQuery({
        queryKey: [...TRANSACTIONS_QUERY_KEY, params],
        queryFn: () => fetchTransactions(params),
    });
};

export const useTransaction = (id: string) => {
    return useQuery({
        queryKey: TRANSACTION_QUERY_KEY(id),
        queryFn: () => fetchTransaction(id),
        enabled: !!id,
    });
};

export const useRefundTransaction = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: refundTransaction,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
            if (data?.data?.id) {
                queryClient.invalidateQueries({ queryKey: TRANSACTION_QUERY_KEY(data.data.id) });
            }
        },
    });
};