import * as Redis from 'redis';
import IORedis, { RedisOptions } from 'ioredis';
import { getRedisConfig } from '../config/redis.config';
import { config } from '../../config/environment';

let redisClient: Redis.RedisClientType | null = null;
let bullClient: IORedis | null = null;
let bullSubscriber: IORedis | null = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 2000;
const CONNECTION_TIMEOUT_MS = 10000;

/**
 * Classify a Redis error string. We can't reliably inspect the error
 * code from the `redis` v5 client (which surfaces them as strings), so
 * we match against the documented prefix of the wire reply.
 *
 * Returns one of:
 *  - `'readonly'` — server told us we're talking to a read-only replica
 *  - `'loading'`  — server is starting up and replaying AOF/RDB
 *  - `'noauth'`   — auth required (env-file password drift symptom)
 *  - `'masterdown'` — Sentinel lost contact with the current master
 *  - `'unavailable'` — generic transient failure
 */
export function classifyRedisError(err: unknown): 'readonly' | 'loading' | 'noauth' | 'masterdown' | 'unavailable' {
  const msg = err instanceof Error ? err.message : String(err);
  if (/^READONLY\b/i.test(msg)) return 'readonly';
  if (/^LOADING\b/i.test(msg)) return 'loading';
  if (/NOAUTH|WRONGPASS/i.test(msg)) return 'noauth';
  if (/MASTERDOWN/i.test(msg)) return 'masterdown';
  return 'unavailable';
}

/**
 * Some replies (e.g. a write against a replica) are NOT transient:
 * retrying immediately on the same connection will just keep failing.
 * We must force a fresh connection so the client re-resolves the
 * writable endpoint. Similarly, a LOADING reply means the server is
 * replaying its AOF/RDB dump and the current connection is unusable
 * until it finishes.
 */
function shouldReconnectBeforeRetry(kind: ReturnType<typeof classifyRedisError>): boolean {
  return kind === 'readonly' || kind === 'noauth' || kind === 'loading';
}

/**
 * Get shared Redis options for Bull queues to prevent connection bloat
 * Bull uses ioredis under the hood. By sharing connections, we reduce 
 * the total number of open sockets significantly.
 */
/**
 * Wire Bull's ioredis clients to recover from a READONLY/LOADING/NOAUTH/
 * MASTERDOWN reply without a process restart.
 *
 * These replies are NOT socket drops — Redis keeps the connection open and
 * tells the client it is talking to a read-only replica or a still-loading
 * server. ioredis surfaces the error to the command callback but would
 * otherwise never reconnect (the socket looks healthy). Bull's repeatable
 * scheduler then silently stops enqueueing the next tick, which wedges every
 * cron until the process is killed.
 *
 * `reconnectOnError` deliberately returns `true` (reconnect, drop the failed
 * command) rather than `2` (reconnect + retry the command): the failed command
 * is typically Bull's repeatable-job bookkeeping. Retrying it risks duplicate
 * job enqueues when the connection flips back to a writable master, so we let
 * the next cron tick re-attempt cleanly.
 */
