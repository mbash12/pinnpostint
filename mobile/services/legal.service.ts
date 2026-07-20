import { apiService, ApiResponse } from './api.service';
import { API_ENDPOINTS } from '@/config/api.config';

export interface LegalDocument {
  id: string;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
}

export interface PublicSettings {
  termsOfService?: string;
  privacyPolicy?: string;
  siteName?: string;
  customerCareEmail?: string;
}

class LegalService {
  async getDocumentBySlug(slug: string): Promise<ApiResponse<LegalDocument>> {
    return apiService.get(API_ENDPOINTS.LEGAL.DOCUMENT_BY_SLUG(slug));
  }

  async getPublicSettings(): Promise<ApiResponse<PublicSettings>> {
    // Use system settings endpoint since public/settings is empty
    return apiService.get(API_ENDPOINTS.SETTINGS.SYSTEM);
  }
}

export const legalService = new LegalService();
export default legalService;
