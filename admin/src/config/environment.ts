/**
 * Admin Panel Environment Configuration
 * Validates and exports environment variables with type safety
 */

// Environment validation schema
interface EnvironmentConfig {
  // API Configuration
  api: {
    url: string;
    version: string;
  };

  // Application Configuration
  app: {
    name: string;
    version: string;
    description: string;
  };

  // Authentication Configuration
  auth: {
    storageKey: string;
    userStorageKey: string;
  };

  // File Upload Configuration
  upload: {
    maxFileSize: number;
    allowedImageTypes: string[];
    allowedDocumentTypes: string[];
    maxImagesPerUpload: number;
  };

  // Pagination Configuration
  pagination: {
    defaultPageSize: number;
    maxPageSize: number;
  };

  // Feature Flags
  features: {
    analytics: boolean;
    bulkOperations: boolean;
    notifications: boolean;
    fileManagement: boolean;
    outbox: boolean;
  };

  // Development Configuration
  development: {
    debugMode: boolean;
    logLevel: string;
  };

  // External Services
  external: {
    googleMapsApiKey?: string;
    mapProvider: 'google' | 'osm';
    osm: {
      nominatimBaseUrl: string;
      tileUrl: string;
      attribution: string;
    };
  };

  // Theme Configuration
  theme: {
    defaultTheme: string;
    storageKey: string;
  };

  // Security Configuration
  security: {
    sessionTimeout: number;
    autoLogoutWarning: number;
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
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Helper function to parse array environment variables
const parseArray = (value: string | undefined, defaultValue: string[] = []): string[] => {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(Boolean);
};

// const DEFAULT_API_URL = 'http://localhost:3001/api/v1';
const DEFAULT_API_URL = 'https://api.pinnpost.com/api/v1';

const isEnvVarMissing = (value: string | undefined) => {
  if (typeof value !== 'string') return true;
  return value.trim().length === 0;
};

const resolveEnvVar = (value: string | undefined, fallback: string): string => {
  if (isEnvVarMissing(value)) {
    return fallback;
  }
  return value!.trim(); // Type assertion is safe here because we checked it's not missing
};

// Validate required environment variables
const validateRequiredEnvVars = () => {
  const required = ['NEXT_PUBLIC_API_URL'];
  const missing = required.filter(key => isEnvVarMissing(process.env[key]));

  if (missing.length > 0) {
    const message = `Missing environment variables: ${missing.join(', ')}. Using defaults.`;
    // Warning: ${message}
    // App will use default values - this is not a critical error
  }
};

// Validate environment variables
validateRequiredEnvVars();

// Export validated configuration
export const config: EnvironmentConfig = {
  // API Configuration
  api: {
    url: resolveEnvVar(process.env.NEXT_PUBLIC_API_URL, DEFAULT_API_URL),
    version: process.env.NEXT_PUBLIC_API_VERSION || 'v1',
  },

  // Application Configuration
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Pin N Post Admin Panel',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Administrative interface for Pin N Post platform',
  },

  // Authentication Configuration
  auth: {
    storageKey: process.env.NEXT_PUBLIC_AUTH_STORAGE_KEY || 'pinnpost_admin_auth_token',
    userStorageKey: process.env.NEXT_PUBLIC_USER_STORAGE_KEY || 'pinnpost_admin_user_data',
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseNumber(process.env.NEXT_PUBLIC_MAX_FILE_SIZE, 5242880), // 5MB
    allowedImageTypes: parseArray(process.env.NEXT_PUBLIC_ALLOWED_IMAGE_TYPES, ['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    allowedDocumentTypes: parseArray(process.env.NEXT_PUBLIC_ALLOWED_DOCUMENT_TYPES, ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    maxImagesPerUpload: parseNumber(process.env.NEXT_PUBLIC_MAX_IMAGES_PER_UPLOAD, 10),
  },

  // Pagination Configuration
  pagination: {
    defaultPageSize: parseNumber(process.env.NEXT_PUBLIC_DEFAULT_PAGE_SIZE, 20),
    maxPageSize: parseNumber(process.env.NEXT_PUBLIC_MAX_PAGE_SIZE, 100),
  },

  // Feature Flags
  features: {
    analytics: parseBoolean(process.env.NEXT_PUBLIC_ENABLE_ANALYTICS, true),
    bulkOperations: parseBoolean(process.env.NEXT_PUBLIC_ENABLE_BULK_OPERATIONS, true),
    notifications: parseBoolean(process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS, true),
    fileManagement: parseBoolean(process.env.NEXT_PUBLIC_ENABLE_FILE_MANAGEMENT, true),
    outbox: parseBoolean(process.env.NEXT_PUBLIC_OUTBOX, false),
  },

  // Development Configuration
  development: {
    debugMode: parseBoolean(process.env.NEXT_PUBLIC_DEBUG_MODE, false),
    logLevel: process.env.NEXT_PUBLIC_LOG_LEVEL || 'info',
  },

  // External Services
  external: {
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    mapProvider: (process.env.NEXT_PUBLIC_MAP_PROVIDER as 'google' | 'osm') || 'osm',
    osm: {
      nominatimBaseUrl: process.env.NEXT_PUBLIC_OSM_NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org',
      tileUrl: process.env.NEXT_PUBLIC_OSM_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: process.env.NEXT_PUBLIC_OSM_ATTRIBUTION || '&copy; OpenStreetMap contributors',
    },
  },

  // Theme Configuration
  theme: {
    defaultTheme: process.env.NEXT_PUBLIC_DEFAULT_THEME || 'light',
    storageKey: process.env.NEXT_PUBLIC_THEME_STORAGE_KEY || 'pinnpost_admin_theme',
  },

  // Security Configuration
  security: {
    sessionTimeout: parseNumber(process.env.NEXT_PUBLIC_SESSION_TIMEOUT, 3600000), // 1 hour
    autoLogoutWarning: parseNumber(process.env.NEXT_PUBLIC_AUTO_LOGOUT_WARNING, 300000), // 5 minutes
  },
};

// Helper functions for common checks
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isProduction = () => process.env.NODE_ENV === 'production';

// Helper function to get API URL with version
export const getApiUrl = (endpoint: string = '') => {
  const baseUrl = config.api.url;
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
export const isValidFileType = (file: File, type: 'image' | 'document' | 'any'): boolean => {
  const allowedTypes = type === 'image'
    ? config.upload.allowedImageTypes
    : type === 'document'
      ? config.upload.allowedDocumentTypes
      : [...config.upload.allowedImageTypes, ...config.upload.allowedDocumentTypes];

  return allowedTypes.includes(file.type);
};

// Helper function to validate file size
export const isValidFileSize = (file: File): boolean => {
  return file.size <= config.upload.maxFileSize;
};

export default config;