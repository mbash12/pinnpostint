/**
 * Geolocation Service
 * Handles device location detection and reverse geocoding using the unified location service
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { locationService } from './location.service';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Address {
  name?: string;
  city?: string;
  state?: string;
  country: string;
  postalCode?: string;
  street?: string;
  formatted?: string;
}

export interface GeolocationResult {
  coordinates: Coordinates;
  address: Address;
}

class GeolocationService {
  /**
   * Request location permissions
   */
  async requestLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if location services are enabled
   */
  async areLocationServicesEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current device location
   */
  async getCurrentLocation(): Promise<Coordinates | null> {
    try {
      // Check if location services are enabled
      const servicesEnabled = await this.areLocationServicesEnabled();
      if (!servicesEnabled) {
        throw new Error('Location services are disabled. Please enable GPS in settings.');
      }

      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      // Try to get current position with a short timeout (10s)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Location request timeout')), 10000)
      );

      try {
        const location = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low, // Use Low accuracy for faster response on AVD
            // Only require location permission, not background
          }),
          timeoutPromise,
        ]);

        return {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
      } catch (timeoutError) {
        // If timeout, try to get last known position (fallback for emulators)
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            return {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            };
          }
        } catch (lastKnownError) {
        }
        // Re-throw the original timeout error
        throw timeoutError;
      }
    } catch (error) {
      // Re-throw the error so the caller can handle it
      throw error;
    }
  }

  /**
   * Reverse geocode coordinates to get address using the unified location service
   */
  async reverseGeocode(coordinates: Coordinates): Promise<Address | null> {
    try {
      const { latitude, longitude } = coordinates;
      const result = await locationService.reverseGeocode(latitude, longitude);

      if (!result) {
        return null;
      }

      const address: Address = {
        name: result.name,
        city: result.address.city,
        state: result.address.state,
        country: result.address.country || 'Unknown',
        postalCode: result.address.postalCode,
        street: result.address.road,
        formatted: result.displayName,
      };

      return address;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  /**
   * Get complete geolocation result (coordinates + address)
   * @param forceUpdate If true, bypass cache and fetch fresh location
   */
  async getGeolocation(forceUpdate = false): Promise<GeolocationResult | null> {
    try {
      // Check cache first if not forced
      if (!forceUpdate) {
        try {
          const cachedData = await AsyncStorage.getItem('geolocation_cache');
          if (cachedData) {
            const { timestamp, data } = JSON.parse(cachedData);
            const now = Date.now();
            // Cache valid for 24 hours (24 * 60 * 60 * 1000 ms)
            if (now - timestamp < 24 * 60 * 60 * 1000) {
              return data;
            }
          }
        } catch (cacheError) {
        }
      }

      const coordinates = await this.getCurrentLocation();
      if (!coordinates) {
        return null;
      }

      const address = await this.reverseGeocode(coordinates);
      if (!address) {
        return null;
      }

      const result = {
        coordinates,
        address,
      };

      // Save to cache
      try {
        await AsyncStorage.setItem('geolocation_cache', JSON.stringify({
          timestamp: Date.now(),
          data: result
        }));
      } catch (cacheError) {
      }

      return result;
    } catch (error) {
      // Re-throw location-related errors so the caller can handle them properly
      if (error instanceof Error) {
        // Check for various location error messages from expo-location
        const locationErrorKeywords = [
          'Location services are disabled',
          'Current location is unavailable',
          'Location request timeout',
          'Location permission denied'
        ];

        const isLocationError = locationErrorKeywords.some(keyword =>
          error.message.includes(keyword)
        );

        if (isLocationError) {
          throw error;
        }
      }
      // For other errors, return null
      return null;
    }
  }

  /**
   * Search locations by query using the unified location service
   */
  async searchLocations(query: string, limit: number = 10): Promise<any[]> {
    try {
      const results = await locationService.searchLocations(query, limit);

      return results.map((item: any) => ({
        id: item.id,
        name: item.name,
        address: item.displayName,
        latitude: item.latitude,
        longitude: item.longitude,
        // Detailed address components
        address_details: item.address
      }));
    } catch (error) {
      console.error('Location search error:', error);
      return [];
    }
  }
}

// Export singleton instance
export const geolocationService = new GeolocationService();
export default geolocationService;