/**
 * Locations Service
 * Handles all location-related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_ENDPOINTS } from '@/config/api.config';

export interface Location {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country: string;
  pincode?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  adCount?: number;
}

export interface LocationsParams {
  page?: number;
  limit?: number;
  search?: string;
  country?: string;
  state?: string;
  city?: string;
}

import { PaginatedResponse } from './pagination.service';

class LocationsService {
  /**
   * Get all public locations
   */
  async getLocations(params?: LocationsParams): Promise<PaginatedResponse<Location>> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.country) queryParams.append('country', params.country);
    if (params?.state) queryParams.append('state', params.state);
    if (params?.city) queryParams.append('city', params.city);

    const url = `${API_ENDPOINTS.PUBLIC.LOCATIONS}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiService.get<any>(url) as Promise<PaginatedResponse<Location>>;
  }

  /**
   * Search locations by name or address
   */
  async searchLocations(query: string, limit: number = 10): Promise<PaginatedResponse<Location>> {
    return this.getLocations({ search: query, limit });
  }

  /**
   * Get locations by country
   */
  async getLocationsByCountry(country: string, params?: Omit<LocationsParams, 'country'>): Promise<PaginatedResponse<Location>> {
    return this.getLocations({ ...params, country });
  }

  /**
   * Get locations by state
   */
  async getLocationsByState(state: string, params?: Omit<LocationsParams, 'state'>): Promise<PaginatedResponse<Location>> {
    return this.getLocations({ ...params, state });
  }

  /**
   * Get locations by city
   */
  async getLocationsByCity(city: string, params?: Omit<LocationsParams, 'city'>): Promise<PaginatedResponse<Location>> {
    return this.getLocations({ ...params, city });
  }
}

// Export singleton instance
export const locationsService = new LocationsService();
export default locationsService;