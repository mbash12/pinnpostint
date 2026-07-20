import { LocationSuggestion } from './nominatim';
import { googleMapsService } from './google-maps';
import { nominatimService } from './nominatim';
import config from '../config/environment';

/**
 * Unified location service that switches between Google Maps and Nominatim
 * based on the MAP_PROVIDER environment variable
 */
class UnifiedLocationService {
    private get provider() {
        return config.external.mapProvider;
    }

    /**
     * Search locations using the configured provider (Google or OSM)
     */
    async searchLocations(
        query: string,
        limit: number = 5
    ): Promise<LocationSuggestion[]> {
        if (this.provider === 'google') {
            return googleMapsService.searchLocations(query, limit);
        } else {
            return nominatimService.searchLocations(query, limit);
        }
    }

    /**
     * Reverse geocode to get location name from coordinates
     * using the configured provider (Google or OSM)
     */
    async reverseGeocode(
        lat: number,
        lon: number
    ): Promise<LocationSuggestion | null> {
        if (this.provider === 'google') {
            return googleMapsService.reverseGeocode(lat, lon);
        } else {
            return nominatimService.reverseGeocode(lat, lon);
        }
    }

    /**
     * Get the current provider name
     */
    getProvider(): 'google' | 'osm' {
        return this.provider;
    }

    /**
     * Check if Google Maps is being used
     */
    isGoogle(): boolean {
        return this.provider === 'google';
    }

    /**
     * Check if OSM is being used
     */
    isOSM(): boolean {
        return this.provider === 'osm';
    }
}

// Export singleton instance
export const locationService = new UnifiedLocationService();

// Also export service directly for backward compatibility
export const searchLocations = (query: string, limit?: number) =>
    locationService.searchLocations(query, limit);

export const reverseGeocode = (lat: number, lon: number) =>
    locationService.reverseGeocode(lat, lon);
