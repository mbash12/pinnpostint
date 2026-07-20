/**
 * Auth Context
 * Manages authentication state and provides auth methods to the app
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authService, User, LoginRequest, RegisterRequest, CompleteRegistrationRequest, VerifyOtpRequest, ForgotPasswordRequest, VerifyResetOtpRequest, ResetPasswordRequest } from '@/services/auth.service';
import { ApiError } from '@/services/api.service';
import { userService } from '@/services/user.service';
import { appEvents } from '@/utils/event-emitter';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isLoggingOut: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<{ otpId: string; expiresAt: string }>;
  verifyRegistrationOtp: (data: VerifyOtpRequest) => Promise<string>; // Returns tempToken
  completeRegistration: (data: CompleteRegistrationRequest, tempToken: string) => Promise<void>;
  forgotPassword: (data: ForgotPasswordRequest) => Promise<{ otpId: string; expiresAt: string }>;
  verifyResetOtp: (data: VerifyResetOtpRequest) => Promise<string>; // Returns resetToken
  resetPassword: (data: ResetPasswordRequest, resetToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  isLoginModalVisible: boolean;
  setLoginModalVisible: (visible: boolean) => void;
  isJustLoggedIn: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const loginTimestampRef = useRef<number | null>(null);

  // Helper function to check if user just logged in (within last 2 seconds)
  const isJustLoggedIn = () => {
    if (loginTimestampRef.current === null) return false;
    return Date.now() - loginTimestampRef.current < 2000;
  };

  // Check if user is already logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Listen for unauthorized events from API service
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setError('Session expired. Please login again.');
      setIsLoginModalVisible(false);
      // Only clear login timestamp if user didn't just log in
      // This prevents immediate login popup after successful login due to temporary 401 errors
      if (!isJustLoggedIn()) {
        loginTimestampRef.current = null;
      }
    };

    // Subscribe to logout events from API service
    const unsubscribe = appEvents.on('auth:logout', handleUnauthorized);
    return unsubscribe;
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const isAuth = await authService.isAuthenticated();

      if (isAuth) {
        // Try to get fresh profile data first, fall back to basic user data
        try {
          const profileResponse = await userService.getProfile();
          if (profileResponse.success && profileResponse.data) {
            setUser(profileResponse.data);
          } else {
            // Fallback to basic user data
            const userData = await authService.getUser();
            setUser(userData);
          }
        } catch (profileError: any) {

          // If it's a 401 error, the API service will handle logout
          if (profileError.status === 401) {
            setUser(null);
            setError('Session expired. Please login again.');
            setIsLoginModalVisible(false);
          } else {
            // For other errors, fallback to basic user data
            const userData = await authService.getUser();
            setUser(userData);
          }
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: LoginRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authService.login(data);

      if (response.success && response.data) {
        setUser(response.data.user);
        // Set login timestamp to prevent immediate modal for 2 seconds
        loginTimestampRef.current = Date.now();
        setIsLoginModalVisible(false);
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (err: any) {
      const apiError = err as ApiError;
      const errorMessage = apiError.message || 'Login failed. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authService.register(data);

      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (err: any) {
      const apiError = err as ApiError;
      const errorMessage = apiError.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyRegistrationOtp = async (data: VerifyOtpRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authService.verifyRegistrationOtp(data);

      if (response.success && response.data) {
        return response.data.tempToken;
      } else {
        throw new Error(response.message || 'OTP verification failed');
      }
    } catch (err: any) {
      const apiError = err as ApiError;
      const errorMessage = apiError.message || 'OTP verification failed. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const completeRegistration = async (data: CompleteRegistrationRequest, tempToken: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authService.completeRegistration(data, tempToken);

      if (response.success && response.data) {
        setUser(response.data.user);
        // Set login timestamp for registration too
        loginTimestampRef.current = Date.now();
        setIsLoginModalVisible(false);
      } else {
        throw new Error(response.message || 'Registration completion failed');
      }
    } catch (err: any) {
      const apiError = err as ApiError;
      const errorMessage = apiError.message || 'Registration completion failed. Please try again.';
      setError(errorMessage);
      throw err; // Throw the full error object, not just message
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (data: ForgotPasswordRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authService.forgotPassword(data);

      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Password reset request failed');
      }
    } catch (err: any) {
      const apiError = err as ApiError;
      const errorMessage = apiError.message || 'Password reset request failed. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyResetOtp = async (data: VerifyResetOtpRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authService.verifyResetOtp(data);

      if (response.success && response.data) {
        return response.data.resetToken;
      } else {
        throw new Error(response.message || 'OTP verification failed');
      }
    } catch (err: any) {
      const apiError = err as ApiError;
      const errorMessage = apiError.message || 'OTP verification failed. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (data: ResetPasswordRequest, resetToken: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authService.resetPassword(data, resetToken);

      if (!response.success) {
        throw new Error(response.message || 'Password reset failed');
      }
    } catch (err: any) {
      const apiError = err as ApiError;
      const errorMessage = apiError.message || 'Password reset failed. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoggingOut(true);
      setIsLoading(true);
      await authService.logout();
      setUser(null);
      loginTimestampRef.current = null;
      setIsLoginModalVisible(false);
    } catch (err) {
    } finally {
      setIsLoading(false);
      setIsLoggingOut(false);
    }
  };

  const refreshUser = async () => {
    try {
      // Try to get fresh profile data first, fall back to basic user data
      try {
        const profileResponse = await userService.getProfile();
        if (profileResponse.success && profileResponse.data) {
          setUser(profileResponse.data);
        } else {
          // Fallback to basic user data
          const userData = await authService.getUser();
          setUser(userData);
        }
      } catch (profileError: any) {

        // If it's a 401 error, the API service will handle logout
        if (profileError.status === 401) {
          setUser(null);
          setError('Session expired. Please login again.');
        } else {
          // For other errors, fallback to basic user data
          const userData = await authService.getUser();
          setUser(userData);
        }
      }
    } catch (err) {
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isLoggingOut,
    login,
    register,
    verifyRegistrationOtp,
    completeRegistration,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    logout,
    refreshUser,
    error,
    clearError,
    isLoginModalVisible,
    setLoginModalVisible: (visible: boolean) => {
      // Allow showing modal if:
      // 1. It's being closed (visible = false), OR
      // 2. User didn't just log in (more than 2 seconds ago)
      if (!visible || !isJustLoggedIn()) {
        setIsLoginModalVisible(visible);
      }
    },
    isJustLoggedIn,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  // Return undefined instead of throwing error to handle initial render
  // This allows components to gracefully wait for the provider to be ready
  return context as AuthContextType;
}
