/**
 * API Configuration
 * Central configuration for API endpoints and settings
 */

import { config, getApiUrl } from './environment';

// API Base URL from environment configuration
export const API_BASE_URL = config.api.baseUrl;

// API Endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    REGISTER: '/auth/register',
    VERIFY_REGISTRATION_OTP: '/auth/registration/verify-otp',
    COMPLETE_REGISTRATION: '/auth/registration/complete',
    LOGIN: '/auth/login',
    FORGOT_PASSWORD: '/auth/password/forgot',
    VERIFY_RESET_OTP: '/auth/password/verify-reset-otp',
    RESET_PASSWORD: '/auth/password/reset',
  },
  
  // User
  USER: {
    ME: '/users/me',
    UPDATE_ME: '/users/me',
    UPDATE_FCM_TOKEN: '/users/me/fcm-token',
    CHANGE_PASSWORD: '/users/change-password',
    LOCATIONS: '/users/me/locations',
    LOCATION: (id: string) => `/users/me/locations/${id}`,
    WISHLIST: '/users/me/wishlist',
    WISHLIST_ITEM: (adId: string) => `/users/me/wishlist/${adId}`,
    NOTIFICATIONS: '/users/me/notifications',
    NOTIFICATION: (id: string) => `/users/me/notifications/${id}`,
    MARK_ALL_READ: '/users/me/notifications/mark-all-read',
    NOTIFICATION_PREFERENCES: '/users/me/notification-preferences',
  },
  
  // Recent Locations
  RECENT_LOCATIONS: '/user/recent-locations',
  
  // User Ads
  USER_ADS: {
    BASE: '/users/me/ads',
    DETAIL: (adId: string) => `/users/me/ads/${adId}`,
    STATS: (adId: string) => `/users/me/ads/${adId}/stats`,
  },
  
  // Public Ad Stats
  AD_STATS: {
    RECORD_VIEW: (adId: string) => `/public/ads/${adId}/view`,
    RECORD_SHARE: (adId: string) => `/public/ads/${adId}/share`,
    NOTIFY_RENEWAL_INTEREST: (adId: string) => `/public/ads/${adId}/notify-renewal-interest`,
  },
  
  // Public
  PUBLIC: {
    ADS: '/public/ads',
    AD_DETAIL: (adSlug: string) => `/public/ads/slug/${adSlug}`,
    USER: (userId: string) => `/public/users/${userId}`,
    USER_ADS: (userId: string) => `/public/users/${userId}/ads`,
    USER_STATS: (userId: string) => `/public/users/${userId}/stats`,
    CATEGORIES: '/public/categories',
    FEATURED_ADS: '/public/ads/featured',
    RECOMMENDED_ADS: '/public/ads/recommended',
    CATEGORY_DETAIL: (categoryId: string) => `/public/categories/${categoryId}`,
    CATEGORY_SUBCATEGORIES: (categoryId: string) => `/public/categories/${categoryId}/subcategories`,
    CATEGORY_AD_TYPES: (categoryId: string) => `/public/categories/${categoryId}/ad-types`,
    SUBCATEGORY_ATTRIBUTES: (subcategoryId: string) => `/public/subcategories/${subcategoryId}/attributes`,
    CATEGORY_ATTRIBUTES: (categoryId: string) => `/public/categories/${categoryId}/attributes`,
    LOCATIONS: '/public/locations',
    STATES: '/public/states',
    CITIES: '/public/cities',
    POSTAL_CODES: '/public/postal-codes',
    ATTRIBUTES: '/public/attributes',
    SEARCH: '/public/search',
  },
  
  // Bookings
  BOOKINGS: {
    BASE: '/bookings',
    DETAIL: (bookingId: string) => `/bookings/${bookingId}`,
    UPDATE_STATUS: (bookingId: string) => `/bookings/${bookingId}/status`,
    CONFIRM: (bookingId: string) => `/bookings/${bookingId}/confirm`,
    REJECT: (bookingId: string) => `/bookings/${bookingId}/reject`,
    CANCEL: (bookingId: string) => `/bookings/${bookingId}/cancel`,
    COMPLETE: (bookingId: string) => `/bookings/${bookingId}/complete`,
    USER_OUTGOING: '/users/me/bookings/outgoing',
    USER_INCOMING: '/users/me/bookings/incoming',
  },
  
  // Payments
  PAYMENTS: {
    PLANS: '/payments/plans',
    SUBSCRIPTIONS: '/payments/subscriptions',
    SUBSCRIPTION: (subscriptionId: string) => `/payments/subscriptions/${subscriptionId}`,
  },
  
  // Blog
  BLOG: {
    BASE: '/blogs',
    DETAIL: (blogId: string) => `/blogs/${blogId}`,
  },
  
  // FAQs
  FAQS: {
    BASE: '/public/faqs',
    DETAIL: (faqId: string) => `/public/faqs/${faqId}`,
    CATEGORIES: '/public/faq-categories',
  },
  
  // Legal / Settings
  LEGAL: {
    DOCUMENT_BY_SLUG: (slug: string) => `/legal-documents/slug/${slug}`,
  },
  // Chat
  CHAT: {
    CONVERSATIONS: '/chat/conversations',
    INITIATE: '/chat/initiate',
    MESSAGES: (conversationId: string) => `/chat/conversations/${conversationId}/messages`,
    SEND_MESSAGE: '/chat/messages',
    MARK_READ: (conversationId: string) => `/chat/conversations/${conversationId}/read`,
    UNREAD_COUNT: '/chat/unread-count',
  },
  SETTINGS: {
    PUBLIC: '/public/settings',
    SYSTEM: '/public/system-settings',
  },
} as const;

// API Configuration from environment
export const API_CONFIG = {
  TIMEOUT: config.api.timeout,
  RETRY_ATTEMPTS: config.performance.retryAttempts,
  RETRY_DELAY: config.performance.retryDelay,
} as const;

// Storage Keys from environment
export const STORAGE_KEYS = {
  AUTH_TOKEN: config.auth.storageKey,
  USER_DATA: config.auth.userStorageKey,
  FCM_TOKEN: config.auth.fcmTokenKey,
} as const;
