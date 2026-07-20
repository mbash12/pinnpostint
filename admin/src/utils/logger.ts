/**
 * Enhanced logging utility for the application
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, any>;
}

class Logger {
  private readonly enabled: boolean;
  private readonly level: LogLevel;

  constructor() {
    // Check if logging is enabled based on environment
    this.enabled = process.env.NODE_ENV !== 'production' || 
                  process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
    
    // Set log level based on environment
    this.level = this.getLogLevel();
  }

  private getLogLevel(): LogLevel {
    const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL?.toLowerCase();
    switch (envLevel) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;

    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(entry: LogEntry): string {
    const { timestamp, level, message, meta } = entry;
    const formattedMeta = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${formattedMeta}`;
  }

  private log(level: LogLevel, message: string, meta?: Record<string, any>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    };

    const formattedMessage = this.formatMessage(entry);

    // Removed console output for production
    // In a real application, you might want to send logs to a logging service
    // instead of or in addition to console output
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string | Error, meta?: Record<string, any>): void {
    if (message instanceof Error) {
      this.log(LogLevel.ERROR, message.message, {
        ...meta,
        stack: message.stack,
        name: message.name,
      });
    } else {
      this.log(LogLevel.ERROR, message, meta);
    }
  }

  // Method to create a child logger with additional metadata
  child(meta: Record<string, any>): Logger {
    const childLogger = new Logger();
    // Override the log method to include parent metadata
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: LogLevel, message: string, childMeta?: Record<string, any>) => {
      originalLog(level, message, { ...meta, ...childMeta });
    };
    return childLogger;
  }
}

// Create a singleton instance
export const logger = new Logger();

// Export a function to initialize logging with custom configuration
export function initLogger(options?: { level?: LogLevel; enabled?: boolean }): void {
  // This would typically be used to override default configuration
  // For now, we'll just log the initialization
  logger.info('Logger initialized', { options });
}

export default logger;