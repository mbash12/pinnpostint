import { RedisConfig } from '../interfaces/config.interface';

export const getRedisConfig = (): RedisConfig => {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
  };
};

export const getRedisUrl = (): string => {
  // First try to use REDIS_URL directly if available
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  
  // Fall back to building URL from individual config
  const config = getRedisConfig();
  const auth = config.password ? `:${config.password}@` : '';
  return `redis://${auth}${config.host}:${config.port}/${config.db}`;
};