/**
 * Locations Hook
 * Custom hooks for managing locations data with pagination
 */

import { useCallback } from 'react';
import { locationsService, Location, LocationsParams } from '@/services/locations.service';
import { usePaginatedData, useSearchWithPagination } from './use-paginated-data';

/**
 * Hook for fetching locations with pagination
 */
export function useLocations(params?: LocationsParams) {
  const fetchFunction = useCallback(
    (fetchParams: any) => locationsService.getLocations(fetchParams),
    []
  );

  return usePaginatedData({
    fetchFunction,
    initialParams: params,
  });
}

/**
 * Hook for searching locations with pagination and debouncing
 */
export function useLocationsSearch(params?: Omit<LocationsParams, 'search'>) {
  const fetchFunction = useCallback(
    (fetchParams: any) => locationsService.getLocations(fetchParams),
    []
  );

  return useSearchWithPagination(fetchFunction, params);
}

/**
 * Hook for fetching locations by country with pagination
 */
export function useLocationsByCountry(country: string, params?: Omit<LocationsParams, 'country'>) {
  const fetchFunction = useCallback(
    (fetchParams: any) => locationsService.getLocationsByCountry(country, fetchParams),
    []
  );

  return usePaginatedData({
    fetchFunction,
    initialParams: params,
    enabled: !!country,
  });
}

/**
 * Hook for fetching locations by state with pagination
 */
export function useLocationsByState(state: string, params?: Omit<LocationsParams, 'state'>) {
  const fetchFunction = useCallback(
    (fetchParams: any) => locationsService.getLocationsByState(state, fetchParams),
    []
  );

  return usePaginatedData({
    fetchFunction,
    initialParams: params,
    enabled: !!state,
  });
}

/**
 * Hook for fetching locations by city with pagination
 */
export function useLocationsByCity(city: string, params?: Omit<LocationsParams, 'city'>) {
  const fetchFunction = useCallback(
    (fetchParams: any) => locationsService.getLocationsByCity(city, fetchParams),
    []
  );

  return usePaginatedData({
    fetchFunction,
    initialParams: params,
    enabled: !!city,
  });
}