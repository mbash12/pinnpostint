import winston from 'winston';
import path from 'path';
import { config } from '../config/environment';

// Define log levels
const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
  },
};

winston.addColors(logLevels.colors);

// Log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Console transport
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
});

// File transport for errors
const errorFileTransport = new winston.transports.File({
  filename: path.join(config.logging.file.replace('.log', '-error.log')),
  level: 'error',
  maxsize: 5242880, // 5MB
  maxFiles: 5,
});

// File transport for all logs
const fileTransport = new winston.transports.File({
  filename: config.logging.file,
  maxsize: 5242880, // 5MB
  maxFiles: 5,
});

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  levels: logLevels.levels,
  transports: [
    consoleTransport,
    fileTransport,
    errorFileTransport,
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

/**
 * Log HTTP request
 */
export const logHttpRequest = (
  method: string,
  url: string,
  statusCode: number,
  durationMs: number,
  userId?: string
) => {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'http';
  
  logger.log(level, `${method} ${url} - ${statusCode} (${durationMs}ms)`, {
    method,
    url,
    statusCode,
    duration: durationMs,
    userId,
  });
};

/**
 * Log database query
 */
export const logDatabaseQuery = (
  query: string,
  durationMs: number,
  error?: Error
) => {
  if (error) {
    logger.error(`Database query failed: ${query}`, {
      error: error.message,
      stack: error.stack,
      duration: durationMs,
    });
  } else if (durationMs > 1000) {
    logger.warn(`Slow database query (${durationMs}ms): ${query}`);
  } else {
    logger.debug(`Database query (${durationMs}ms): ${query}`);
  }
};

/**
 * Log Redis operation
 */
export const logRedisOperation = (
  operation: string,
  key?: string,
  error?: Error
) => {
  if (error) {
    logger.error(`Redis operation failed: ${operation}`, {
      error: error.message,
      key,
    });
  } else {
    logger.debug(`Redis ${operation}: ${key || 'no key'}`);
  }
};

/**
 * Log background job event
 */
export const logJobEvent = (
  jobType: string,
  jobId: string,
  event: 'queued' | 'started' | 'completed' | 'failed' | 'retrying',
  details?: any
) => {
  const message = `Job ${jobId} (${jobType}) ${event}`;
  
  if (event === 'failed') {
    logger.error(message, details);
  } else if (event === 'completed') {
    logger.info(message, details);
  } else {
    logger.debug(message, details);
  }
};

/**
 * Log authentication event
 */
export const logAuthEvent = (
  event: 'login' | 'logout' | 'signup' | 'token_refresh' | 'failed_login',
  userId?: string,
  details?: any
) => {
  const message = `Auth event: ${event}${userId ? ` for user ${userId}` : ''}`;
  
  if (event === 'failed_login') {
    logger.warn(message, details);
  } else {
    logger.info(message, details);
  }
};

/**
 * Log payment event
 */
export const logPaymentEvent = (
  event: 'payment_initiated' | 'payment_success' | 'payment_failed' | 'refund',
  paymentId: string,
  amount?: number,
  error?: Error
) => {
  const message = `Payment ${event}: ${paymentId}${amount ? ` (${amount})` : ''}`;
  
  if (error || event === 'payment_failed') {
    logger.error(message, {
      error: error?.message,
      stack: error?.stack,
    });
  } else {
    logger.info(message);
  }
};

/**
 * Log file upload
 */
export const logFileUpload = (
  filename: string,
  size: number,
  mimetype: string,
  userId?: string
) => {
  logger.info(`File uploaded: ${filename} (${(size / 1024).toFixed(2)} KB)`, {
    filename,
    size,
    mimetype,
    userId,
  });
};

/**
 * Log notification sent
 */
export const logNotification = (
  type: 'push' | 'sms' | 'email',
  recipient: string,
  success: boolean,
  error?: Error
) => {
  const message = `Notification ${type} ${success ? 'sent' : 'failed'}: ${recipient}`;
  
  if (!success) {
    logger.error(message, {
      error: error?.message,
      stack: error?.stack,
    });
  } else {
    logger.debug(message);
  }
};

/**
 * Log circuit breaker event
 */
export const logCircuitBreaker = (
  service: string,
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN',
  details?: any
) => {
  const message = `Circuit breaker [${service}] state: ${state}`;
  
  if (state === 'OPEN') {
    logger.error(message, details);
  } else if (state === 'HALF_OPEN') {
    logger.warn(message, details);
  } else {
    logger.info(message, details);
  }
};

/**
 * Log memory warning
 */
export const logMemoryWarning = (
  heapUsed: number,
  heapTotal: number,
  rss: number
) => {
  const usagePercent = ((heapUsed / heapTotal) * 100).toFixed(2);
  
  logger.warn(`High memory usage: ${usagePercent}% (Used: ${(heapUsed / 1024 / 1024).toFixed(0)}MB, Total: ${(heapTotal / 1024 / 1024).toFixed(0)}MB, RSS: ${(rss / 1024 / 1024).toFixed(0)}MB)`);
};

/**
 * Create child logger for a specific module
 */
export const createChildLogger = (module: string) => {
  return logger.child({ module });
};

export { logger };
export default logger;
