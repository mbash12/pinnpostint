/**
 * Authentication Service
 * Handles all authentication-related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_ENDPOINTS, STORAGE_KEYS } from '@/config/api.config';
import { storageHelper } from '@/utils/storage.helper';

export interface User {
  id: string;
  phone: string;
  email?: string;
  firstName: string;
  lastName?: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  isActive: boolean;
  isVerified: boolean;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  profile?: UserProfile;
}

export interface UserProfile {
  bio?: string;
  address?: string;
  city?: {
    id: string;
    name: string;
  };
  state?: {
    id: string;
    name: string;
  };
  country?: string;
  postalCodeId?: string;
  cityId?: string;
  stateId?: string;
  postalCode?: {
    id: string;
    code: string;
  };
  dob?: string;
  gender?: string;
  // Notification preferences
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  bookingNotifications: boolean;
  adStatusNotifications: boolean;
  systemNotifications: boolean;
  promotionNotifications: boolean;
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  expiresAt: string;
}

export interface RegisterRequest {
  phone: string;
}

export interface RegisterResponse {
  otpId: string;
  expiresAt: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

export interface VerifyOtpResponse {
  tempToken: string;
}

export interface CompleteRegistrationRequest {
  firstName: string;
  lastName?: string;
  password: string;
  email?: string;
}

export interface CompleteRegistrationResponse {
  token: string;
  user: User;
  expiresAt: string;
}

export interface ForgotPasswordRequest {
  phone: string;
}

export interface ForgotPasswordResponse {
  otpId: string;
  expiresAt: string;
}

export interface VerifyResetOtpRequest {
  phone: string;
  otp: string;
}

export interface VerifyResetOtpResponse {
  resetToken: string;
}

export interface ResetPasswordRequest {
  newPassword: string;
}

export interface ResetPasswordResponse {
  message?: string;
}

class AuthService {
  /**
   * Save authentication token
   */
  async saveToken(token: string): Promise<void> {
    try {
      await storageHelper.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    } catch (error) {
      console.error('Error saving token:', error);
      throw error;
    }
  }

  /**
   * Get authentication token
   */
  async getToken(): Promise<string | null> {
    try {
      return await storageHelper.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  /**
   * Remove authentication token
   */
  async removeToken(): Promise<void> {
    try {
      await storageHelper.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Error removing token:', error);
      throw error;
    }
  }

  /**
   * Save user data
   */
  async saveUser(user: User): Promise<void> {
    try {
      await storageHelper.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    } catch (error) {
      console.error('Error saving user data:', error);
      throw error;
    }
  }

  /**
   * Get user data
   */
  async getUser(): Promise<User | null> {
    try {
      const userData = await storageHelper.getItem(STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  /**
   * Remove user data
   */
  async removeUser(): Promise<void> {
    try {
      await storageHelper.removeItem(STORAGE_KEYS.USER_DATA);
    } catch (error) {
      console.error('Error removing user data:', error);
      throw error;
    }
  }

  /**
   * Login with phone number and password
   */
  async login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await apiService.post<LoginResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      data
    );

    if (response.success && response.data) {
      await this.saveToken(response.data.token);
      await this.saveUser(response.data.user);
    }

    return response;
  }

  /**
   * Start registration process (send OTP)
   */
  async register(data: RegisterRequest): Promise<ApiResponse<RegisterResponse>> {
    return apiService.post<RegisterResponse>(
      API_ENDPOINTS.AUTH.REGISTER,
      data
    );
  }

  /**
   * Verify registration OTP
   */
  async verifyRegistrationOtp(data: VerifyOtpRequest): Promise<ApiResponse<VerifyOtpResponse>> {
    return apiService.post<VerifyOtpResponse>(
      API_ENDPOINTS.AUTH.VERIFY_REGISTRATION_OTP,
      data
    );
  }

  /**
   * Complete registration
   */
  async completeRegistration(
    data: CompleteRegistrationRequest,
    tempToken: string
  ): Promise<ApiResponse<CompleteRegistrationResponse>> {
    // Set temporary token for this request
    const originalToken = await this.getToken();
    await this.saveToken(tempToken);

    try {
      const response = await apiService.post<CompleteRegistrationResponse>(
        API_ENDPOINTS.AUTH.COMPLETE_REGISTRATION,
        data
      );

      if (response.success && response.data) {
        await this.saveToken(response.data.token);
        await this.saveUser(response.data.user);
      } else {
        // Restore original token if request failed
        if (originalToken) {
          await this.saveToken(originalToken);
        } else {
          await this.removeToken();
        }
      }

      return response;
    } catch (error) {
      // Restore original token on error
      if (originalToken) {
        await this.saveToken(originalToken);
      } else {
        await this.removeToken();
      }
      throw error;
    }
  }

  /**
   * Request password reset (send OTP)
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<ApiResponse<ForgotPasswordResponse>> {
    return apiService.post<ForgotPasswordResponse>(
      API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
      data
    );
  }

  /**
   * Verify password reset OTP
   */
  async verifyResetOtp(data: VerifyResetOtpRequest): Promise<ApiResponse<VerifyResetOtpResponse>> {
    return apiService.post<VerifyResetOtpResponse>(
      API_ENDPOINTS.AUTH.VERIFY_RESET_OTP,
      data
    );
  }

  /**
   * Reset password
   */
  async resetPassword(
    data: ResetPasswordRequest,
    resetToken: string
  ): Promise<ApiResponse<ResetPasswordResponse>> {
    // Set reset token for this request
    const originalToken = await this.getToken();
    await this.saveToken(resetToken);

    try {
      const response = await apiService.post<ResetPasswordResponse>(
        API_ENDPOINTS.AUTH.RESET_PASSWORD,
        data
      );

      // Restore original token after password reset
      if (originalToken) {
        await this.saveToken(originalToken);
      } else {
        await this.removeToken();
      }

      return response;
    } catch (error) {
      // Restore original token on error
      if (originalToken) {
        await this.saveToken(originalToken);
      } else {
        await this.removeToken();
      }
      throw error;
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    await this.removeToken();
    await this.removeUser();
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
