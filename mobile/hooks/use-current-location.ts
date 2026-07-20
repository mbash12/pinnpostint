/**
 * Current Location Hook
 * Custom hook for managing current location state and fetching
 */

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { geolocationService, GeolocationResult, Coordinates } from '@/services/geolocation.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UseCurrentLocationOptions {
  autoFetch?: boolean;
  watchLocation?: boolean;
}

export interface UseCurrentLocationReturn {
  location: GeolocationResult | null;
  isLoading: boolean;
  error: string | null;
  fetchLocation: () => Promise<void>;
  refreshLocation: () => Promise<void>;
  permissionGranted: boolean | null;
}

export function useCurrentLocation(options: UseCurrentLocationOptions = {}): UseCurrentLocationReturn {
  const { autoFetch = true, watchLocation = false } = options;

  const [location, setLocation] = useState<GeolocationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  // Check cache on initial mount
  useEffect(() => {
    const checkCache = async () => {
      try {
        const cachedData = await AsyncStorage.getItem('geolocation_cache');
        if (cachedData) {
          const { timestamp, data } = JSON.parse(cachedData);
          const now = Date.now();
          // Cache valid for 24 hours
          if (now - timestamp < 24 * 60 * 60 * 1000) {
            setLocation(data);
            setPermissionGranted(true);
            setIsLoading(false);
            return true;
          }
        }
      } catch (e) {
      }
      setIsLoading(false);
      return false;
    };

    checkCache();
  }, []);

  const fetchLocation = useCallback(async (force: boolean = false) => {
    // Don't set loading if we have cached data and not forcing
    if (!force && location) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First check permission
      const hasPermission = await geolocationService.requestLocationPermission();
      if (!hasPermission) {
        setPermissionGranted(false);
        setError('Location permission denied. Please enable it in settings.');
        return;
      }

      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setError('Location services are disabled. Please enable GPS in settings.');
        setPermissionGranted(false);
        setIsLoading(false);
        return;
      }

      // Add timeout to prevent infinite loading (15s for GPS + 12s for geocoding)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => {
          reject(new Error('Location request timed out'));
        }, 15000)
      );

      // Get fresh location data with timeout
      const result = await Promise.race([
        geolocationService.getGeolocation(force),
        timeoutPromise,
      ]);

      if (result) {
        setLocation(result);
        setPermissionGranted(true);
        setError(null);
      } else {
        setError('Unable to detect your location. You can search manually instead.');
        setPermissionGranted(false);
      }
    } catch (err) {
      let errorMessage = 'Failed to get location';

      if (err instanceof Error) {
        // Provide more helpful error messages
        if (err.message.includes('timed out') || err.message.includes('Location request timeout')) {
          errorMessage = 'Location not available. In Android emulators: set mock location via Extended Controls > Location. You can also search manually.';
        } else if (err.message.includes('Location services are disabled') || err.message.includes('services are disabled')) {
          errorMessage = 'Location services are disabled. Please enable GPS in your device settings.';
        } else if (err.message.includes('Current location is unavailable')) {
          errorMessage = 'GPS is unavailable on this device. Try searching for a location manually.';
        } else if (err.message.includes('permission')) {
          errorMessage = 'Location permission is required. Please enable it in settings.';
        } else {
          // Use the original error message for other cases
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      setPermissionGranted(false);
    } finally {
      setIsLoading(false);
    }
  }, [location]);

  const refreshLocation = useCallback(async () => {
    // Force refresh by clearing current location first
    setLocation(null);
    await fetchLocation(true);
  }, [fetchLocation]);

  useEffect(() => {
    if (autoFetch) {
      // Only fetch if we don't already have a cached location
      if (!location) {
        fetchLocation(false);
      }
    }
  }, [autoFetch, fetchLocation]);

  useEffect(() => {
    let subscription: any = null;

    if (watchLocation) {
      const setupLocationWatcher = async () => {
        try {
          const hasPermission = await geolocationService.requestLocationPermission();
          if (hasPermission) {
            subscription = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 60000, // Update every minute
                distanceInterval: 100, // Update every 100 meters
              },
              async (newPosition) => {
                const coordinates: Coordinates = {
                  latitude: newPosition.coords.latitude,
                  longitude: newPosition.coords.longitude,
                };

                const address = await geolocationService.reverseGeocode(coordinates);
                if (address) {
                  setLocation({
                    coordinates,
                    address,
                  });
                }
              }
            );
          }
        } catch (err) {
        }
      };

      setupLocationWatcher();
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [watchLocation]);

  return {
    location,
    isLoading,
    error,
    fetchLocation,
    refreshLocation,
    permissionGranted,
  };
}