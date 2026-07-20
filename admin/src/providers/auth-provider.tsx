"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { User, LoginRequest, LoginResponse, ApiResponse } from '@/lib/api-types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (token && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          apiClient.setToken(token);

          // Validate token by making a request to get current user
          const response = await apiClient.get('/auth/admin/profile');

          if (response.success && response.data) {
            setUser(response.data as User);
            // Update stored user with fresh data
            localStorage.setItem(USER_KEY, JSON.stringify(response.data));
          } else {
            throw new Error('Token validation failed');
          }
        } catch (error: any) {
          // Check if the error is due to user not being an admin or having their role changed
          // If the error message contains "User not found", "Admin not found", or "Access denied",
          // it means the user exists but doesn't have admin privileges
          if (error.message && (
            error.message.includes('User not found') ||
            error.message.includes('Admin not found') ||
            error.message.includes('Access denied')
          )) {
            // Non-admin user attempted to access admin panel or user role has changed. Logging out.
          }

          // Clear invalid token and user
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          apiClient.setToken(null);
          setUser(null);
        }
      }

      setIsLoading(false);
    };

    validateToken();
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      const response: ApiResponse<LoginResponse> = await apiClient.post('/auth/admin/login', credentials);

      if (response.success && response.data) {
        const { token, user: userData, expiresAt } = response.data;

        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));

        apiClient.setToken(token);
        setUser(userData);
      } else {
        throw new Error(response.error?.message || 'Login failed');
      }
    } catch (error) {
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    apiClient.setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    // Register global 401 handler
    apiClient.setOnUnauthorized(logout);
  }, [logout]);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
  }, []);

  const value: AuthContextType = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
  }), [user, isLoading, login, logout, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
