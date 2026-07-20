/**
 * FAQ Service
 * Service for fetching frequently asked questions from the API
 */

import { apiService, ApiResponse } from './api.service';
import { API_ENDPOINTS } from '@/config/api.config';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  order: number;
  isActive?: boolean;
  category?: {
    id: string;
    name: string;
  };
}

export interface FaqCategory {
  id: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
  _count?: {
    faqs: number;
  };
}

export interface FaqListResponse {
  success: boolean;
  data: FaqItem[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

class FaqService {
  /**
   * Get public FAQs (no authentication required)
   */
  async getPublicFaqs(limit?: number): Promise<ApiResponse<FaqItem[]>> {
    const params: Record<string, any> = {};
    if (limit) {
      params.limit = limit;
    }

    return apiService.get<FaqItem[]>(API_ENDPOINTS.FAQS.BASE, params);
  }

  /**
   * Get all FAQs (admin view, requires authentication)
   */
  async getAllFaqs(params?: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
  }): Promise<ApiResponse<FaqItem[]>> {
    return apiService.get<FaqItem[]>('/admin/faqs', params);
  }

  /**
   * Get FAQ by ID (admin view, requires authentication)
   */
  async getFaqById(faqId: string): Promise<ApiResponse<FaqItem>> {
    return apiService.get<FaqItem>(API_ENDPOINTS.FAQS.DETAIL(faqId));
  }

  /**
   * Search FAQs by query
   */
  async searchFaqs(query: string, limit?: number): Promise<ApiResponse<FaqItem[]>> {
    const params: Record<string, any> = { search: query };
    if (limit) {
      params.limit = limit;
    }

    return apiService.get<FaqItem[]>(API_ENDPOINTS.FAQS.BASE, params);
  }

  /**
   * Get FAQ categories
   */
  async getFaqCategories(): Promise<ApiResponse<FaqCategory[]>> {
    return apiService.get<FaqCategory[]>(API_ENDPOINTS.FAQS.CATEGORIES);
  }
}

// Export singleton instance
export const faqService = new FaqService();
export default faqService;