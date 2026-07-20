/**
 * API Pagination Hook
 * Bridges the API's standardized pagination format with admin panel components
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PaginatedResponse, PaginationMeta } from '../lib/api-types';

export interface UseApiPaginationOptions<T> {
  queryKey: (string | number | object)[];
  queryFn: (params: { page: number; limit: number;[key: string]: any }) => Promise<PaginatedResponse<T>>;
  initialParams?: Record<string, any>;
  enabled?: boolean;
  keepPreviousData?: boolean;
}

export interface UseApiPaginationResult<T> {
  data: T[];
  pagination: PaginationMeta | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  updateParams: (newParams: Record<string, any>) => void;
  refresh: () => void;
}

export function useApiPagination<T>({
  queryKey,
  queryFn,
  initialParams = {},
  enabled = true,
  keepPreviousData = true,
}: UseApiPaginationOptions<T>): UseApiPaginationResult<T> {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [params, setParams] = useState(initialParams);

  const queryParams = useMemo(() => ({
    page,
    limit,
    ...params,
  }), [page, limit, params]);

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [...queryKey, queryParams],
    queryFn: () => queryFn(queryParams),
    enabled,
    placeholderData: keepPreviousData ? (previousData: any) => previousData : undefined,
  });

  const updateParams = useCallback((newParams: Record<string, any>) => {
    setParams(prevParams => ({ ...prevParams, ...newParams }));
    setPage(1); // Reset to first page when params change
  }, []);

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Reset page when params change
  useEffect(() => {
    setPage(1);
  }, [params]);

  const paginatedData = response as PaginatedResponse<T>;

  return {
    data: paginatedData?.data || [],
    pagination: paginatedData?.pagination || null,
    isLoading,
    isError,
    error: error as Error | null,
    currentPage: page,
    totalPages: paginatedData?.pagination?.totalPages || 0,
    totalItems: paginatedData?.pagination?.total || 0,
    hasNextPage: paginatedData?.pagination?.hasNextPage || false,
    hasPreviousPage: paginatedData?.pagination?.hasPreviousPage || false,
    setPage,
    setLimit,
    updateParams,
    refresh,
  };
}

/**
 * Hook for search with API pagination
 */
export function useApiSearch<T>(
  queryKey: (string | number | object)[],
  queryFn: (params: { page: number; limit: number; search?: string;[key: string]: any }) => Promise<PaginatedResponse<T>>,
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

  const result = useApiPagination({
    queryKey: [...queryKey, { search: debouncedQuery }],
    queryFn,
    initialParams: {
      ...initialParams,
      search: debouncedQuery,
    },
  });

  return {
    ...result,
    searchQuery,
    setSearchQuery,
    isSearching: searchQuery !== debouncedQuery,
  };
}

/**
 * Convert API pagination to admin panel pagination info format
 */
export function convertToPaginationInfo(pagination: PaginationMeta | null) {
  if (!pagination) {
    return {
      currentPage: 1,
      totalPages: 0,
      totalItems: 0,
      itemsPerPage: 10,
      startItem: 0,
      endItem: 0,
    };
  }

  const startItem = (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  return {
    currentPage: pagination.page,
    totalPages: pagination.totalPages,
    totalItems: pagination.total,
    itemsPerPage: pagination.limit,
    startItem: pagination.total > 0 ? startItem : 0,
    endItem: pagination.total > 0 ? endItem : 0,
  };
}