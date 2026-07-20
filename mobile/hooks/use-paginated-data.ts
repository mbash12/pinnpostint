/**
 * Custom hook for handling paginated data fetching
 * Provides infinite scroll and pagination functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { PaginatedResponse, PaginationMeta } from '@/services/pagination.service';

export interface UsePaginatedDataOptions<T> {
  fetchFunction: (params: any) => Promise<PaginatedResponse<T>>;
  initialParams?: Record<string, any>;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

export interface UsePaginatedDataResult<T> {
  data: T[];
  pagination: PaginationMeta | null;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  hasNextPage: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  updateParams: (newParams: Record<string, any>) => void;
}

export function usePaginatedData<T>({
  fetchFunction,
  initialParams = {},
  enabled = true,
  onError,
}: UsePaginatedDataOptions<T>): UsePaginatedDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [params, setParams] = useState(initialParams);

  const fetchData = useCallback(
    async (page: number = 1, append: boolean = false) => {
      if (!enabled) return;

      try {
        if (page === 1) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const response = await fetchFunction({
          ...params,
          page,
          limit: params.limit || 10,
        });

        if (response.success) {
          if (append && page > 1) {
            setData(prevData => [...prevData, ...response.data]);
          } else {
            setData(response.data);
          }
          setPagination(response.pagination);
        } else {
          throw new Error(response.message || 'Failed to fetch data');
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        onError?.(error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchFunction, params, enabled, onError]
  );

  const loadMore = useCallback(async () => {
    if (!pagination?.hasNextPage || loading) return;
    
    await fetchData(pagination.page + 1, true);
  }, [fetchData, pagination, loading]);

  const refresh = useCallback(async () => {
    await fetchData(1, false);
  }, [fetchData]);

  const updateParams = useCallback((newParams: Record<string, any>) => {
    setParams(prevParams => ({ ...prevParams, ...newParams }));
  }, []);

  // Initial fetch and refetch when params change
  useEffect(() => {
    if (enabled) {
      fetchData(1, false);
    }
  }, [params, enabled]);

  return {
    data,
    pagination,
    loading,
    refreshing,
    error,
    hasNextPage: pagination?.hasNextPage || false,
    loadMore,
    refresh,
    updateParams,
  };
}

/**
 * Hook for infinite scroll functionality
 */
export function useInfiniteScroll<T>(options: UsePaginatedDataOptions<T>) {
  const result = usePaginatedData(options);

  const onEndReached = useCallback(() => {
    if (result.hasNextPage && !result.loading) {
      result.loadMore();
    }
  }, [result.hasNextPage, result.loading, result.loadMore]);

  return {
    ...result,
    onEndReached,
    onEndReachedThreshold: 0.1,
  };
}

/**
 * Hook for search with pagination
 */
export function useSearchWithPagination<T>(
  fetchFunction: (params: any) => Promise<PaginatedResponse<T>>,
  initialParams?: Record<string, any>
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const result = usePaginatedData({
    fetchFunction,
    initialParams: {
      ...initialParams,
      search: debouncedQuery,
    },
    enabled: true,
  });

  return {
    ...result,
    searchQuery,
    setSearchQuery,
    isSearching: searchQuery !== debouncedQuery,
  };
}