import { useRouter } from 'expo-router';

/**
 * Smart navigation fallback utility for handling back button presses
 * when there's no navigation history available.
 *
 * This helps prevent the back button from silently failing when
 * the user lands directly on a page (e.g., deep links, push notifications)
 */
export function useBackNavigation(fallbackRoute?: string) {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Use provided fallback or default to home
      router.push(fallbackRoute || '/');
    }
  };

  return { goBack };
}

/**
 * Context-aware fallback routes for different page types
 * This ensures users are navigated to the most relevant page when back is unavailable
 */
export const FALLBACK_ROUTES = {
  // Ad-related pages
  AD_STATS: '/(tabs)/my-ads',
  EDIT_AD: '/(tabs)/my-ads',
  AD_BOOKINGS: '/(tabs)/my-ads',
  AD_BOOKING_DETAIL: '/(tabs)/my-ads',
  BOOKING_DETAIL: '/(pages)/my-bookings',

  // Search and discovery
  SEARCH_RESULTS: '/(tabs)/browse',

  // Booking flow
  BOOKING: '/(tabs)/browse',

  // Auth flow
  LOGIN: '/',
  REGISTER: '/',
  FORGOT_PASSWORD: '/(auth)/login',
  VERIFY_OTP: '/(auth)/login',
  COMPLETE_PROFILE: '/(tabs)/profile',

  // Profile and settings
  SETTINGS: '/(tabs)/profile',
  UPDATE_PROFILE: '/(tabs)/profile',
  CHANGE_PASSWORD: '/(tabs)/profile',
  NOTIFICATIONS: '/(tabs)/profile',

  // Default fallback
  DEFAULT: '/',
} as const;
