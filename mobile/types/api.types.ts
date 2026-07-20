/**
 * API Types
 * Common types used across the application
 */

// Re-export all service types for convenience
export type {
  // API Service
  ApiResponse,
  ApiError,
} from '@/services/api.service';

export type {
  // Auth Service
  User,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  CompleteRegistrationRequest,
  CompleteRegistrationResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  VerifyResetOtpRequest,
  VerifyResetOtpResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from '@/services/auth.service';

export type {
  // Ads Service
  Ad,
  CreateAdRequest,
  UpdateAdRequest,
  GetAdsParams,
} from '@/services/ads.service';

export type {
  // Pagination Service
  PaginationParams,
  PaginationMeta,
  PaginatedResponse,
} from '@/services/pagination.service';

export type {
  // Pagination Hooks
  UsePaginatedDataOptions,
  UsePaginatedDataResult,
} from '@/hooks/use-paginated-data';

export type {
  // Categories Service
  Category,
  Subcategory,
  Attribute,
} from '@/services/categories.service';

export type {
  // Locations Service
  Location,
  LocationsParams,
} from '@/services/locations.service';

export type {
  // Location Types
  LocationSuggestion,
  RecentLocation,
  PopularLocation,
  UnifiedLocationPickerMode,
  UnifiedLocationPickerProps,
} from '@/types/location.types';

export type {
  // User Service
  UpdateUserRequest,
  SavedLocation,
  CreateLocationRequest,
  UpdateLocationRequest,
  WishlistItem,
  Notification,
  NotificationType,
  NotificationPreferences,
} from '@/services/user.service';

export type {
  // Bookings Service
  Booking,
  CreateBookingRequest,
  UpdateBookingStatusRequest,
} from '@/services/bookings.service';

export {
  PlatformAdPosition,
} from '@/services/platform-ads.service';

export type {
  // Platform Ads Service
  PlatformAd,
} from '@/services/platform-ads.service';

// ========== FILE UPLOAD TYPES ==========

export interface FileUploadResponse {
  filename: string;
  originalName: string;
  path: string;
  url: string;
  size: number;
  mimetype: string;
  uploadedAt: string;
}

export interface MultipleFileUploadResponse {
  files: FileUploadResponse[];
  totalFiles: number;
  totalSize: number;
}

export interface FileValidationError {
  filename: string;
  error: string;
  code: 'INVALID_TYPE' | 'SIZE_EXCEEDED' | 'UPLOAD_FAILED';
}

export interface FileUploadConfig {
  maxSize: number;
  allowedTypes: string[];
  maxFiles?: number;
}

export interface FileUploadLimits {
  image: FileUploadConfig;
  document: FileUploadConfig;
  any: FileUploadConfig;
}

export type FileUploadType = 'image' | 'document' | 'any';