export const getBullRedisOptions = () => {
  const redisConfig = getRedisConfig();
  const baseOptions: RedisOptions = {
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password || undefined,
    db: redisConfig.db,
    maxRetriesPerRequest: null, // Required by Bull
    enableReadyCheck: false,
    reconnectOnError(err: Error) {
      const kind = classifyRedisError(err);
      const shouldReconnect = shouldReconnectBeforeRetry(kind);
      if (shouldReconnect) {
        // Drop the stale connection so the next command re-resolves a
        // writable endpoint. Log at connection level for visibility.
        console.warn(
          `↻ Bull Redis client reconnecting after ${kind} reply: ${err.message}`
        );
      }
      return shouldReconnect ? true : false;
    },
    retryStrategy(times: number) {
      // Explicit socket-drop backoff so a Redis restart is self-healing too.
      return Math.min(Math.max(times, 0) * 1000, 10000);
    },
  };

  const attachErrorLogger = (client: IORedis, name: string) => {
    // ioredis would otherwise swallow these; surface them and reset on connect.
    client.on('error', (err: Error) => {
      const kind = classifyRedisError(err);
      console.error(`❌ Bull Redis ${name} error (${kind}):`, err.message);
    });
    client.on('reconnecting', () => {
      console.log(`🔄 Bull Redis ${name} reconnecting...`);
    });
  };

  return {
    createClient: (type: 'client' | 'subscriber' | 'bclient') => {
      switch (type) {
        case 'client':
          if (!bullClient) {
            bullClient = new IORedis(baseOptions);
            attachErrorLogger(bullClient, 'Client');
            console.log('✅ Shared Bull Redis Client created');
          }
          return bullClient;
        case 'subscriber':
          if (!bullSubscriber) {
            bullSubscriber = new IORedis(baseOptions);
            attachErrorLogger(bullSubscriber, 'Subscriber');
            console.log('✅ Shared Bull Redis Subscriber created');
          }
          return bullSubscriber;
        default:
          // bclient (blocking client) must be unique per queue/worker, but it
          // still inherits the self-healing options from baseOptions.
          return new IORedis(baseOptions);
      }
    }
  };
};

export const createRedisConnection = async (): Promise<Redis.RedisClientType> => {
  // Return existing connection if available and healthy
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    console.log('Redis connection already in progress...');
    // Wait for existing connection attempt
    await new Promise<void>((resolve) => {
      const checkConnection = setInterval(() => {
        if (!isConnecting && redisClient && redisClient.isOpen) {
          clearInterval(checkConnection);
          resolve();
        }
      }, 100);
      
      // Timeout after 15 seconds
      setTimeout(() => {
        clearInterval(checkConnection);
        resolve();
      }, 15000);
    });
    
    if (redisClient && redisClient.isOpen) {
      return redisClient;
    }
  }

  isConnecting = true;
  const config = getRedisConfig();

  try {
    redisClient = Redis.createClient({
      socket: {
        host: config.host,
        port: config.port,
        reconnectStrategy: (retries: number) => {
          if (retries >= MAX_RECONNECT_ATTEMPTS) {
            console.error(`❌ Redis: Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
            return new Error('Redis max reconnection attempts reached');
          }
          
          const delay = Math.min(retries * 1000, 10000);
          console.log(`🔄 Redis: Reconnecting attempt ${retries}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
          return delay;
        },
      },
      password: config.password,
      database: config.db,
    });

    // Event handlers
    redisClient.on('error', (err: Error) => {
      console.error('❌ Redis Client Error:', err.message);
      reconnectAttempts++;
      
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('❌ Redis: Too many connection errors, giving up');
      }
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis Client Connected');
      reconnectAttempts = 0;
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis Client Ready');
      reconnectAttempts = 0;
    });

    redisClient.on('end', () => {
      console.log('⚠️  Redis Client Disconnected');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis: Attempting to reconnect...');
    });

    // Connect with timeout
    await Promise.race([
      redisClient.connect(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), CONNECTION_TIMEOUT_MS)
      ),
    ]);

    // Verify connection health
    await redisClient.ping();
    
    console.log('✅ Redis connection established and verified');
    return redisClient;
  } catch (error) {
    console.error('❌ Failed to create Redis connection:', error);
    isConnecting = false;
    throw error;
  } finally {
    isConnecting = false;
  }
};

export const getRedisConnection = (): Redis.RedisClientType | null => {
  return redisClient;
};

/**
 * Get Redis client with automatic reconnection
 * Returns null if Redis is not available and skipIfUnavailable is true
 */
export const getRedisClientWithReconnect = async (
  skipIfUnavailable: boolean = false
): Promise<Redis.RedisClientType | null> => {
  try {
    if (redisClient && redisClient.isOpen) {
      return redisClient;
    }
    
    return await createRedisConnection();
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    
    if (skipIfUnavailable) {
      return null;
    }
    
    throw error;
  }
};

/**
 * Execute Redis command with error handling
 * Returns null if Redis is unavailable instead of throwing
 *
 * Now recognises the specific error classes that indicate a transient
 * or stale connection state (`READONLY`, `LOADING`, `NOAUTH`,
 * `MASTERDOWN`) and reconnects before retrying once. Generic errors
 * still go through the original reconnect-once path.
 */
