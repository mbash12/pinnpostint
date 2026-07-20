import { getRedisClientWithReconnect, executeRedisCommand } from '../background/utils/redis-connection';

/**
 * Redis Cache Service
 * Provides caching utilities for expensive operations
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
  namespace?: string; // Namespace for grouping caches
}

const DEFAULT_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'pinnpost:cache:';

/**
 * Generate cache key from namespace and identifiers
 */
export function generateCacheKey(namespace: string, ...args: (string | number)[]): string {
  const key = args.join(':');
  return `${CACHE_PREFIX}${namespace}:${key}`;
}

/**
 * Get value from cache
 * @param key - Cache key
 * @returns Cached value or null if not found/error
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClientWithReconnect(true);
    if (!client) {
      return null; // Redis not available, skip cache
    }

    const cached = await client.get(key);
    if (!cached) {
      return null;
    }

    return JSON.parse(cached) as T;
  } catch (error) {
    console.error(`❌ Cache GET failed for key ${key}:`, error);
    return null; // Return null on error, don't break the app
  }
}

/**
 * Set value in cache
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttl - Time to live in seconds (default: 5 minutes)
 * @returns true if successful
 */
export async function setInCache<T>(
  key: string,
  value: T,
  ttl: number = DEFAULT_TTL
): Promise<boolean> {
  try {
    const client = await getRedisClientWithReconnect(true);
    if (!client) {
      return false; // Redis not available
    }

    await client.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`❌ Cache SET failed for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete value from cache
 * @param key - Cache key
 * @returns true if deleted
 */
export async function deleteFromCache(key: string): Promise<boolean> {
  try {
    const client = await getRedisClientWithReconnect(true);
    if (!client) {
      return false;
    }

    await client.del(key);
    return true;
  } catch (error) {
    console.error(`❌ Cache DELETE failed for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete multiple keys matching a pattern
 * @param pattern - Key pattern (e.g., 'pinnpost:cache:analytics:*')
 * @returns Number of keys deleted
 */
export async function deleteCacheByPattern(pattern: string): Promise<number> {
  try {
    const client = await getRedisClientWithReconnect(true);
    if (!client) {
      return 0;
    }

    const keys = await client.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }

    await client.del(keys);
    return keys.length;
  } catch (error) {
    console.error(`❌ Cache DELETE BY PATTERN failed for pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Get or set cache with fallback function
 * @param key - Cache key
 * @param fallback - Function to execute if cache miss
 * @param ttl - Time to live in seconds
 * @returns Cached value or result of fallback function
 */
export async function getOrSetCache<T>(
  key: string,
  fallback: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  // Try to get from cache
  const cached = await getFromCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss, execute fallback
  const result = await fallback();

  // Set cache
  await setInCache(key, result, ttl);

  return result;
}

/**
 * Cache middleware factory for express routes
 * @param options - Cache options
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  const { ttl = DEFAULT_TTL, prefix = '', namespace = 'api' } = options;

  return async (req: any, res: any, next: any) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL and query params
    const cacheKey = generateCacheKey(
      namespace,
      prefix,
      req.path.replace(/\//g, '-'),
      JSON.stringify(req.query)
    );

    // Try to get from cache
    const cached = await getFromCache(cacheKey);
    if (cached !== null) {
      return res.json(cached);
    }

    // Cache miss, continue to route handler
    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = (data: any) => {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setInCache(cacheKey, data, ttl).catch(err => {
          console.error('Failed to cache response:', err);
        });
      }
      return originalJson.call(res, data);
    };

    next();
  };
}

/**
 * Invalidate analytics cache
 * Call this when data changes that affects analytics
 */
export async function invalidateAnalyticsCache(): Promise<void> {
  const patterns = [
    'pinnpost:cache:analytics:*',
    'pinnpost:cache:dashboard:*',
    'pinnpost:cache:admin:analytics:*'
  ];

  let totalDeleted = 0;
  for (const pattern of patterns) {
    const deleted = await deleteCacheByPattern(pattern);
    totalDeleted += deleted;
  }

  console.log(`🗑️  Invalidated ${totalDeleted} analytics cache entries`);
}

/**
 * Invalidate user-related cache
 */
export async function invalidateUserCache(userId?: string): Promise<void> {
  if (userId) {
    await deleteCacheByPattern(`pinnpost:cache:users:*${userId}*`);
  } else {
    await deleteCacheByPattern('pinnpost:cache:users:*');
  }
}

/**
 * Invalidate ad-related cache
 */
export async function invalidateAdCache(adId?: string): Promise<void> {
  if (adId) {
    await deleteCacheByPattern(`pinnpost:cache:ads:*${adId}*`);
  } else {
    await deleteCacheByPattern('pinnpost:cache:ads:*');
  }
}

/**
 * Cache service namespace helpers
 */
export const CacheNamespace = {
  ANALYTICS: 'analytics',
  DASHBOARD: 'dashboard',
  USERS: 'users',
  ADS: 'ads',
  LOCATIONS: 'locations',
  CATEGORIES: 'categories',
  SETTINGS: 'settings',
} as const;

export default {
  getFromCache,
  setInCache,
  deleteFromCache,
  deleteCacheByPattern,
  getOrSetCache,
  cacheMiddleware,
  invalidateAnalyticsCache,
  invalidateUserCache,
  invalidateAdCache,
  generateCacheKey,
  CacheNamespace,
};
