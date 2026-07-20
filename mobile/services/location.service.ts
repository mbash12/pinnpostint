import { LocationSuggestion } from '@/types/location.types';
import { googleMapsService } from './google-maps.service';

/**
 * Unified location service using Google Maps
 */
class LocationService {
  /**
   * Search locations using Google Maps
   */
  async searchLocations(
    query: string,
    limit: number = 5
  ): Promise<LocationSuggestion[]> {
    return googleMapsService.searchLocations(query, limit);
  }

  /**
   * Reverse geocode to get location name from coordinates using Google Maps
   */
  async reverseGeocode(
    lat: number,
    lon: number
  ): Promise<LocationSuggestion | null> {
    return googleMapsService.reverseGeocode(lat, lon);
  }
}

// Export singleton instance
export const locationService = new LocationService();

// Also export service directly for backward compatibility
export const searchLocations = (query: string, limit?: number) =>
  locationService.searchLocations(query, limit);

export const reverseGeocode = (lat: number, lon: number) =>
  locationService.reverseGeocode(lat, lon);
