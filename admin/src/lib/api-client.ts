import {
  LegalDocument,
  CreateLegalDocumentRequest,
  UpdateLegalDocumentRequest,
  ApiResponse,
  ValidationError,
  PaginationMeta,
  PaginatedResponse,
  TypedApiResponse,
} from './api-types';
import { logger } from '@/utils/logger';

export type { ApiResponse, ValidationError, PaginationMeta, PaginatedResponse, TypedApiResponse };

// File Upload Types
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

export interface FileUploadLimits {
  image: {
    maxSize: number;
    allowedTypes: string[];
    maxFiles: number;
  };
  document: {
    maxSize: number;
    allowedTypes: string[];
    maxFiles: number;
  };
  any: {
    maxSize: number;
    allowedTypes: string[];
    maxFiles: number;
  };
}

// User-friendly error messages mapping
const USER_FRIENDLY_ERRORS: Record<string, string> = {
  // Foreign key / constraint violations
  'FOREIGN KEY constraint failed': 'This item cannot be deleted because it is being used by other records.',
  'foreign key constraint failed': 'This item cannot be deleted because it is being used by other records.',
  'FOREIGN_KEY_CONSTRAINT': 'This item cannot be deleted because it is being used by other records.',
  'FOREIGN KEY CONSTRAINT': 'This item cannot be deleted because it is being used by other records.',
  'PQERR 23503': 'This item cannot be deleted because it is being used by other records.',
  'ER_NO_REFERENCED_ROW_2': 'This item cannot be deleted because it is being used by other records.',
  'ER_ROW_IS_REFERENCED_2': 'This item cannot be deleted because it is being used by other records.',

  // Unique constraint violations
  'UNIQUE constraint failed': 'A record with this value already exists.',
  'duplicate key': 'A record with this value already exists.',
  'ER_DUP_ENTRY': 'A record with this value already exists.',
  'ER_DUP_KEYNAME': 'A record with this value already exists.',

  // Not null violations
  'NOT NULL constraint failed': 'This field is required.',
  'null value': 'This field is required.',

  // Generic database errors
  'database error': 'A database error occurred. Please try again.',
  'prisma error': 'A database error occurred. Please try again.',
};

