import apiService from './api.service';
import { ApiResponse } from '@/services/api.service';

export enum PlatformAdPosition {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  TOP = 'TOP',
  BOTTOM = 'BOTTOM',
  POPUP = 'POPUP',
}

export interface PlatformAd {
  id: string;
  title?: string;
  description?: string;
  imageUrl: string;
  linkUrl?: string;
  position: PlatformAdPosition;
  type: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

class PlatformAdsService {
  /**
   * Get active platform ads
   */
  async getPlatformAds(position?: PlatformAdPosition): Promise<ApiResponse<PlatformAd[]>> {
    return apiService.get<PlatformAd[]>('/public/platform-ads', { position });
  }

  /**
   * Get all platform ads (Admin)
   */
  async getAllPlatformAds(): Promise<ApiResponse<PlatformAd[]>> {
    return apiService.get<PlatformAd[]>('/admin/platform-ads');
  }

  /**
   * Create platform ad (Admin)
   */
  async createPlatformAd(data: Partial<PlatformAd>): Promise<ApiResponse<PlatformAd>> {
    return apiService.post<PlatformAd>('/admin/platform-ads', data);
  }

  /**
   * Update platform ad (Admin)
   */
  async updatePlatformAd(id: string, data: Partial<PlatformAd>): Promise<ApiResponse<PlatformAd>> {
    return apiService.put<PlatformAd>(`/admin/platform-ads/${id}`, data);
  }

  /**
   * Delete platform ad (Admin)
   */
  async deletePlatformAd(id: string): Promise<ApiResponse<null>> {
    return apiService.delete<null>(`/admin/platform-ads/${id}`);
  }
}

export const platformAdsService = new PlatformAdsService();
export default platformAdsService;
