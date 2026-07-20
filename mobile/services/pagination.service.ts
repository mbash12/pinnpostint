/**
 * Pagination Service
 * Utility functions for handling pagination across the mobile app
 */

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

export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Default pagination configuration
 */
export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 10,
  maxLimit: 100,
} as const;

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(params: PaginationParams): {
  page: number;
  limit: number;
} {
  const page = Math.max(1, params.page || DEFAULT_PAGINATION.page);
  const limit = Math.min(
    DEFAULT_PAGINATION.maxLimit,
    Math.max(1, params.limit || DEFAULT_PAGINATION.limit)
  );
  
  return { page, limit };
}

/**
 * Build pagination query parameters
 */
export function buildPaginationQuery(params: PaginationParams): Record<string, string> {
  const { page, limit } = validatePaginationParams(params);
  
  return {
    page: page.toString(),
    limit: limit.toString(),
  };
}

/**
 * Check if there are more pages available
 */
export function hasMorePages(pagination: PaginationMeta): boolean {
  return pagination.hasNextPage;
}

/**
 * Get next page number
 */
export function getNextPage(pagination: PaginationMeta): number | null {
  return pagination.hasNextPage ? pagination.page + 1 : null;
}

/**
 * Get previous page number
 */
export function getPreviousPage(pagination: PaginationMeta): number | null {
  return pagination.hasPreviousPage ? pagination.page - 1 : null;
}

/**
 * Calculate offset for database queries
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Create empty paginated response
 */
export function createEmptyPaginatedResponse<T>(): PaginatedResponse<T> {
  return {
    success: true,
    data: [],
    pagination: {
      page: 1,
      limit: DEFAULT_PAGINATION.limit,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

/**
 * Merge paginated responses (for infinite scroll)
 */
export function mergePaginatedResponses<T>(
  existing: PaginatedResponse<T>,
  newResponse: PaginatedResponse<T>
): PaginatedResponse<T> {
  return {
    ...newResponse,
    data: [...existing.data, ...newResponse.data],
  };
}

/**
 * Extract pagination info for display
 */
export function getPaginationInfo(pagination: PaginationMeta): {
  showing: string;
  total: string;
  pageInfo: string;
} {
  const start = (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);
  
  return {
    showing: `${start}-${end}`,
    total: pagination.total.toString(),
    pageInfo: `Page ${pagination.page} of ${pagination.totalPages}`,
  };
}