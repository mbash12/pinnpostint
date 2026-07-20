/**
 * Ads Hook
 * Custom hooks for managing ads data with pagination
 */

import { useCallback } from 'react';
import { adsService, Ad, GetAdsParams } from '@/services/ads.service';
import { usePaginatedData, useInfiniteScroll, useSearchWithPagination } from './use-paginated-data';

/**
 * Hook for fetching public ads with pagination
 */
export function usePublicAds(params?: GetAdsParams) {
  const fetchFunction = useCallback(
    (fetchParams: any) => adsService.getPublicAds(fetchParams),
    []
  );

  return usePaginatedData({
    fetchFunction,
    initialParams: params,
  });
}

/**
 * Hook for fetching user's own ads with pagination
 */
export function useMyAds(params?: GetAdsParams) {
  const fetchFunction = useCallback(
    (fetchParams: any) => adsService.getMyAds(fetchParams),
    []
  );

  return usePaginatedData({
    fetchFunction,
    initialParams: params,
  });
}

/**
 * Hook for infinite scroll of public ads
 */
export function usePublicAdsInfiniteScroll(params?: GetAdsParams) {
  const fetchFunction = useCallback(
    (fetchParams: any) => adsService.getPublicAds(fetchParams),
    []
  );

  return useInfiniteScroll({
    fetchFunction,
    initialParams: params,
  });
}

/**
 * Hook for searching ads with pagination and debouncing
 */
export function useAdsSearch(params?: Omit<GetAdsParams, 'search'>) {
  const fetchFunction = useCallback(
    (fetchParams: any) => adsService.searchAds(fetchParams),
    []
  );

  return useSearchWithPagination(fetchFunction, params);
}

/**
 * Hook for fetching ads by category with pagination
 */
export function useAdsByCategory(categoryId: string, params?: Omit<GetAdsParams, 'categoryId'>) {
  const fetchFunction = useCallback(
    (fetchParams: any) => adsService.getPublicAds(fetchParams),
    []
  );

  return usePaginatedData({
    fetchFunction,
    initialParams: {
      ...params,
      categoryId,
    },
    enabled: !!categoryId,
  });
}

/**
 * Hook for fetching ads by location with pagination
 */
export function useAdsByLocation(locationId: string, params?: Omit<GetAdsParams, 'locationId'>) {
  const fetchFunction = useCallback(
    (fetchParams: any) => adsService.getPublicAds(fetchParams),
    []
  );

  return usePaginatedData({
    fetchFunction,
    initialParams: {
      ...params,
      locationId,
    },
    enabled: !!locationId,
  });
}

/**
 * Hook for fetching featured ads
 */
export function useFeaturedAds(params?: GetAdsParams) {
  const fetchFunction = useCallback(
    (fetchParams: any) => adsService.getPublicAds({
      ...fetchParams,
      isFeatured: true,
    }),
    []
  );

  return usePaginatedData({
    fetchFunction,
    initialParams: params,
  });
}