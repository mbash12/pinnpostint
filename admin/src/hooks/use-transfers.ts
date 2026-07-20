import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useApiPagination } from "./use-api-pagination";
import { Transfer, TransferStatus, TransferType, PaginatedResponse, ApiResponse } from "@/lib/api-types";

// API response types
interface TransfersResponse extends PaginatedResponse<Transfer> {}

interface TransferResponse extends ApiResponse<Transfer> {}

interface UpdateTransferStatusParams {
  transferId: string;
  data: {
    status: 'COMPLETED' | 'CANCELLED';
    notes?: string;
  };
}

interface CreateTransferParams {
  fromUserId?: string;
  toUserId?: string;
  transactionId?: string;
  bookingId?: string;
  subscriptionId?: string;
  adId?: string;
  amount: number;
  currency?: string;
  transferType: TransferType;
  description?: string;
  notes?: string;
}

// API keys
const TRANSFERS_QUERY_KEY = ['transfers'];
const TRANSFER_QUERY_KEY = (id: string) => ['transfer', id];

// API functions
const fetchTransfers = async (params: {
  page?: number;
  limit?: number;
  status?: TransferStatus;
  type?: TransferType;
  search?: string;
  startDate?: string;
  endDate?: string;
}): Promise<TransfersResponse> => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.status) searchParams.append('status', params.status);
  if (params.type) searchParams.append('type', params.type);
  if (params.search) searchParams.append('search', params.search);
  if (params.startDate) searchParams.append('startDate', params.startDate);
  if (params.endDate) searchParams.append('endDate', params.endDate);

  const response = await apiClient.get<any>(`/admin/transfers?${searchParams.toString()}`);
  return response as any;
};

const fetchTransfer = async (id: string): Promise<TransferResponse> => {
  const response = await apiClient.get<any>(`/admin/transfers/${id}`);
  return response as any;
};

const createTransfer = async (data: CreateTransferParams): Promise<TransferResponse> => {
  const response = await apiClient.post<any>('/admin/transfers', data);
  return response as any;
};

const updateTransferStatus = async (params: UpdateTransferStatusParams): Promise<TransferResponse> => {
  const response = await apiClient.put<any>(
    `/admin/transfers/${params.transferId}/status`,
    params.data
  );
  return response as any;
};

const deleteTransfer = async (id: string): Promise<ApiResponse<void>> => {
  const response = await apiClient.delete<any>(`/admin/transfers/${id}`);
  return response as any;
};

export const useTransfers = (params: {
  page?: number;
  limit?: number;
  status?: TransferStatus;
  type?: TransferType;
  search?: string;
  startDate?: string;
  endDate?: string;
} = {}) => {
  return useApiPagination({
    queryKey: [...TRANSFERS_QUERY_KEY, params],
    queryFn: () => fetchTransfers(params),
    initialParams: params,
  });
};

export const useTransfer = (id: string) => {
  return useQuery({
    queryKey: TRANSFER_QUERY_KEY(id),
    queryFn: () => fetchTransfer(id),
    enabled: !!id,
  });
};

export const useCreateTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSFERS_QUERY_KEY });
    },
  });
};

export const useUpdateTransferStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTransferStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSFERS_QUERY_KEY });
    },
  });
};

export const useDeleteTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSFERS_QUERY_KEY });
    },
  });
};
