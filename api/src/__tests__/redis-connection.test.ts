/**
 * Tests for the Redis error classifier in `background/utils/redis-connection`.
 *
 * The classifier inspects the error string from the `redis` v5 client
 * (which surfaces replies as plain strings) and decides whether the
 * command should be retried after dropping the connection.
 */
import {
  classifyRedisError,
  isSchedulerHeartbeatHealthy,
  SCHEDULER_HEARTBEAT_STALE_MS,
  SCHEDULER_HEARTBEAT_WARMUP_SECONDS,
} from '../background/utils/redis-connection';

describe('classifyRedisError', () => {
  it('classifies READONLY errors (write against a replica)', () => {
    expect(classifyRedisError(new Error('READONLY You can\'t write against a read only replica.')))
      .toBe('readonly');
  });

  it('classifies READONLY even when uppercase-lower-cased differently', () => {
    expect(classifyRedisError('readonly foo bar')).toBe('readonly');
    expect(classifyRedisError('Readonly bar')).toBe('readonly');
  });

  it('classifies LOADING errors (Redis starting up)', () => {
    expect(classifyRedisError(new Error('LOADING Redis is loading the dataset in memory')))
      .toBe('loading');
  });

  it('classifies NOAUTH errors (env-file password drift)', () => {
    expect(classifyRedisError(new Error('NOAUTH Authentication required.'))).toBe('noauth');
  });

  it('classifies MASTERDOWN errors (Sentinel lost master)', () => {
    expect(classifyRedisError(new Error('MASTERDOWN Link with MASTER is down'))).toBe('masterdown');
  });

  it('falls back to unavailable for unknown errors', () => {
    expect(classifyRedisError(new Error('ECONNRESET'))).toBe('unavailable');
    expect(classifyRedisError(new Error('something else'))).toBe('unavailable');
  });

  it('accepts plain string errors (not just Error instances)', () => {
    expect(classifyRedisError('READONLY replica')).toBe('readonly');
    expect(classifyRedisError('NOAUTH required')).toBe('noauth');
  });

  it('returns unavailable for non-error values (e.g. undefined, null)', () => {
    expect(classifyRedisError(undefined)).toBe('unavailable');
    expect(classifyRedisError(null)).toBe('unavailable');
    expect(classifyRedisError(42)).toBe('unavailable');
  });
});

describe('isSchedulerHeartbeatHealthy', () => {
  const afterWarmup = SCHEDULER_HEARTBEAT_WARMUP_SECONDS + 1;

  it('allows a missing heartbeat only during startup warmup', () => {
    expect(isSchedulerHeartbeatHealthy(-1, 60)).toBe(true);
    expect(isSchedulerHeartbeatHealthy(-1, afterWarmup)).toBe(false);
  });

  it('fails closed when Redis is unreadable after warmup', () => {
    expect(isSchedulerHeartbeatHealthy(null, afterWarmup)).toBe(false);
  });

  it('accepts fresh heartbeats and rejects stale ones', () => {
    expect(isSchedulerHeartbeatHealthy(0, afterWarmup)).toBe(true);
    expect(isSchedulerHeartbeatHealthy(SCHEDULER_HEARTBEAT_STALE_MS, afterWarmup)).toBe(true);
    expect(isSchedulerHeartbeatHealthy(SCHEDULER_HEARTBEAT_STALE_MS + 1, afterWarmup)).toBe(false);
  });
});
