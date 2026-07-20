import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';

// Timeout configuration - increased to match nginx timeouts
const DEFAULT_TIMEOUT = config.server.nodeEnv === 'production' ? 120000 : 120000; // 120s prod, 120s dev
const SLOW_REQUEST_THRESHOLD = 10000; // 10 seconds - log slow requests

interface TimedRequest extends Request {
  startTime?: number;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Request timeout middleware
 * Terminates requests that exceed the timeout limit
 */
export const requestTimeout = (timeoutMs: number = DEFAULT_TIMEOUT) => {
  return (req: TimedRequest, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    req.startTime = startTime;
    
    let timeoutFired = false;
    
    // Set up timeout
    req.timeoutId = setTimeout(() => {
      timeoutFired = true;
      
      const duration = Date.now() - startTime;
      console.warn(
        `⏱️  Request Timeout: ${req.method} ${req.path} ` +
        `(${duration}ms, timeout: ${timeoutMs}ms)`
      );
      
      // Check if headers already sent
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: `Request timeout after ${timeoutMs}ms`,
            details: {
              duration,
              timeout: timeoutMs,
              path: req.path,
              method: req.method
            }
          }
        });
      }
    }, timeoutMs);
    
    // Clear timeout when response finishes
    res.on('finish', () => {
      if (req.timeoutId) {
        clearTimeout(req.timeoutId);
        req.timeoutId = undefined;
      }
      
      // Log slow requests
      if (!timeoutFired) {
        const duration = Date.now() - startTime;
        if (duration > SLOW_REQUEST_THRESHOLD) {
          console.warn(
            `🐌 Slow Request Detected: ${req.method} ${req.path} ` +
            `(${duration}ms)`
          );
        }
      }
    });
    
    // Handle errors
    res.on('error', () => {
      if (req.timeoutId) {
        clearTimeout(req.timeoutId);
        req.timeoutId = undefined;
      }
    });
    
    next();
  };
};

/**
 * Middleware to track request duration (for monitoring)
 */
export const requestTiming = (req: TimedRequest, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  req.startTime = startTime;
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    
    // Log request timing
    const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const logFn = console[logLevel === 'error' ? 'error' : 'log'];
    
    logFn(
      `📊 ${req.method} ${req.path} - ${status} (${duration}ms)`
    );
  });
  
  next();
};

/**
 * Timeout configuration for different route types
 */
export const timeoutConfig = {
  // Quick operations (authentication, lookups)
  quick: 10000,
  
  // Standard API requests
  standard: 30000,
  
  // File uploads
  upload: 120000,
  
  // Bulk operations
  bulk: 180000,
  
  // Report generation
  report: 300000,
};

/**
 * Route-specific timeout middleware factory
 */
export const routeTimeout = (type: keyof typeof timeoutConfig) => {
  return requestTimeout(timeoutConfig[type]);
};

export default { requestTimeout, requestTiming, timeoutConfig, routeTimeout };
