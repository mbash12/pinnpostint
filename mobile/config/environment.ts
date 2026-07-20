/**
 * Mobile App Environment Configuration
 * Validates and exports environment variables with type safety
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Environment validation schema
interface EnvironmentConfig {
  // API Configuration
  api: {
    baseUrl: string;
    version: string;
    timeout: number;
  };

  // Application Configuration
  app: {
    name: string;
    version: string;
    description: string;
  };

  // Environment
  env: {
    nodeEnv: string;
    expoEnv: string;
  };

  // Authentication Configuration
  auth: {
    storageKey: string;
    userStorageKey: string;
    fcmTokenKey: string;
    defaultCountryCode: string;
  };

  // File Upload Configuration
  upload: {
    maxFileSize: number;
    allowedImageTypes: string[];
    maxImagesPerAd: number;
    imageQuality: number;
    imageMaxWidth: number;
    imageMaxHeight: number;
  };

  // Pagination Configuration
  pagination: {
    defaultPageSize: number;
    maxPageSize: number;
  };

  // Feature Flags
  features: {
    pushNotifications: boolean;
    locationServices: boolean;
    cameraUpload: boolean;
    galleryUpload: boolean;
    offlineMode: boolean;
  };

  // Development Configuration
  development: {
    debugMode: boolean;
    logLevel: string;
    enableFlipper: boolean;
  };

  // External Services
  external: {
    googleMapsApiKey?: string;
    firebaseConfigPath?: string;
  };

  // Performance Configuration
  performance: {
    cacheTimeout: number;
    retryAttempts: number;
    retryDelay: number;
  };

  // Security Configuration
  security: {
    sessionTimeout: number;
    autoLogoutWarning: number;
    biometricAuthEnabled: boolean;
  };

  // Analytics Configuration
  analytics: {
    enabled: boolean;
    debug: boolean;
  };

  // Contact Configuration
  contact: {
    customerCareEmail: string;
  };
}

// Helper function to parse boolean environment variables
const parseBoolean = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

// Helper function to parse number environment variables
const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Helper function to parse array environment variables
const parseArray = (value: string | undefined, defaultValue: string[] = []): string[] => {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(Boolean);
};

// Get environment variables from process.env or Constants.expoConfig.extra
const getEnvVar = (key: string): string | undefined => {
  // If key already starts with EXPO_PUBLIC_, don't add it again
  const hasPrefix = key.startsWith('EXPO_PUBLIC_');
  const expoKey = hasPrefix ? key : `EXPO_PUBLIC_${key}`;
  const rawKey = hasPrefix ? key.replace('EXPO_PUBLIC_', '') : key;

  // Try various combinations in Constants.expoConfig.extra
  const extra = Constants.expoConfig?.extra;
  if (extra) {
    if (extra[expoKey]) return extra[expoKey];
    if (extra[key]) return extra[key];
    if (extra[rawKey]) return extra[rawKey];
  }

  // Then try process.env
  if (process.env[expoKey]) return process.env[expoKey];
  if (process.env[key]) return process.env[key];
  if (process.env[rawKey]) return process.env[rawKey];

  return undefined;
};

// Helper function to get the appropriate API base URL based on platform
const getApiBaseUrl = (): string => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    getEnvVar('API_BASE_URL') ||
    'http://localhost:3001/api/v1';

  // If running on Android (AVD/emulator), replace localhost with 10.0.2.2
  if (Platform.OS === 'android' && baseUrl.includes('localhost')) {
    return baseUrl.replace('localhost', '10.0.2.2');
  }

  return baseUrl;
};

// Validate required environment variables
const validateRequiredEnvVars = () => {
  const required = ['API_BASE_URL'];
  const missing = required.filter(key => !getEnvVar(key));

  if (missing.length > 0) {
  }
};

// Validate environment variables
validateRequiredEnvVars();

// Export validated configuration
export const config: EnvironmentConfig = {
  // API Configuration
  api: {
    baseUrl: getApiBaseUrl(),
    version: getEnvVar('API_VERSION') || 'v1',
    timeout: parseNumber(getEnvVar('API_TIMEOUT'), 30000),
  },

  // Application Configuration
  app: {
    name: getEnvVar('APP_NAME') || 'Pin N Post',
    version: getEnvVar('APP_VERSION') || '1.0.0',
    description: getEnvVar('APP_DESCRIPTION') || 'Pin N Post Mobile Application',
  },

  // Environment
  env: {
    nodeEnv: getEnvVar('NODE_ENV') || 'development',
    expoEnv: getEnvVar('EXPO_PUBLIC_ENV') || 'development',
  },

  // Authentication Configuration
  auth: {
    storageKey: getEnvVar('AUTH_STORAGE_KEY') || 'pinnpost_auth_token',
    userStorageKey: getEnvVar('USER_STORAGE_KEY') || 'pinnpost_user_data',
    fcmTokenKey: getEnvVar('FCM_TOKEN_KEY') || 'pinnpost_fcm_token',
    defaultCountryCode: getEnvVar('DEFAULT_COUNTRY_CODE') || '+1',
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseNumber(getEnvVar('MAX_FILE_SIZE'), 5242880), // 5MB
    allowedImageTypes: parseArray(getEnvVar('ALLOWED_IMAGE_TYPES'), ['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    maxImagesPerAd: parseNumber(getEnvVar('MAX_IMAGES_PER_AD'), 10),
    imageQuality: parseNumber(getEnvVar('IMAGE_QUALITY'), 0.8),
    imageMaxWidth: parseNumber(getEnvVar('IMAGE_MAX_WIDTH'), 1920),
    imageMaxHeight: parseNumber(getEnvVar('IMAGE_MAX_HEIGHT'), 1920),
  },

  // Pagination Configuration
  pagination: {
    defaultPageSize: parseNumber(getEnvVar('DEFAULT_PAGE_SIZE'), 20),
    maxPageSize: parseNumber(getEnvVar('MAX_PAGE_SIZE'), 50),
  },

  // Feature Flags
  features: {
    pushNotifications: parseBoolean(getEnvVar('ENABLE_PUSH_NOTIFICATIONS'), true),
    locationServices: parseBoolean(getEnvVar('ENABLE_LOCATION_SERVICES'), true),
    cameraUpload: parseBoolean(getEnvVar('ENABLE_CAMERA_UPLOAD'), true),
    galleryUpload: parseBoolean(getEnvVar('ENABLE_GALLERY_UPLOAD'), true),
    offlineMode: parseBoolean(getEnvVar('ENABLE_OFFLINE_MODE'), false),
  },

  // Development Configuration
  development: {
    debugMode: parseBoolean(getEnvVar('DEBUG_MODE'), false),
    logLevel: getEnvVar('LOG_LEVEL') || 'info',
    enableFlipper: parseBoolean(getEnvVar('ENABLE_FLIPPER'), false),
  },

  // External Services
  external: {
    googleMapsApiKey: getEnvVar('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'),
    firebaseConfigPath: getEnvVar('FIREBASE_CONFIG_PATH'),
  },

  // Performance Configuration
  performance: {
    cacheTimeout: parseNumber(getEnvVar('CACHE_TIMEOUT'), 300000), // 5 minutes
    retryAttempts: parseNumber(getEnvVar('RETRY_ATTEMPTS'), 3),
    retryDelay: parseNumber(getEnvVar('RETRY_DELAY'), 1000),
  },

  // Security Configuration
  security: {
    sessionTimeout: parseNumber(getEnvVar('SESSION_TIMEOUT'), 3600000), // 1 hour
    autoLogoutWarning: parseNumber(getEnvVar('AUTO_LOGOUT_WARNING'), 300000), // 5 minutes
    biometricAuthEnabled: parseBoolean(getEnvVar('BIOMETRIC_AUTH_ENABLED'), true),
  },

  // Analytics Configuration
  analytics: {
    enabled: parseBoolean(getEnvVar('ENABLE_ANALYTICS'), false),
    debug: parseBoolean(getEnvVar('ANALYTICS_DEBUG'), false),
  },

  // Contact Configuration
  contact: {
    customerCareEmail: getEnvVar('CUSTOMER_CARE_EMAIL') || 'info@pinnpost.com',
  },
};

// Helper functions for common checks
export const isDevelopment = () => config.env.nodeEnv === 'development';
export const isProduction = () => config.env.nodeEnv === 'production';
export const __DEV__ = isDevelopment();

// Helper function to get API URL with endpoint
export const getApiUrl = (endpoint: string = '') => {
  const baseUrl = config.api.baseUrl;
  return endpoint ? `${baseUrl}${endpoint}` : baseUrl;
};

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (feature: keyof typeof config.features) => {
  return config.features[feature];
};

// Helper function to format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to validate file type
export const isValidImageType = (mimeType: string): boolean => {
  return config.upload.allowedImageTypes.includes(mimeType);
};

// Helper function to validate file size
export const isValidFileSize = (size: number): boolean => {
  return size <= config.upload.maxFileSize;
};

// Helper function to get storage keys
export const getStorageKeys = () => ({
  authToken: config.auth.storageKey,
  userData: config.auth.userStorageKey,
  fcmToken: config.auth.fcmTokenKey,
});

// Helper function to format phone number with country code
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';

  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');

  // Return the cleaned phone number without adding country code or +
  return cleanPhone;
};

export default config;