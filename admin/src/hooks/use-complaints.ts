import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useApiPagination } from "./use-api-pagination";
import { Complaint, ComplaintStatus, PaginatedResponse, ApiResponse } from "@/lib/api-types";

// API response types
interface ComplaintsResponse extends PaginatedResponse<Complaint> {}

interface ComplaintResponse extends ApiResponse<Complaint> {}

interface UpdateComplaintStatusParams {
  complaintId: string;
  data: {
    status: ComplaintStatus;
    resolutionNote?: string;
  };
}

// API keys
const COMPLAINTS_QUERY_KEY = ['complaints'];
const COMPLAINT_QUERY_KEY = (id: string) => ['complaint', id];

// API functions
const fetchComplaints = async (params: {
    page?: number;
    limit?: number;
    status?: ComplaintStatus;
}): Promise<ComplaintsResponse> => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.status) searchParams.append('status', params.status);

    // apiClient.get returns the data directly when it has a 'success' property
    const response = await apiClient.get<any>(`/admin/complaints?${searchParams.toString()}`);
    // The API returns { success, data, pagination } which is already a PaginatedResponse
    return response as any;
};

const fetchComplaint = async (id: string): Promise<ComplaintResponse> => {
    const response = await apiClient.get<any>(`/admin/complaints/${id}`);
    return response as any;
};

const updateComplaintStatus = async (params: UpdateComplaintStatusParams): Promise<ComplaintResponse> => {
    const response = await apiClient.put<any>(
        `/admin/complaints/${params.complaintId}/status`,
        params.data
    );
    return response as any;
};

export const useComplaints = (params: {
    page?: number;
    limit?: number;
    status?: ComplaintStatus;
} = {}) => {
  return useApiPagination({
    queryKey: [...COMPLAINTS_QUERY_KEY, params],
    queryFn: () => fetchComplaints(params),
    initialParams: params,
  });
};

export const useComplaint = (id: string) => {
  return useQuery({
    queryKey: COMPLAINT_QUERY_KEY(id),
    queryFn: () => fetchComplaint(id),
    enabled: !!id,
  });
};

export const useUpdateComplaintStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateComplaintStatus,
    onSuccess: () => {
      // Invalidate and refetch complaints
      queryClient.invalidateQueries({ queryKey: COMPLAINTS_QUERY_KEY });
    },
  });
};
