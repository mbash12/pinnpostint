/**
 * Tests for the `smsOutboxDrainHandler` background job handler.
 *
 * Verifies that the handler:
 *  - delegates to drainOutbox with the supplied batchSize
 *  - logs a summary including scanned/sent/failed/exhausted
 *  - emits a warning with outbox stats when rows hit maxAttempts
 */
import { smsOutboxDrainHandler } from '../background/handlers/sms-outbox-drain.handler';

const mockDrainOutbox = jest.fn();
const mockGetOutboxStats = jest.fn();

jest.mock('../utils/smsOutbox', () => ({
  drainOutbox: (...args: any[]) => mockDrainOutbox(...args),
  getOutboxStats: (...args: any[]) => mockGetOutboxStats(...args),
}));

// Heartbeat write is best-effort and just calls Redis. Mock it so the
// drain-handler tests don't hang waiting for an unreachable Redis (no
// Redis in the jest env). Covers only the drain handler's own behaviour;
// the heartbeat helper has its own coverage in redis-connection tests.
jest.mock('../background/utils/redis-connection', () => ({
  setSchedulerHeartbeat: jest.fn().mockResolvedValue(undefined),
}));

function fakeJob(data: Record<string, any> = {}) {
  return {
    id: 'job-1',
    type: 'sms-outbox-drain',
    data,
    status: 'processing',
    attempts: 0,
    maxAttempts: 2,
    priority: 5,
    createdAt: new Date(),
  } as any;
}

let consoleLogSpy: jest.SpyInstance;
let consoleWarnSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

describe('smsOutboxDrainHandler', () => {
  it('calls drainOutbox with the default batch size when none is supplied', async () => {
    mockDrainOutbox.mockResolvedValue({ scanned: 0, sent: 0, failed: 0, exhausted: 0 });

    await smsOutboxDrainHandler(fakeJob());

    expect(mockDrainOutbox).toHaveBeenCalledWith(undefined, { batchSize: 100 });
  });

  it('passes a custom batchSize from job data through', async () => {
    mockDrainOutbox.mockResolvedValue({ scanned: 0, sent: 0, failed: 0, exhausted: 0 });

    await smsOutboxDrainHandler(fakeJob({ batchSize: 25 }));

    expect(mockDrainOutbox).toHaveBeenCalledWith(undefined, { batchSize: 25 });
  });

  it('logs a summary line with scanned/sent/failed/exhausted', async () => {
    mockDrainOutbox.mockResolvedValue({ scanned: 12, sent: 7, failed: 4, exhausted: 1 });

    await smsOutboxDrainHandler(fakeJob());

    const summary = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(summary).toContain('scanned=12');
    expect(summary).toContain('sent=7');
    expect(summary).toContain('retried=4');
    expect(summary).toContain('exhausted=1');
  });

  it('emits a stats warning when any rows hit maxAttempts', async () => {
    mockDrainOutbox.mockResolvedValue({ scanned: 5, sent: 2, failed: 2, exhausted: 1 });
    mockGetOutboxStats.mockResolvedValue({ PENDING: 3, SENT: 100, FAILED: 1, DEAD: 0 });

    await smsOutboxDrainHandler(fakeJob());

    expect(mockGetOutboxStats).toHaveBeenCalledTimes(1);
    const warnOutput = consoleWarnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(warnOutput).toContain('outbox stats after drain');
    expect(warnOutput).toContain('"FAILED":1');
  });

  it('does not query stats when no rows exhausted', async () => {
    mockDrainOutbox.mockResolvedValue({ scanned: 4, sent: 3, failed: 1, exhausted: 0 });

    await smsOutboxDrainHandler(fakeJob());

    expect(mockGetOutboxStats).not.toHaveBeenCalled();
  });

  it('rethrows when drainOutbox itself fails so Bull can retry', async () => {
    mockDrainOutbox.mockRejectedValue(new Error('db unavailable'));

    await expect(smsOutboxDrainHandler(fakeJob())).rejects.toThrow('db unavailable');
  });
});
