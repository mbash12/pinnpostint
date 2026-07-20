"use client";

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse, PaginatedResponse } from '@/lib/api-types';

const QUERY_KEYS = {
  wishlists: ['wishlists'] as const,
  wishlistsByAd: ['wishlists', 'by-ad'] as const,
  wishlistsByUser: ['wishlists', 'by-user'] as const,
};

interface WishlistByAd {
  adId: string;
  adTitle: string;
  adImage: string | null;
  adPrice: number;
  wishlistCount: number;
  category: string;
  addedThisWeek: number;
}

interface WishlistByUser {
  userId: string;
  userName: string;
  userAvatar: string | null;
  wishlistCount: number;
  lastActivity: string;
  joinedDate: string;
}

// Get all wishlists (admin view)
export function useWishlists(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.wishlists, params],
    queryFn: async () => {
      // Note: This endpoint needs to be added to the backend
      const response = await apiClient.get<PaginatedResponse<any>>('/admin/wishlists', params);
      return response;
    },
  });
}

// Get wishlists grouped by ad
export function useWishlistsByAd(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.wishlistsByAd, params],
    queryFn: async () => {
      // Note: This endpoint needs to be added to the backend
      const response = await apiClient.get<ApiResponse<WishlistByAd[]>>('/admin/wishlists/by-ad', params);
      return response;
    },
  });
}

// Get wishlists grouped by user
export function useWishlistsByUser(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.wishlistsByUser, params],
    queryFn: async () => {
      // Note: This endpoint needs to be added to the backend
      const response = await apiClient.get<ApiResponse<WishlistByUser[]>>('/admin/wishlists/by-user', params);
      return response;
    },
  });
}
