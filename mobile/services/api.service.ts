/**
 * API Service
 * Core HTTP client for making API requests
 */

import { Platform } from 'react-native';
import { API_BASE_URL, API_CONFIG, STORAGE_KEYS } from '@/config/api.config';
import { appEvents } from '@/utils/event-emitter';
import { storageHelper } from '@/utils/storage.helper';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: ValidationError[];
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: ValidationError[];
}

class ApiService {
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = API_BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
  }

  /**
   * Get authentication token from storage
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      return await storageHelper.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Build headers for API requests
   */
  private async buildHeaders(customHeaders?: Record<string, string>): Promise<HeadersInit> {
    // Determine platform for push notifications
    const platform = Platform.OS === 'web' ? 'web' :
                     Platform.OS === 'ios' ? 'ios' : 'android';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-platform': platform,
      ...customHeaders,
    };

    const token = await this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    let data: any;
    if (isJson) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Handle 401 Unauthorized - clear auth data and trigger logout
      if (response.status === 401) {
        await this.handleUnauthorized();
      }

      throw {
        message: data?.error?.message || data?.message || 'An error occurred',
        status: response.status,
        code: data?.error?.code,
        details: data?.error?.details,
      } as ApiError;
    }

    // Return the response as-is since API now returns standardized format
    return data;
  }

  /**
   * Handle 401 Unauthorized responses
   */
  private async handleUnauthorized(): Promise<void> {
    try {
      // Clear auth data from storage
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.USER_DATA
      ]);
      
      // Emit logout event for auth context to handle
      appEvents.emit('auth:logout', { reason: 'unauthorized' });
    } catch (error) {
    }
  }

  /**
   * Make HTTP request with timeout
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `${this.baseURL}${endpoint}`;
      const headers = await this.buildHeaders(options.headers as Record<string, string>);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return await this.handleResponse<T>(response);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw {
          message: 'Request timeout',
          status: 408,
        } as ApiError;
      }

      if (error.message && error.status) {
        throw error as ApiError;
      }

      throw {
        message: error.message || 'Network error',
        status: 0,
      } as ApiError;
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    let url = endpoint;
    
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return this.request<T>(url, {
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Upload file with multipart/form-data
   */
  async upload<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const token = await this.getAuthToken();
    const platform = Platform.OS === 'web' ? 'web' :
                     Platform.OS === 'ios' ? 'ios' : 'android';
    
    // Use Headers constructor which is more robust for multipart/form-data on some platforms
    const headers = new Headers();
    headers.append('x-platform', platform);

    if (token) {
      headers.append('Authorization', `Bearer ${token}`);
    }

    // Increased timeout for uploads (5 minutes instead of 30 seconds)
    const uploadTimeout = 300000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), uploadTimeout);

    try {
      const url = `${this.baseURL}${endpoint}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return await this.handleResponse<T>(response);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw {
          message: 'Upload request timeout after 5 minutes',
          status: 408,
        } as ApiError;
      }

      // If it's a network request failed error, it might be due to various reasons on Android
      if (error.message === 'Network request failed' && Platform.OS === 'android') {
        throw {
          message: 'Network request failed. This may be due to a large file size, unstable connection, or server reachability issues on Android. If using a real device, ensure your computer IP is used instead of localhost.',
          status: 0,
        } as ApiError;
      }

      throw {
        message: error.message || 'Upload failed',
        status: error.status || 0,
      } as ApiError;
    }
  }
}

// Export class and singleton instance
export { ApiService };
export const apiService = new ApiService();
export default apiService;
