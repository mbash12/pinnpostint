/**
 * Standardized API Response Types
 *
 * This file contains unified type definitions for API responses, error handling,
 * and pagination to ensure consistency across all endpoints.
 */

// Import standardized models that are referenced in this file
import type { StandardUserSummary, LocationSummary } from './standardized-models';

// Re-export standardized models for consistency
export * from './standardized-models';

// ============================================================================
// Core Response Types
// ============================================================================

/**
 * Standard API response wrapper for all endpoints
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
}

/**
 * Standardized error response structure
 */
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: ValidationError[];
  stack?: string; // Only included in development environment
}

/**
 * Validation error details for form/input validation failures
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

// Re-export standardized models for consistency
export * from './standardized-models';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Standardized error codes used across all API endpoints
 */
export enum ErrorCode {
  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Authentication & Authorization Errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  ACCOUNT_NOT_VERIFIED = 'ACCOUNT_NOT_VERIFIED',

  // Resource Errors
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  AD_NOT_FOUND = 'AD_NOT_FOUND',
  CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND',
  SUBCATEGORY_NOT_FOUND = 'SUBCATEGORY_NOT_FOUND',
  LOCATION_NOT_FOUND = 'LOCATION_NOT_FOUND',

  // Conflict Errors
  CONFLICT = 'CONFLICT',
  USER_EXISTS = 'USER_EXISTS',
  DUPLICATE_FIELD = 'DUPLICATE_FIELD',
  UNIQUE_CONSTRAINT_VIOLATION = 'UNIQUE_CONSTRAINT_VIOLATION',

  // OTP & Verification Errors
  INVALID_OTP = 'INVALID_OTP',
  OTP_EXPIRED = 'OTP_EXPIRED',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // File Upload Errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  UPLOAD_FAILED = 'UPLOAD_FAILED',

  // Business Logic Errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  RESOURCE_EXPIRED = 'RESOURCE_EXPIRED'
}

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Standardized pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

/**
 * Pagination query parameters
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

// ============================================================================
// Authentication Response Types
// ============================================================================

/**
 * Standardized user data structure for API responses
 */
export interface StandardUser {
  id: string;
  phone: string;
  email?: string;
  firstName: string;
  lastName?: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  profile?: UserProfile;
}

/**
 * User roles enum
 */
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

/**
 * User profile data structure
 */
export interface UserProfile {
  bio?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCodeId?: string;
  dob?: string;
  gender?: string;
  // Notification preferences
  emailNotifications: boolean;
  pushNotifications: boolean;
}

/**
 * Authentication response format
 */
export type AuthResponse = ApiResponse<AuthData>;

export interface AuthData {
  token: string;
  user: StandardUser;
  expiresAt: string;
}

/**
 * OTP response format
 */
export type OtpResponse = ApiResponse<OtpData>;

export interface OtpData {
  otpId: string;
  expiresAt: string;
}

/**
 * Temporary token response (for registration/password reset flows)
 */
export type TempTokenResponse = ApiResponse<TempTokenData>;

export interface TempTokenData {
  tempToken?: string;
  resetToken?: string;
}

// ============================================================================
// Data Model Types
// ============================================================================

/**
 * Standardized Ad data structure
 */
export interface StandardAd {
  id: string;
  title: string;
  description: string;
  price: number | null;
  discountedPrice?: number | null;
  status: AdStatus;
  images: string[];
  isFeatured: boolean;
  enableBooking?: boolean;
  userId: string;
  categoryId: string;
  subcategoryId?: string;
  // Verbose location fields from Google Maps
  locationLatitude?: number;
  locationLongitude?: number;
  locationRoad?: string;
  locationHouseNumber?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  locationPostalCode?: string;
  locationFormatted?: string;
  slug?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  user?: StandardUserSummary;
  category?: CategorySummary;
  subcategory?: SubcategorySummary;
  attributes?: AdAttribute[];
  subscriptions?: {
    id: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  }[];
  moderationHistory?: {
    id: string;
    action: string;
    reason: string | null;
    createdAt: string;
    moderator: {
      id: string;
      firstName: string;
      lastName: string | null;
    };
  }[];
  // Additional fields for consistency
  views?: number;
  moderatedBy?: string;
  moderatedAt?: string;
  rejectionReason?: string;
  isFlagged?: boolean;
  flagReason?: string;
  isFavorite?: boolean;
  attachment?: any; // JsonValue from Prisma - can be string, number, boolean, object, or array
  bookingType?: 'DEFAULT' | 'SLOTS';
  slots?: any; // JsonValue from Prisma
  bookingStartDate?: string;
  bookingEndDate?: string;
}

/**
 * Ad status enum
 */
export enum AdStatus {
  REVIEW = 'REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  UNPUBLISHED = 'UNPUBLISHED'
}

/**
 * Standardized Category data structure
 */
export interface StandardCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  isActive: boolean;
  isFeatured: boolean;
  supportsBooking: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  subcategories?: StandardSubcategory[];
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  adPlaceholder?: string | null;
}

/**
 * Standardized Subcategory data structure
 */
export interface StandardSubcategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  isActive: boolean;
  supportsBooking: boolean;
  order: number;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
  attributes?: StandardAttribute[];
}

export interface SubcategorySummary {
  id: string;
  name: string;
  slug: string;
}

/**
 * Standardized Attribute data structure
 */
export interface StandardAttribute {
  id: string;
  name: string;
  type: AttributeType;
  options?: string[];
  isRequired: boolean;
  order: number;
  subcategoryId: string;
}

export enum AttributeType {
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  SELECT = 'select'
}

/**
 * Ad attribute value
 */
export interface AdAttribute {
  id: string;
  adId: string;
  attributeId: string;
  value: string;
  attribute?: StandardAttribute;
}

// ============================================================================
// File Upload Types
// ============================================================================

/**
 * File upload response
 */
export type FileUploadResponse = ApiResponse<FileUploadData>;

export interface FileUploadData {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

// ============================================================================
// Search and Filter Types
// ============================================================================

/**
 * Search query parameters
 */
export interface SearchQuery extends PaginationQuery {
  search?: string;
  categoryId?: string;
  subcategoryId?: string;
  // Location-based proximity search
  locationLatitude?: number;
  locationLongitude?: number;
  locationRadiusKm?: number;
  status?: AdStatus;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Success response helper
 */
export interface SuccessResponse<T = unknown> extends ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Error response helper
 */
export interface ErrorResponse extends ApiResponse<never> {
  success: false;
  error: ApiError;
}

/**
 * Health check response
 */
export type HealthCheckResponse = ApiResponse<HealthCheckData>;

export interface HealthCheckData {
  timestamp: string;
  environment: string;
  version?: string;
  uptime?: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(response: ApiResponse<unknown>): response is ErrorResponse {
  return response.success === false;
}

// ============================================================================
// Response Builder Helpers
// ============================================================================

/**
 * Helper function to create success responses
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string
): SuccessResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message })
  };
}

/**
 * Helper function to create error responses
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: ValidationError[]
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details })
    }
  };
}

/**
 * Helper function to create paginated responses
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  message?: string
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination,
    ...(message && { message })
  };
}

/**
 * Helper function to calculate pagination metadata
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
    hasPreviousPage: page > 1
  };
}