function getUserFriendlyError(error: any): string {
  // If the error has a structured error object from API, use its message
  if (error?.data?.error?.message) {
    return error.data.error.message;
  }

  // If the error has a direct message, check if it matches known patterns
  const message = error?.message || String(error);

  // Check for known error patterns
  for (const [pattern, friendlyMessage] of Object.entries(USER_FRIENDLY_ERRORS)) {
    if (message.toLowerCase().includes(pattern.toLowerCase())) {
      return friendlyMessage;
    }
  }

  // Return the original message if no match found
  return message;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;
  private onUnauthorized?: () => void;
  private loadingCallback?: (loading: boolean) => void;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  setOnUnauthorized(callback: () => void) {
    this.onUnauthorized = callback;
  }

  setLoadingCallback(callback: (loading: boolean) => void) {
    this.loadingCallback = callback;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & { skipLoading?: boolean; showLoading?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    const { skipLoading, showLoading, ...requestOptions } = options;
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(2, 15);

    logger.debug(`API request started: ${requestOptions.method || 'GET'} ${endpoint}`, {
      requestId,
      endpoint,
      method: requestOptions.method || 'GET',
      startTime,
    });

    // Only trigger loading state when explicitly requested (showLoading: true)
    // This prevents flashing when using React Query mutations with their own loading states
    const shouldShowLoading = showLoading === true && skipLoading !== true;
    if (this.loadingCallback && shouldShowLoading) {
      this.loadingCallback(true);
    }

    const url = `${this.baseURL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-platform': 'web',
      ...(requestOptions.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...requestOptions,
        headers,
      });

      // Handle non-JSON responses gracefully
      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // For non-JSON responses, create a generic error response
        const text = await response.text();
        data = {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: text || `HTTP ${response.status}: ${response.statusText}`
          }
        };
      }

      const duration = Date.now() - startTime;

      if (!response.ok) {
        // Handle 401 Unauthorized globally
        if (response.status === 401 && this.onUnauthorized) {
          this.onUnauthorized();
        }

        // Create a more informative error with user-friendly message
        const errorMessage = getUserFriendlyError({ message: data.error?.message || `HTTP ${response.status}: ${response.statusText}`, data });
        const error = new Error(errorMessage) as Error & { response?: Response; data?: any };
        error.response = response;
        error.data = data;

        logger.error(`API request failed: ${response.status} ${endpoint}`, {
          requestId,
          endpoint,
          method: requestOptions.method || 'GET',
          status: response.status,
          duration,
          error: errorMessage,
        });

        throw error;
      }

      // Ensure consistent response format
      if (!data.hasOwnProperty('success')) {
        // If the backend doesn't return a standardized response, wrap it
        logger.debug(`API request succeeded (wrapped response): ${endpoint}`, {
          requestId,
          endpoint,
          method: requestOptions.method || 'GET',
          duration,
        });

        return {
          success: true,
          data: data as T,
        } as ApiResponse<T>;
      }

      logger.debug(`API request succeeded: ${endpoint}`, {
        requestId,
        endpoint,
        method: requestOptions.method || 'GET',
        duration,
      });

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Handle network errors and other exceptions
      if (error instanceof TypeError && error.message.includes('fetch')) {
        logger.error('Network error occurred', {
          requestId,
          endpoint,
          method: requestOptions.method || 'GET',
          duration,
          error: error.message,
        });

        throw new Error('Network error: Unable to reach the server. Please check your connection.') as Error & { response?: Response; data?: any };
      }

      logger.error('API request failed with exception', {
        requestId,
        endpoint,
        method: requestOptions.method || 'GET',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      // Notify loading end - match the condition used for showing loading
      if (this.loadingCallback && shouldShowLoading) {
        this.loadingCallback(false);
      }
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>, options?: { skipLoading?: boolean }): Promise<ApiResponse<T>> {
    const defaultOptions = { skipLoading: true, ...options };
    if (params) {
      // Filter out null, undefined, and empty string values
      const filteredParams: Record<string, string> = {};
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          filteredParams[key] = String(value);
        }
      });

      const queryString = new URLSearchParams(filteredParams).toString();
      const url = queryString ? `${endpoint}?${queryString}` : endpoint;
      return this.request<T>(url, defaultOptions);
    }
    return this.request<T>(endpoint, defaultOptions);
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, options?: { skipLoading?: boolean }): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  async patch<T>(endpoint: string, data?: any, options?: { skipLoading?: boolean }): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  async uploadFile<T>(endpoint: string, file: File, fieldName: string = 'file'): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const formData = new FormData();
    formData.append(fieldName, file);

    const headers: Record<string, string> = {
      'x-platform': 'web',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle 401 Unauthorized globally
        if (response.status === 401 && this.onUnauthorized) {
          this.onUnauthorized();
        }
        const error = new Error(data.error?.message || `HTTP ${response.status}`);
        // Attach the full error data to the error object
        (error as any).error = data.error;
        throw error;
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  // Standardized file upload methods
  async uploadImage(file: File): Promise<ApiResponse<FileUploadResponse>> {
    return this.uploadFile<FileUploadResponse>('/upload/image', file, 'image');
  }

  async uploadMultipleImages(files: File[]): Promise<ApiResponse<MultipleFileUploadResponse>> {
    const url = `${this.baseURL}/upload/images`;
    const formData = new FormData();

    files.forEach(file => {
      formData.append('images', file);
    });

    const headers: Record<string, string> = {
      'x-platform': 'web',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && this.onUnauthorized) {
          this.onUnauthorized();
        }
        const error = new Error(data.error?.message || `HTTP ${response.status}`);
        (error as any).error = data.error;
        throw error;
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  async uploadDocument(file: File): Promise<ApiResponse<FileUploadResponse>> {
    return this.uploadFile<FileUploadResponse>('/upload/document', file, 'document');
  }

  async uploadAnyFile(file: File): Promise<ApiResponse<FileUploadResponse>> {
    return this.uploadFile<FileUploadResponse>('/upload/file', file, 'file');
  }

  async deleteFile(filePath: string): Promise<ApiResponse<null>> {
    return this.post<null>('/upload/delete', { path: filePath });
  }

  async getUploadLimits(): Promise<ApiResponse<FileUploadLimits>> {
    return this.get<FileUploadLimits>('/upload/limits');
  }

  // Legal Documents
  async getLegalDocuments(isAdmin: boolean = false): Promise<ApiResponse<LegalDocument[]>> {
    return this.get<LegalDocument[]>('/legal-documents', { isAdmin });
  }

  async getLegalDocument(id: string): Promise<ApiResponse<LegalDocument>> {
    return this.get<LegalDocument>(`/legal-documents/${id}`);
  }

  async createLegalDocument(data: CreateLegalDocumentRequest): Promise<ApiResponse<LegalDocument>> {
    return this.post<LegalDocument>('/legal-documents', data);
  }

  async updateLegalDocument(id: string, data: UpdateLegalDocumentRequest): Promise<ApiResponse<LegalDocument>> {
    return this.put<LegalDocument>(`/legal-documents/${id}`, data);
  }

  async deleteLegalDocument(id: string): Promise<ApiResponse<null>> {
    return this.delete<null>(`/legal-documents/${id}`);
  }

  // Location-related methods
  async getCityById(id: string): Promise<ApiResponse<any>> {
    return this.get(`/admin/granular-locations/cities/${id}`);
  }

  async getPostalCodeById(id: string): Promise<ApiResponse<any>> {
    return this.get(`/admin/granular-locations/postal-codes/${id}`);
  }

  // User-related methods
  async getUserCountByCriteria(criteria: {
    role?: 'user' | 'admin';
    isVerified?: boolean;
    locationId?: number;
    hasActiveAds?: boolean;
  }): Promise<ApiResponse<{ count: number }>> {
    return this.get<{ count: number }>('/admin/users/count', criteria);
  }
}

import { config } from '../config/environment';

export const apiClient = new ApiClient(config.api.url);
