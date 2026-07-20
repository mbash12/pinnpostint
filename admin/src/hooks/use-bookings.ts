import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useApiPagination } from "./use-api-pagination";
import { Booking, BookingStatus, PaginatedResponse, ApiResponse } from "@/lib/api-types";

// API response types
interface BookingsResponse extends PaginatedResponse<Booking> {}

interface BookingResponse extends ApiResponse<Booking> {}

interface UpdateBookingStatusParams {
  bookingId: string;
  status: BookingStatus;
  notes?: string;
}

// API keys
const BOOKINGS_QUERY_KEY = ['bookings'];
const BOOKING_QUERY_KEY = (id: string) => ['booking', id];

// API functions
const fetchBookings = async (params: {
    page?: number;
    limit?: number;
    status?: BookingStatus;
    search?: string;
}): Promise<BookingsResponse> => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.status) searchParams.append('status', params.status);
    if (params.search) searchParams.append('search', params.search);

    const response = await apiClient.get(`/admin/bookings?${searchParams.toString()}`);
    return response as BookingsResponse;
};

const fetchBooking = async (id: string): Promise<BookingResponse> => {
    const response = await apiClient.get(`/admin/bookings/${id}`);
    return response as BookingResponse;
};

const updateBookingStatus = async (data: UpdateBookingStatusParams): Promise<ApiResponse<Booking>> => {
    // Use the admin endpoint for updating booking status
    const response = await apiClient.put<ApiResponse<Booking>>(`/admin/bookings/${data.bookingId}`, {
        status: data.status,
        notes: data.notes
    });
    // The response.data might be the booking object or an ApiResponse<Booking> depending on API structure
    // Return the response directly to maintain the expected type
    return response as any;
};

const deleteBooking = async (id: string): Promise<ApiResponse> => {
    const response = await apiClient.delete(`/bookings/${id}`);
    return response;
};

export const useBookings = (params: {
    page?: number;
    limit?: number;
    status?: BookingStatus;
    search?: string;
} = {}) => {
  return useApiPagination({
    queryKey: [...BOOKINGS_QUERY_KEY, params],
    queryFn: () => fetchBookings(params),
    initialParams: params,
  });
};

export const useBooking = (id: string) => {
  return useQuery({
    queryKey: BOOKING_QUERY_KEY(id),
    queryFn: () => fetchBooking(id),
    enabled: !!id,
  });
};

export const useUpdateBookingStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateBookingStatus,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
      if (data?.data?.id) {
        queryClient.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(data.data.id) });
      }
    },
  });
};

export const useDeleteBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
    },
  });
};