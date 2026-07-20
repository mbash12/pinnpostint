"use client";

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  VerifyResetOtpRequest,
  ResetPasswordRequest,
  ApiResponse,
  VerifyResetOtpResponse,
} from '@/lib/api-types';

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Forgot password
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (data: ForgotPasswordRequest) => {
      const response = await apiClient.post<ApiResponse<ForgotPasswordResponse>>('/auth/admin/password/forgot', data);
      return response;
    },
  });
}

// Verify reset OTP
export function useVerifyResetOtp() {
  return useMutation({
    mutationFn: async (data: VerifyResetOtpRequest) => {
      const response = await apiClient.post<ApiResponse<VerifyResetOtpResponse>>('/auth/admin/password/verify-reset-otp', data);
      return response;
    },
  });
}

// Reset password
export function useResetPassword() {
  return useMutation({
    mutationFn: async (data: ResetPasswordRequest) => {
      const response = await apiClient.post<ApiResponse>('/auth/admin/password/reset', data);
      return response;
    },
  });
}

// Change password
export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: ChangePasswordRequest) => {
      const response = await apiClient.put<ApiResponse>('/admin/change-password', data);
      return response;
    },
  });
}