export const executeRedisCommand = async <T>(
  command: () => Promise<T>,
  operationName: string = 'Redis operation'
): Promise<T | null> => {
  const tryOnce = async (): Promise<T | null> => {
    if (!redisClient || !redisClient.isOpen) {
      console.warn(`⚠️  Redis not available for ${operationName}`);
      return null;
    }
    return command();
  };

  try {
    return await tryOnce();
  } catch (error) {
    const kind = classifyRedisError(error);
    console.error(
      `❌ Redis ${operationName} failed (${kind}):`,
      error instanceof Error ? error.message : error
    );

    try {
      // For READONLY / NOAUTH the current connection is bound to a
      // wrong endpoint or wrong credentials — drop it before reconnecting.
      if (shouldReconnectBeforeRetry(kind)) {
        await closeRedisConnection();
      }
      await createRedisConnection();
      return await tryOnce();
    } catch (reconnectError) {
      console.error(
        `❌ Redis reconnection failed for ${operationName}:`,
        reconnectError instanceof Error ? reconnectError.message : reconnectError
      );
      return null;
    }
  }
};

// ── Scheduler liveness heartbeat ────────────────────────────────────
// The `sms-outbox-drain` cron runs every minute with no time gate, which
// makes it a perfect heartbeat for the whole Bull scheduler. The handler
// writes `now` here; `/health/ready` reads it and fails readiness when it's
// stale so the watchdog recreates a wedged API instead of serving traffic
// with dead crons.
export const SCHEDULER_HEARTBEAT_KEY = 'heartbeat:sms-outbox-drain';
export const SCHEDULER_HEARTBEAT_STALE_MS = 4 * 60 * 1000; // 4 min (4 missed ticks)
export const SCHEDULER_HEARTBEAT_WARMUP_SECONDS = 5 * 60;

/**
 * Decide whether the scheduler heartbeat is healthy.
 *
 * A missing/invalid heartbeat is represented by -1 and an unreadable Redis by
 * null. Both must fail after startup warmup. Treating -1 as an age previously
 * made an erased Bull database look healthy forever because -1 is never
 * greater than the stale threshold.
 */
export const isSchedulerHeartbeatHealthy = (
  heartbeatAgeMs: number | null,
  uptimeSeconds: number,
): boolean => {
  if (uptimeSeconds <= SCHEDULER_HEARTBEAT_WARMUP_SECONDS) {
    return true;
  }

  return heartbeatAgeMs !== null
    && heartbeatAgeMs >= 0
    && heartbeatAgeMs <= SCHEDULER_HEARTBEAT_STALE_MS;
};

/** Write the scheduler heartbeat. Best-effort: never throws. */
export const setSchedulerHeartbeat = async (key: string = SCHEDULER_HEARTBEAT_KEY): Promise<void> => {
  try {
    const client = await getRedisClientWithReconnect(true);
    if (!client) return;
    await client.set(key, String(Date.now()));
  } catch (error) {
    // A Redis blip here must never break the drain handler itself.
    console.warn(`⚠️  Could not write scheduler heartbeat:`, error instanceof Error ? error.message : error);
  }
};

/**
 * Return how stale (ms) the scheduler heartbeat is.
 * Returns `null` if Redis is unavailable we can't reach a verdict.
 * Returns `-1` if no heartbeat has ever been written yet.
 */
export const getSchedulerHeartbeatAgeMs = async (key: string = SCHEDULER_HEARTBEAT_KEY): Promise<number | null> => {
  try {
    const client = await getRedisClientWithReconnect(true);
    if (!client) return null;
    const raw = await client.get(key);
    if (!raw) return -1;
    const ts = Number(raw);
    if (!Number.isFinite(ts) || ts <= 0) return -1;
    return Date.now() - ts;
  } catch {
    return null;
  }
};

export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit();
      console.log('✅ Redis connection closed gracefully');
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error);
    } finally {
      redisClient = null;
    }
  }
};
