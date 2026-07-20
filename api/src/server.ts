import v8 from 'v8';
import App from './app';
import { config } from './config/environment';

// Create the application instance
const app = new App();

// Track if shutdown is in progress to prevent multiple calls
let isShuttingDown = false;

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);

  // Attempt graceful shutdown on uncaught exceptions
  if (!isShuttingDown) {
    console.error('Initiating emergency shutdown due to uncaught exception...');
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);

  // Attempt graceful shutdown on unhandled rejections
  if (!isShuttingDown) {
    console.error('Initiating emergency shutdown due to unhandled rejection...');
    gracefulShutdown('UNHANDLED_REJECTION');
  }
});

// Memory and performance monitoring
const MEMORY_CHECK_INTERVAL = 60000; // 60 seconds - reduced frequency
const MEMORY_USAGE_THRESHOLD = 0.90; // 90% - trigger GC later
const MEMORY_CRITICAL_THRESHOLD = 0.95; // 95% - critical warning
const MAX_RESTART_COUNT = 3;
const RESTART_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

let restartCount = 0;
let lastRestartTime = Date.now();
let consecutiveHighMemoryWarnings = 0;

function checkMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();
  const heapSizeLimit = heapStats.heap_size_limit;

  // Calculate ratio based on true heap limit, not currently allocated heapTotal
  const heapUsedRatio = memoryUsage.heapUsed / heapSizeLimit;
  const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
  const heapLimitMB = heapSizeLimit / 1024 / 1024;
  const rssMB = memoryUsage.rss / 1024 / 1024;

  // Critical memory warning
  if (heapUsedRatio > MEMORY_CRITICAL_THRESHOLD) {
    consecutiveHighMemoryWarnings++;
    console.error(
      `🚨 CRITICAL: High memory usage: ${(heapUsedRatio * 100).toFixed(2)}% ` +
      `(Used: ${heapUsedMB.toFixed(2)}MB, Limit: ${heapLimitMB.toFixed(2)}MB, RSS: ${rssMB.toFixed(0)}MB)`
    );

    // Trigger garbage collection immediately if in extreme state
    if (typeof (global as any).gc === 'function') {
      console.log('🗑️  Triggering immediate garbage collection...');
      (global as any).gc();
    }

    // Trigger restart if consecutive warnings exceed threshold
    if (consecutiveHighMemoryWarnings >= 10) {
      console.error('🚨 Too many consecutive high memory warnings. Initiating restart...');
      consecutiveHighMemoryWarnings = 0;
      process.exit(1); // Force restart by process manager (PM2/Docker)
    }
  } else if (heapUsedRatio > MEMORY_USAGE_THRESHOLD) {
    consecutiveHighMemoryWarnings = 0; // Reset counter
    console.warn(
      `⚠️  High memory usage detected: ${(heapUsedRatio * 100).toFixed(2)}% ` +
      `(Used: ${heapUsedMB.toFixed(2)}MB, Limit: ${heapLimitMB.toFixed(2)}MB)`
    );

    // Trigger garbage collection if available
    if (typeof (global as any).gc === 'function') {
      console.log('🗑️  Triggering garbage collection...');
      (global as any).gc();
    }
  } else {
    consecutiveHighMemoryWarnings = 0; // Reset counter when memory is healthy
  }

  // Only log if ratio > 50% to reduce log spam
  if (heapUsedRatio > 0.5) {
    console.log(
      `📊 Memory: ${heapUsedMB.toFixed(0)}MB/${heapLimitMB.toFixed(0)}MB Limit (${(heapUsedRatio * 100).toFixed(1)}%), RSS: ${rssMB.toFixed(0)}MB`
    );
  }
}

// Start periodic memory monitoring
const memoryMonitor = setInterval(checkMemoryUsage, MEMORY_CHECK_INTERVAL);

// Memory cleanup interval - disconnect/reconnect services periodically
const MEMORY_CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes - increased from 5
const memoryCleanup = setInterval(async () => {
  try {
    const memoryUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const heapRatio = memoryUsage.heapUsed / heapStats.heap_size_limit;

    // Only cleanup if memory is above 85%
    if (heapRatio > 0.85) {
      console.log('🧹 Running memory cleanup...');

      // Close idle database connections
      const { refreshDatabaseConnection } = await import('./utils/database');
      await refreshDatabaseConnection();

      // Close idle Redis connections
      const { closeRedisConnection, createRedisConnection } = await import('./background/utils/redis-connection');
      await closeRedisConnection();
      await createRedisConnection();

      const newUsage = process.memoryUsage();
      console.log(`✅ Memory cleanup complete: ${(newUsage.heapUsed / 1024 / 1024).toFixed(0)}MB used`);
    }
  } catch (error) {
    console.error('❌ Memory cleanup failed:', error);
  }
}, MEMORY_CLEANUP_INTERVAL);

// Track restart frequency to detect crash loops
function trackRestart() {
  const now = Date.now();

  if (now - lastRestartTime < RESTART_WINDOW_MS) {
    restartCount++;
    if (restartCount >= MAX_RESTART_COUNT) {
      console.error(
        `🚨 Crash loop detected: ${restartCount} restarts in ` +
        `${(now - lastRestartTime) / 1000} seconds. Not restarting.`
      );
      process.exit(1);
    }
  } else {
    restartCount = 1;
    lastRestartTime = now;
  }
}

// Graceful shutdown with timeout
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    console.log('⏳ Shutdown already in progress, ignoring signal:', signal);
    return;
  }

  isShuttingDown = true;
  console.log(`\n📴 ${signal} received. Starting graceful shutdown...`);

  // Stop memory monitoring and cleanup
  clearInterval(memoryMonitor);
  clearInterval(memoryCleanup);

  const shutdownTimeout = setTimeout(() => {
    console.error('❌ Shutdown timeout exceeded. Forcing exit.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // Close HTTP server
    console.log('🔄 Closing HTTP server...');

    // Shutdown background jobs
    console.log('🔄 Shutting down background job system...');
    await app.shutdown();

    // Close database connections
    console.log('🔄 Closing database connections...');
    const { prisma } = await import('./utils/database');
    await prisma.$disconnect();

    // Close Redis connections
    console.log('🔄 Closing Redis connections...');
    const { closeRedisConnection } = await import('./background/utils/redis-connection');
    await closeRedisConnection();

    clearTimeout(shutdownTimeout);
    console.log('✅ Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle process warnings
process.on('warning', (warning) => {
  console.warn('⚠️  Process Warning:', warning.name, warning.message);
  if (warning.stack) {
    console.warn(warning.stack);
  }
});

// Prevent process from exiting on certain errors (optional - use with caution)
// Only for non-critical errors in production
if (config.server.nodeEnv === 'production') {
  process.on('uncaughtException', (err: Error) => {
    // Log error but don't exit for certain recoverable errors
    if (err.message.includes('EPIPE') || err.message.includes('ECONNRESET')) {
      console.warn('⚠️  Recoverable network error:', err.message);
      return;
    }
  });
}

// Start the server
async function startServer() {
  try {
    console.log('🚀 Starting PinNPost API Server...');
    console.log(`📦 Environment: ${config.server.nodeEnv}`);
    console.log(`🌍 Port: ${config.server.port}`);
    console.log(`📦 API Version: ${config.server.apiVersion}`);

    await app.listen();

    // Reset restart counter on successful start
    restartCount = 0;

    console.log('✅ Server started successfully');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    trackRestart();
    process.exit(1);
  }
}

// Start the application
startServer();
