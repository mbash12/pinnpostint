/**
 * Tests for the `smsOutboxCleanupHandler` background job handler.
 *
 * Verifies that the handler:
 *  - calls cleanupOldOutboxRows with the default 30-day retention
 *  - logs a summary line with deleted count + elapsed
 *  - rethrows on DB failure so Bull can retry
 */
import { smsOutboxCleanupHandler } from '../background/handlers/sms-outbox-cleanup.handler';

const mockCleanup = jest.fn();
const mockGetOutboxStats = jest.fn();

jest.mock('../utils/smsOutbox', () => ({
  cleanupOldOutboxRows: (...args: any[]) => mockCleanup(...args),
  getOutboxStats: (...args: any[]) => mockGetOutboxStats(...args),
  DEFAULT_SMS_OUTBOX_RETENTION_DAYS: 30,
}));

function fakeJob(data: Record<string, any> = {}) {
  return {
    id: 'cleanup-job-1',
    type: 'sms-outbox-cleanup',
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

beforeEach(() => {
  jest.clearAllMocks();
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleWarnSpy.mockRestore();
});

describe('smsOutboxCleanupHandler', () => {
  it('uses 30-day retention by default', async () => {
    mockCleanup.mockResolvedValue({
      cutoff: new Date('2026-05-24T12:00:00Z'),
      retentionDays: 30,
      deleted: 5,
    });
    mockGetOutboxStats.mockResolvedValue({ PENDING: 0, SENT: 100, FAILED: 0, DEAD: 0 });

    await smsOutboxCleanupHandler(fakeJob());

    expect(mockCleanup).toHaveBeenCalledWith(undefined, { retentionDays: 30 });
  });

  it('respects an explicit retentionDays from job data', async () => {
    mockCleanup.mockResolvedValue({
      cutoff: new Date('2026-06-16T00:00:00Z'),
      retentionDays: 7,
      deleted: 100,
    });
    mockGetOutboxStats.mockResolvedValue({ PENDING: 0, SENT: 50, FAILED: 0, DEAD: 0 });

    await smsOutboxCleanupHandler(fakeJob({ retentionDays: 7 }));

    expect(mockCleanup).toHaveBeenCalledWith(undefined, { retentionDays: 7 });
  });

  it('logs a summary line including deleted count and pre-cleanup counts', async () => {
    mockCleanup.mockResolvedValue({
      cutoff: new Date('2026-05-24T12:00:00Z'),
      retentionDays: 30,
      deleted: 42,
    });
    mockGetOutboxStats.mockResolvedValue({ PENDING: 3, SENT: 200, FAILED: 1, DEAD: 0 });

    await smsOutboxCleanupHandler(fakeJob());

    const summary = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(summary).toContain('deleted=42');
    expect(summary).toContain('retention=30d');
    expect(summary).toContain('PENDING=3');
    expect(summary).toContain('SENT=200');
  });

  it('still completes when reading pre-cleanup stats fails', async () => {
    mockGetOutboxStats.mockRejectedValue(new Error('stats blip'));
    mockCleanup.mockResolvedValue({
      cutoff: new Date('2026-05-24T12:00:00Z'),
      retentionDays: 30,
      deleted: 0,
    });

    await expect(smsOutboxCleanupHandler(fakeJob())).resolves.toBeUndefined();

    // The handler logged a warning but didn't fail the job.
    const warns = consoleWarnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(warns).toContain('failed to read pre-cleanup stats');
  });

  it('rethrows when cleanup itself fails so Bull can retry', async () => {
    mockGetOutboxStats.mockResolvedValue({ PENDING: 0, SENT: 0, FAILED: 0, DEAD: 0 });
    mockCleanup.mockRejectedValue(new Error('db down'));

    await expect(smsOutboxCleanupHandler(fakeJob())).rejects.toThrow('db down');
  });

  it('tags the summary as manual when manualTrigger is true', async () => {
    mockCleanup.mockResolvedValue({
      cutoff: new Date('2026-05-24T12:00:00Z'),
      retentionDays: 30,
      deleted: 0,
    });
    mockGetOutboxStats.mockResolvedValue({ PENDING: 0, SENT: 0, FAILED: 0, DEAD: 0 });

    await smsOutboxCleanupHandler(fakeJob({ manualTrigger: true }));

    const summary = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(summary).toContain('manual');
  });
});
