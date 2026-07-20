/**
 * Ads Service
 * Handles all ad-related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_ENDPOINTS } from '@/config/api.config';
import { AdLocation } from '@/types/location.types';

export interface Ad {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number | null;
  discountedPrice?: number | null;
  status: 'REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'UNPUBLISHED';
  rejectionReason?: string | null;
  images: string[];
  isFeatured: boolean;
  isFavorite?: boolean;
  enableBooking?: boolean;
  bookingType?: 'DEFAULT' | 'SLOTS';
  slots?: any[] | null;
  bookingStartDate?: string;
  bookingEndDate?: string;
  attachment?: string[] | null;
  userId: string;
  categoryId: string;
  subcategoryId?: string;
  // Verbose location fields instead of locationId
  locationLatitude?: number;
  locationLongitude?: number;
  locationRoad?: string;
  locationHouseNumber?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  locationPostalCode?: string;
  locationFormatted?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  views?: number;
  hasRevision?: boolean;
  hasPendingChanges?: boolean;
  autoApplyAt?: string;
  user?: {
    id: string;
    firstName: string;
    lastName?: string;
    phone: string;
    avatar?: string;
    email?: string;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
    adPlaceholder?: string;
  };
  subcategory?: {
    id: string;
    name: string;
    slug: string;
  };
  attributes?: Array<{
    id: string;
    adId: string;
    attributeId: string;
    value: string;
    attribute?: {
      id: string;
      name: string;
      type: 'text' | 'number' | 'boolean' | 'select';
      options?: string[];
    };
  }>;
}

export interface CreateAdRequest {
  title: string;
  description: string;
  price: number | null;
  discountedPrice?: number | null;
  categoryId: string;
  subcategoryId?: string;
  // Verbose location fields instead of locationId
  locationLatitude?: number;
  locationLongitude?: number;
  locationRoad?: string;
  locationHouseNumber?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  locationPostalCode?: string;
  locationFormatted?: string;
  enableBooking?: boolean;
  bookingType?: 'DEFAULT' | 'SLOTS';
  slots?: any[] | null;
  bookingStartDate?: string;
  bookingEndDate?: string;
  attachment?: string[] | null;
  attributes?: Array<{
    attributeId: string;
    value: string;
  }>;
  images?: string[];
}

export interface UpdateAdRequest {
  title?: string;
  description?: string;
  price?: number | null;
  discountedPrice?: number | null;
  categoryId?: string;
  subcategoryId?: string;
  // Verbose location fields instead of locationId
  locationLatitude?: number;
  locationLongitude?: number;
  locationRoad?: string;
  locationHouseNumber?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  locationPostalCode?: string;
  locationFormatted?: string;
  enableBooking?: boolean;
  bookingType?: 'DEFAULT' | 'SLOTS';
  slots?: any[] | null;
  bookingStartDate?: string;
  bookingEndDate?: string;
  attachment?: string[] | null;
  images?: string[];
  attributes?: Array<{
    attributeId: string;
    value: string;
  }>;
}

export interface GetAdsParams {
  page?: number;
  limit?: number;
  categoryId?: string;
  subcategoryId?: string;
  // Location bounds for proximity search (instead of locationId)
  locationLatitude?: number;
  locationLongitude?: number;
  locationRadiusKm?: number; // Default: 50
  userId?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  status?: 'REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'UNPUBLISHED' | 'ACTIVE';
  isFeatured?: boolean;
  sortBy?: 'createdAt' | 'price' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
  message?: string;
}

export interface AdStats {
  views: number;
  favorites: number;
  shares: number;
  bookings: number;
}

class AdsService {
  /**
   * Get public ads (no authentication required)
   */
  async getPublicAds(params?: GetAdsParams): Promise<PaginatedResponse<Ad>> {
    return apiService.get<any>(
      API_ENDPOINTS.PUBLIC.ADS,
      params
    ) as Promise<PaginatedResponse<Ad>>;
  }

  /**
   * Get single public ad by slug
   */
  async getPublicAd(adSlug: string): Promise<ApiResponse<Ad>> {
    return apiService.get<Ad>(API_ENDPOINTS.PUBLIC.AD_DETAIL(adSlug));
  }

  /**
   * Get featured ads
   */
  async getFeaturedAds(params?: { limit?: number; categoryId?: string }): Promise<ApiResponse<Ad[]>> {
    const query: Record<string, any> = {};
    if (params?.limit) query.limit = params.limit;
    if (params?.categoryId) query.categoryId = params.categoryId;
    return apiService.get<Ad[]>(API_ENDPOINTS.PUBLIC.FEATURED_ADS, query);
  }

  /**
   * Get recommended ads (auth optional)
   */
  async getRecommendedAds(params?: { 
    limit?: number; 
    sortBy?: 'createdAt' | 'price' | 'title' | 'relevance';
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<Ad[]>> {
    const query: Record<string, any> = {};
    if (params?.limit) query.limit = params.limit;
    if (params?.sortBy) query.sortBy = params.sortBy;
    if (params?.sortOrder) query.sortOrder = params.sortOrder;
    return apiService.get<Ad[]>(API_ENDPOINTS.PUBLIC.RECOMMENDED_ADS, query);
  }

  /**
   * Get user's own ads
   */
  async getMyAds(params?: GetAdsParams): Promise<PaginatedResponse<Ad>> {
    return apiService.get<any>(
      API_ENDPOINTS.USER_ADS.BASE,
      params
    ) as Promise<PaginatedResponse<Ad>>;
  }

  /**
   * Get single user ad
   */
  async getMyAd(adId: string): Promise<ApiResponse<Ad>> {
    return apiService.get<Ad>(API_ENDPOINTS.USER_ADS.DETAIL(adId));
  }

  /**
   * Create new ad
   */
  async createAd(data: CreateAdRequest): Promise<ApiResponse<Ad>> {
    // Use JSON for all requests, including with image URLs
    return apiService.post<Ad>(API_ENDPOINTS.USER_ADS.BASE, data);
  }

  /**
   * Update ad
   */
  async updateAd(adId: string, data: UpdateAdRequest): Promise<ApiResponse<Ad>> {
    return apiService.put<Ad>(API_ENDPOINTS.USER_ADS.DETAIL(adId), data);
  }

  /**
   * Delete ad
   */
  async deleteAd(adId: string): Promise<ApiResponse<void>> {
    return apiService.delete<void>(API_ENDPOINTS.USER_ADS.DETAIL(adId));
  }

  /**
   * Search ads
   */
  async searchAds(params: GetAdsParams): Promise<PaginatedResponse<Ad>> {
    return apiService.get<any>(
      API_ENDPOINTS.PUBLIC.SEARCH,
      params
    ) as Promise<PaginatedResponse<Ad>>;
  }

  /**
   * Get ad stats
   */
  async getAdStats(adId: string): Promise<ApiResponse<AdStats>> {
    return apiService.get<AdStats>(API_ENDPOINTS.USER_ADS.STATS(adId));
  }

  /**
   * Record ad view
   */
  async recordView(adId: string): Promise<ApiResponse<void>> {
    return apiService.post<void>(API_ENDPOINTS.AD_STATS.RECORD_VIEW(adId), {});
  }

  /**
   * Record ad share
   */
  async recordShare(adId: string): Promise<ApiResponse<void>> {
    return apiService.post<void>(API_ENDPOINTS.AD_STATS.RECORD_SHARE(adId), {});
  }

  /**
   * Notify seller that someone is interested in their expired ad
   */
  async notifyRenewalInterest(adId: string): Promise<ApiResponse<void>> {
    return apiService.post<void>(API_ENDPOINTS.AD_STATS.NOTIFY_RENEWAL_INTEREST(adId), {});
  }

  /**
   * Unpublish an approved ad
   */
  async unpublishAd(adId: string): Promise<ApiResponse<Ad>> {
    return apiService.post<Ad>(`${API_ENDPOINTS.USER_ADS.DETAIL(adId)}/unpublish`, {});
  }

  /**
   * Republish an unpublished ad
   */
  async republishAd(adId: string): Promise<ApiResponse<Ad>> {
    return apiService.post<Ad>(`${API_ENDPOINTS.USER_ADS.DETAIL(adId)}/republish`, {});
  }
}

// Export singleton instance
export const adsService = new AdsService();
export default adsService;
