import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

// Database configuration
const DATABASE_CONNECTION_TIMEOUT = 10000; // 10 seconds
const DATABASE_REQUEST_TIMEOUT = 120000; // 120 seconds - increased to match API timeout
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;

let reconnectAttempts = 0;
let isConnecting = false;

// Create Prisma client with optimized connection pooling
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

// In development, reuse client to prevent connection exhaustion
const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

/**
 * Connect to database with retry logic
 */
export const connectDatabase = async (): Promise<void> => {
  if (isConnecting) {
    console.log('Database connection already in progress...');
    return;
  }

  isConnecting = true;

  try {
    await Promise.race([
      prisma.$connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database connection timeout')), DATABASE_CONNECTION_TIMEOUT)
      ),
    ]);
    
    reconnectAttempts = 0;
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = RECONNECT_DELAY_MS * reconnectAttempts;
      console.log(`🔄 Retrying database connection ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      await connectDatabase();
    } else {
      console.error('❌ Max database reconnection attempts reached');
      throw error;
    }
  } finally {
    isConnecting = false;
  }
};

/**
 * Execute database query with timeout and error handling
 */
export const executeDatabaseQuery = async <T>(
  query: () => Promise<T>,
  operationName: string = 'Database operation'
): Promise<T> => {
  try {
    // Ensure connection
    if (!prisma.$connect) {
      throw new Error('Database client not initialized');
    }

    // Execute with timeout
    return await Promise.race([
      query(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${operationName} timeout after ${DATABASE_REQUEST_TIMEOUT}ms`)), DATABASE_REQUEST_TIMEOUT)
      ),
    ]);
  } catch (error) {
    console.error(`❌ ${operationName} failed:`, error);
    
    // Attempt to reconnect on connection errors
    if (error instanceof Error && error.message.includes('connect')) {
      console.log('🔄 Attempting to reconnect to database...');
      await connectDatabase();
      return await query();
    }
    
    throw error;
  }
};

/**
 * Check database health
 */
export const checkDatabaseHealth = async (options?: { silent?: boolean }): Promise<boolean> => {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), 5000)
      ),
    ]);
    return true;
  } catch (error) {
    if (!options?.silent) {
      console.error('❌ Database health check failed:', error);
    }
    return false;
  }
};

/**
 * Disconnect and recreate Prisma client to free memory
 * Call this periodically or when memory usage is high
 */
export const refreshDatabaseConnection = async (): Promise<void> => {
  try {
    console.log('🔄 Refreshing database connection...');
    await prisma.$disconnect();
    
    // Small delay before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await prisma.$connect();
    console.log('✅ Database connection refreshed');
  } catch (error) {
    console.error('❌ Failed to refresh database connection:', error);
    throw error;
  }
};

// Graceful shutdown
process.on('beforeExit', async () => {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error disconnecting from database:', error);
  }
});

process.on('SIGINT', async () => {
  try {
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during SIGINT shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  try {
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during SIGTERM shutdown:', error);
    process.exit(1);
  }
});

export { prisma };
export default prisma;
