/**
 * URL Utility for handling device-specific URL transformations
 * Primarily used to convert localhost URLs for Android emulators (AVD)
 */

import { Platform } from 'react-native';

/**
 * Check if we should enable URL transformation for development
 * Set this to false to disable the feature globally
 */
const ENABLE_URL_TRANSFORM = __DEV__;

/**
 * Convert localhost URLs for Android emulator
 * Android emulators use 10.0.2.2 to access host's localhost
 */
export const transformImageUrl = (url: string): string => {
  // Skip if disabled
  if (!ENABLE_URL_TRANSFORM) return url;

  // Only transform on Android
  if (Platform.OS !== 'android') return url;

  // Skip if URL is empty or not a string
  if (!url || typeof url !== 'string') return url;

  // Skip if it's already an absolute URL (not localhost)
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) return url;

  // Replace localhost and 127.0.0.1 with 10.0.2.2 for Android emulator
  return url
    .replace(/https?:\/\/localhost/g, 'http://10.0.2.2')
    .replace(/https?:\/\/127\.0\.0\.1/g, 'http://10.0.2.2');
};

/**
 * Batch transform an array of image URLs
 */
export const transformImageUrls = (urls: string[]): string[] => {
  return urls.map(transformImageUrl);
};

/**
 * Transform image URL in an object (for ad images, etc.)
 * Looks for common image properties and transforms them
 */
export const transformObjectImages = <T extends Record<string, any>>(obj: T): T => {
  if (!obj || typeof obj !== 'object') return obj;

  const result = { ...obj };

  // Common image property names
  const imageKeys = ['image', 'imageUrl', 'imageUrl', 'coverImage', 'avatar', 'photo'];

  // Transform single image properties
  imageKeys.forEach(key => {
    if (result[key] && typeof result[key] === 'string') {
      result[key] = transformImageUrl(result[key]);
    }
  });

  // Transform images array if it exists
  if (result.images && Array.isArray(result.images)) {
    result.images = transformImageUrls(result.images);
  }

  return result;
};

/**
 * Transform array of objects with images (for ad lists, etc.)
 */
export const transformObjectsImages = <T extends Record<string, any>>(objects: T[]): T[] => {
  return objects.map(transformObjectImages);
};

export default transformImageUrl;
