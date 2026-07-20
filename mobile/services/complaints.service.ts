/**
 * Complaints Service
 * Handles all complaint-related API calls
 */

import { apiService, ApiResponse } from './api.service';

export interface ComplaintMessage {
  id: string;
  complaintId: string;
  senderId: string;
  senderType: 'REPORTER' | 'RESPONDENT' | 'ADMIN';
  message: string;
  createdAt: string;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface Complaint {
  id: string;
  bookingId: string;
  reporterId: string;
  respondentId: string;
  description: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED';
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
  };
  booking: {
    id: string;
    startDate: string;
    endDate: string;
    ad: {
      id: string;
      title: string;
    };
  };
  reporter: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
  };
  respondent?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
  };
  adminResolver?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  messages?: ComplaintMessage[];
}

export interface CreateComplaintRequest {
  bookingId: string;
  description: string;
}

export interface UpdateComplaintStatusRequest {
  status: 'INVESTIGATING' | 'RESOLVED' | 'REJECTED';
  resolutionNote?: string;
}

export interface ComplaintListResponse {
  success: boolean;
  data: Complaint[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

class ComplaintsService {
  /**
   * File a complaint against a booking
   */
  async createComplaint(data: CreateComplaintRequest): Promise<ApiResponse<Complaint>> {
    return apiService.post<Complaint>(`/bookings/${data.bookingId}/complaint`, {
      description: data.description,
    });
  }

  /**
   * Get complaints received against my bookings (for sellers)
   */
  async getReceivedComplaints(params?: { page?: number; limit?: number; status?: string }): Promise<ComplaintListResponse> {
    return apiService.get<Complaint[]>('/complaints/received', params) as Promise<ComplaintListResponse>;
  }

  /**
   * Get all complaints (admin only)
   */
  async getAllComplaints(params?: { page?: number; limit?: number; status?: string }): Promise<ComplaintListResponse> {
    return apiService.get<Complaint[]>('/admin/complaints', params) as Promise<ComplaintListResponse>;
  }

  /**
   * Get complaint details (admin only)
   */
  async getComplaintById(complaintId: string): Promise<ApiResponse<Complaint>> {
    return apiService.get<Complaint>(`/admin/complaints/${complaintId}`);
  }

  /**
   * Update complaint status (admin only)
   */
  async updateComplaintStatus(
    complaintId: string,
    data: UpdateComplaintStatusRequest
  ): Promise<ApiResponse<Complaint>> {
    return apiService.put<Complaint>(`/admin/complaints/${complaintId}/status`, data);
  }

  /**
   * Send a message in the complaint thread
   */
  async sendMessage(complaintId: string, message: string): Promise<ApiResponse<ComplaintMessage>> {
    return apiService.post<ComplaintMessage>(`/complaints/${complaintId}/messages`, {
      message,
    });
  }

  /**
   * Get messages for a complaint
   */
  async getComplaintMessages(complaintId: string): Promise<ApiResponse<ComplaintMessage[]>> {
    return apiService.get<ComplaintMessage[]>(`/complaints/${complaintId}/messages`);
  }

  /**
   * Resolve complaint with refund
   */
  async resolveWithRefund(complaintId: string, resolutionNote?: string): Promise<ApiResponse<Complaint>> {
    return apiService.post<Complaint>(`/complaints/${complaintId}/resolve-with-refund`, {
      resolutionNote,
    });
  }

  /**
   * Complete complaint without refund (seller only)
   */
  async completeWithoutRefund(complaintId: string, resolutionNote?: string): Promise<ApiResponse<Complaint>> {
    return apiService.post<Complaint>(`/complaints/${complaintId}/complete`, {
      resolutionNote,
    });
  }

  /**
   * Close complaint (buyer/reporter only)
   */
  async closeComplaint(complaintId: string, closeNote?: string): Promise<ApiResponse<Complaint>> {
    return apiService.post<Complaint>(`/complaints/${complaintId}/close`, {
      closeNote,
    });
  }
}

// Export singleton instance
export const complaintsService = new ComplaintsService();
export default complaintsService;
