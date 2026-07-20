/**
 * Tests for the persistent SMS outbox (`utils/smsOutbox`).
 *
 * Covers:
 *  - computeBackoffMs: pure exponential backoff helper
 *  - enqueueSms: writes row, attempts immediate send, marks SENT or PENDING with retry state
 *  - drainOutbox: scans due rows, retries them, advances retry counter,
 *                 and marks FAILED when maxAttempts is exhausted
 */
import {
  computeBackoffMs,
  drainOutbox,
  enqueueSms,
  listOutboxRows,
  retryOutboxRow,
  cleanupOldOutboxRows,
} from '../utils/smsOutbox';

// ── mocks ──────────────────────────────────────────────────────────
const mockOutgoingSmsCreate = jest.fn();
const mockOutgoingSmsUpdate = jest.fn();
const mockOutgoingSmsFindMany = jest.fn();
const mockOutgoingSmsGroupBy = jest.fn();
const mockOutgoingSmsFindUnique = jest.fn();
const mockOutgoingSmsCount = jest.fn();
const mockOutgoingSmsDeleteMany = jest.fn();
const mockSendSms = jest.fn();

jest.mock('../utils/database', () => ({
  prisma: {
    outgoingSms: {
      create: (...args: any[]) => mockOutgoingSmsCreate(...args),
      update: (...args: any[]) => mockOutgoingSmsUpdate(...args),
      findMany: (...args: any[]) => mockOutgoingSmsFindMany(...args),
      groupBy: (...args: any[]) => mockOutgoingSmsGroupBy(...args),
      findUnique: (...args: any[]) => mockOutgoingSmsFindUnique(...args),
      count: (...args: any[]) => mockOutgoingSmsCount(...args),
      deleteMany: (...args: any[]) => mockOutgoingSmsDeleteMany(...args),
    },
  },
}));

jest.mock('../utils/sms', () => ({
  sendSms: (...args: any[]) => mockSendSms(...args),
}));

// Track created row ids so subsequent update() calls can be inspected
let nextRowId = 1;
function newRowId() {
  return `row-${nextRowId++}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  nextRowId = 1;

  // Default: create returns a fresh row, update returns a stub
  mockOutgoingSmsCreate.mockImplementation(async ({ data }) => ({
    id: newRowId(),
    to: data.to,
    message: data.message,
    templateId: data.templateId ?? null,
    kind: data.kind,
    status: 'PENDING',
    retryCount: 0,
    maxAttempts: data.maxAttempts,
    nextRetryAt: data.nextRetryAt,
    lastError: null,
    providerResponse: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sentAt: null,
  }));

  mockOutgoingSmsUpdate.mockImplementation(async ({ where, data }) => ({
    id: where.id,
    ...data,
    updatedAt: new Date(),
  }));
});

describe('computeBackoffMs', () => {
  it('returns the base delay for retryCount=0', () => {
    expect(computeBackoffMs(0)).toBe(60_000);
  });

  it('doubles each retry', () => {
    expect(computeBackoffMs(1)).toBe(120_000);
    expect(computeBackoffMs(2)).toBe(240_000);
    expect(computeBackoffMs(3)).toBe(480_000);
  });

  it('caps at 30 minutes', () => {
    // 60s * 2^6 = 3840s = 64 min → capped to 30 min
    expect(computeBackoffMs(6)).toBe(30 * 60_000);
    expect(computeBackoffMs(20)).toBe(30 * 60_000);
  });

  it('treats negative retryCount as zero', () => {
    expect(computeBackoffMs(-1)).toBe(60_000);
  });
});

describe('enqueueSms', () => {
  it('writes the row first, then attempts an immediate send', async () => {
    mockSendSms.mockResolvedValue({ success: true, provider: 'techbeeshive', response: { status: 'Success' } });

    const callOrder: string[] = [];
    mockOutgoingSmsCreate.mockImplementationOnce(async ({ data }) => {
      callOrder.push('create');
      return {
        id: 'row-1',
        to: data.to,
        message: data.message,
        templateId: data.templateId ?? null,
        kind: data.kind,
        status: 'PENDING',
        retryCount: 0,
        maxAttempts: data.maxAttempts,
        nextRetryAt: data.nextRetryAt,
        lastError: null,
        providerResponse: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sentAt: null,
      };
    });
    mockSendSms.mockImplementationOnce(async () => {
      callOrder.push('send');
      return { success: true, provider: 'techbeeshive', response: { status: 'Success' } };
    });
    mockOutgoingSmsUpdate.mockImplementationOnce(async () => {
      callOrder.push('update');
      return { id: 'row-1', status: 'SENT', sentAt: new Date() };
    });

    const result = await enqueueSms({
      to: '9876543210',
      message: 'hi',
      templateId: 'tpl-1',
      kind: 'notification',
    });

    expect(callOrder).toEqual(['create', 'send', 'update']);
    expect(result.queued).toBe(true);
    expect(result.sent).toBe(true);
    expect(result.id).toBe('row-1');

    // Row was created with PENDING + retryCount 0
    expect(mockOutgoingSmsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          to: '9876543210',
          message: 'hi',
          templateId: 'tpl-1',
          kind: 'notification',
          status: 'PENDING',
          retryCount: 0,
          maxAttempts: 6, // default for notification
        }),
      })
    );

    // Update marks SENT with provider response
    expect(mockOutgoingSmsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'row-1' },
        data: expect.objectContaining({
          status: 'SENT',
          sentAt: expect.any(Date),
          providerResponse: { status: 'Success' },
        }),
      })
    );
  });

  it('leaves the row PENDING with retryCount=1 and a backoff on immediate send failure', async () => {
    mockSendSms.mockResolvedValue({
      success: false,
      provider: 'techbeeshive',
      error: 'provider down',
    });

    const result = await enqueueSms({
      to: '9876543210',
      message: 'hi',
      kind: 'notification',
    });

    expect(result.queued).toBe(true);
    expect(result.sent).toBe(false);
    expect(result.error).toBe('provider down');

    expect(mockOutgoingSmsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'row-1' },
        data: expect.objectContaining({
          status: 'PENDING',
          retryCount: 1,
          lastError: 'provider down',
          nextRetryAt: expect.any(Date),
        }),
      })
    );

    // nextRetryAt should be roughly now + 120s (retryCount=1 → 2^1 * 60s)
    const updateCall = mockOutgoingSmsUpdate.mock.calls[0][0];
    const expectedDelay = computeBackoffMs(1);
    const actualDelay = updateCall.data.nextRetryAt.getTime() - Date.now();
    expect(actualDelay).toBeGreaterThan(expectedDelay - 2000);
    expect(actualDelay).toBeLessThan(expectedDelay + 2000);
  });

  it('uses a smaller maxAttempts for OTP', async () => {
    mockSendSms.mockResolvedValue({
      success: false,
      provider: 'techbeeshive',
      error: 'x',
    });

    await enqueueSms({
      to: '9876543210',
      message: 'otp',
      kind: 'otp',
    });

    expect(mockOutgoingSmsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'otp', maxAttempts: 3 }),
      })
    );
  });

  it('respects an explicit maxAttempts override', async () => {
    mockSendSms.mockResolvedValue({ success: true, provider: 'techbeeshive', response: {} });
    await enqueueSms({
      to: '9876543210',
      message: 'hi',
      kind: 'notification',
      maxAttempts: 1,
    });
    expect(mockOutgoingSmsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ maxAttempts: 1 }),
      })
    );
  });

  it('propagates DB errors when the outbox row cannot be written', async () => {
    mockOutgoingSmsCreate.mockRejectedValue(new Error('db down'));
    await expect(
      enqueueSms({ to: '9876543210', message: 'hi', kind: 'notification' })
    ).rejects.toThrow('db down');
  });
});

describe('drainOutbox', () => {
  function pendingRow(overrides: Partial<{
    id: string;
    to: string;
    message: string;
    templateId: string | null;
    retryCount: number;
    maxAttempts: number;
    nextRetryAt: Date;
  }> = {}) {
    return {
      id: overrides.id ?? `row-${nextRowId++}`,
      to: overrides.to ?? '9876543210',
      message: overrides.message ?? 'hello',
      templateId: overrides.templateId ?? null,
      kind: 'notification',
      status: 'PENDING',
      retryCount: overrides.retryCount ?? 0,
      maxAttempts: overrides.maxAttempts ?? 6,
      nextRetryAt: overrides.nextRetryAt ?? new Date(Date.now() - 1000),
      lastError: null,
      providerResponse: null,
      createdAt: new Date(Date.now() - 60_000),
      updatedAt: new Date(),
      sentAt: null,
    };
  }

  it('does nothing when no rows are due', async () => {
    mockOutgoingSmsFindMany.mockResolvedValue([]);
    const result = await drainOutbox();
    expect(result).toEqual({ scanned: 0, sent: 0, failed: 0, exhausted: 0 });
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('marks due rows SENT on a successful retry', async () => {
    const row = pendingRow({ retryCount: 1 });
    mockOutgoingSmsFindMany.mockResolvedValue([row]);
    mockSendSms.mockResolvedValue({
      success: true,
      provider: 'techbeeshive',
      response: { status: 'Success' },
    });

    const result = await drainOutbox();

    expect(result).toEqual({ scanned: 1, sent: 1, failed: 0, exhausted: 0 });
    expect(mockOutgoingSmsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: row.id },
        data: expect.objectContaining({
          status: 'SENT',
          sentAt: expect.any(Date),
          providerResponse: { status: 'Success' },
        }),
      })
    );
  });

  it('advances retryCount and schedules next attempt on retryable failure', async () => {
    const row = pendingRow({ retryCount: 1, maxAttempts: 5 });
    mockOutgoingSmsFindMany.mockResolvedValue([row]);
    mockSendSms.mockResolvedValue({
      success: false,
      provider: 'techbeeshive',
      error: 'still down',
    });

    const result = await drainOutbox();

    expect(result).toEqual({ scanned: 1, sent: 0, failed: 1, exhausted: 0 });
    expect(mockOutgoingSmsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: row.id },
        data: expect.objectContaining({
          status: 'PENDING',
          retryCount: 2,
          lastError: 'still down',
          nextRetryAt: expect.any(Date),
        }),
      })
    );
  });

  it('marks row FAILED when retryCount would exceed maxAttempts', async () => {
    // retryCount=4, maxAttempts=5 → next attempt would be 5th (maxAttempts) and fail → mark FAILED
    const row = pendingRow({ retryCount: 4, maxAttempts: 5 });
    mockOutgoingSmsFindMany.mockResolvedValue([row]);
    mockSendSms.mockResolvedValue({
      success: false,
      provider: 'techbeeshive',
      error: 'permanent',
    });

    const result = await drainOutbox();

    expect(result).toEqual({ scanned: 1, sent: 0, failed: 0, exhausted: 1 });
    expect(mockOutgoingSmsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: row.id },
        data: expect.objectContaining({
          status: 'FAILED',
          retryCount: 5,
          lastError: 'permanent',
        }),
      })
    );
  });

  it('isolates per-row errors so one bad row does not abort the batch', async () => {
    const good = pendingRow({ id: 'good', to: '1111111111', retryCount: 0 });
    const bad = pendingRow({ id: 'bad', to: '2222222222', retryCount: 0 });
    mockOutgoingSmsFindMany.mockResolvedValue([good, bad]);

    mockSendSms.mockImplementation(async (to: string) => {
      if (to === '1111111111' /* good row */) {
        return { success: true, provider: 'techbeeshive', response: {} };
      }
      throw new Error('unexpected transport failure');
    });

    const result = await drainOutbox();

    // good → sent, bad → recorded as failed but didn't abort the batch
    expect(result.scanned).toBe(2);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);

    // The bad row's update was a "nextRetryAt push forward" with lastError
    const badUpdateCall = mockOutgoingSmsUpdate.mock.calls.find(
      (call: any[]) => call[0].where.id === 'bad'
    );
    expect(badUpdateCall).toBeTruthy();
    expect(badUpdateCall[0].data.lastError).toContain('unexpected transport failure');
  });

  it('respects batchSize and orders by nextRetryAt asc', async () => {
    mockOutgoingSmsFindMany.mockResolvedValue([]);
    await drainOutbox(undefined, { batchSize: 25 });
    expect(mockOutgoingSmsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        orderBy: { nextRetryAt: 'asc' },
        where: expect.objectContaining({ status: 'PENDING' }),
      })
    );
  });

  it('uses the provided now() for filtering due rows', async () => {
    mockOutgoingSmsFindMany.mockResolvedValue([]);
    const now = new Date('2026-06-23T10:00:00Z');
    await drainOutbox(undefined, { now });
    expect(mockOutgoingSmsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          nextRetryAt: { lte: now },
        }),
      })
    );
  });
});

describe('listOutboxRows', () => {
  beforeEach(() => {
    mockOutgoingSmsFindMany.mockReset();
    mockOutgoingSmsCount.mockReset();
  });

  it('returns rows + total + pagination meta', async () => {
    const fakeRows = [{ id: 'a' }, { id: 'b' }];
    mockOutgoingSmsFindMany.mockResolvedValue(fakeRows);
    mockOutgoingSmsCount.mockResolvedValue(42);

    const result = await listOutboxRows(undefined, { page: 2, limit: 10 });

    expect(result.rows).toEqual(fakeRows);
    expect(result.total).toBe(42);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);

    expect(mockOutgoingSmsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }],
      })
    );
  });

  it('clamps limit to <= 100 and >= 1', async () => {
    mockOutgoingSmsFindMany.mockResolvedValue([]);
    mockOutgoingSmsCount.mockResolvedValue(0);

    await listOutboxRows(undefined, { limit: 9999 });
    expect(mockOutgoingSmsFindMany.mock.calls[0][0].take).toBe(100);

    await listOutboxRows(undefined, { limit: 0 });
    expect(mockOutgoingSmsFindMany.mock.calls[1][0].take).toBe(1);
  });

  it('clamps page to >= 1', async () => {
    mockOutgoingSmsFindMany.mockResolvedValue([]);
    mockOutgoingSmsCount.mockResolvedValue(0);

    await listOutboxRows(undefined, { page: 0 });
    expect(mockOutgoingSmsFindMany.mock.calls[0][0].skip).toBe(0);
  });

  it('escapes SQL wildcard characters in the search term', async () => {
    mockOutgoingSmsFindMany.mockResolvedValue([]);
    mockOutgoingSmsCount.mockResolvedValue(0);

    await listOutboxRows(undefined, { search: '50%_off' });
    expect(mockOutgoingSmsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { to: { contains: '50\\%\\_off', mode: 'insensitive' } },
              ]),
            }),
          ]),
        }),
      })
    );
  });

  it('filters by status and kind when provided', async () => {
    mockOutgoingSmsFindMany.mockResolvedValue([]);
    mockOutgoingSmsCount.mockResolvedValue(0);

    await listOutboxRows(undefined, { status: 'FAILED', kind: 'notification' });
    expect(mockOutgoingSmsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'FAILED',
          kind: 'notification',
        }),
      })
    );
  });
});

describe('retryOutboxRow', () => {
  beforeEach(() => {
    mockOutgoingSmsFindUnique.mockReset();
    mockOutgoingSmsUpdate.mockReset();
  });

  it('returns not_found when the row does not exist', async () => {
    mockOutgoingSmsFindUnique.mockResolvedValue(null);
    const result = await retryOutboxRow(undefined, 'missing-id');
    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(mockOutgoingSmsUpdate).not.toHaveBeenCalled();
  });

  it('refuses to retry an already-PENDING row', async () => {
    mockOutgoingSmsFindUnique.mockResolvedValue({
      id: 'r1',
      status: 'PENDING',
      retryCount: 0,
      maxAttempts: 6,
    });
    const result = await retryOutboxRow(undefined, 'r1');
    expect(result).toEqual({ ok: false, reason: 'already_pending' });
    expect(mockOutgoingSmsUpdate).not.toHaveBeenCalled();
  });

  it('resets a FAILED row and returns the updated state', async () => {
    mockOutgoingSmsFindUnique.mockResolvedValue({
      id: 'r2',
      status: 'FAILED',
      retryCount: 5,
      maxAttempts: 5,
    });
    mockOutgoingSmsUpdate.mockResolvedValue({
      id: 'r2',
      status: 'PENDING',
      retryCount: 0,
      nextRetryAt: new Date(),
    });

    const result = await retryOutboxRow(undefined, 'r2');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.status).toBe('PENDING');
      expect(result.row.retryCount).toBe(0);
    }

    expect(mockOutgoingSmsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r2' },
        data: expect.objectContaining({
          status: 'PENDING',
          retryCount: 0,
          lastError: null,
          nextRetryAt: expect.any(Date),
        }),
      })
    );
  });

  it('resets a SENT row too (treated as FAILED-ish — admin-initiated)', async () => {
    mockOutgoingSmsFindUnique.mockResolvedValue({
      id: 'r3',
      status: 'SENT',
      retryCount: 0,
      maxAttempts: 6,
    });
    mockOutgoingSmsUpdate.mockResolvedValue({
      id: 'r3',
      status: 'PENDING',
      retryCount: 0,
      nextRetryAt: new Date(),
    });

    const result = await retryOutboxRow(undefined, 'r3');
    expect(result.ok).toBe(true);
    expect(mockOutgoingSmsUpdate).toHaveBeenCalled();
  });
});

describe('cleanupOldOutboxRows', () => {
  beforeEach(() => {
    mockOutgoingSmsDeleteMany.mockReset();
  });

  it('defaults to 30-day retention and passes the right cutoff', async () => {
    mockOutgoingSmsDeleteMany.mockResolvedValue({ count: 12 });
    const now = new Date('2026-06-23T12:00:00Z');

    const result = await cleanupOldOutboxRows(undefined, { now });

    expect(result.retentionDays).toBe(30);
    expect(result.cutoff.toISOString()).toBe('2026-05-24T12:00:00.000Z');
    expect(result.deleted).toBe(12);

    expect(mockOutgoingSmsDeleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: result.cutoff } },
    });
  });

  it('respects a custom retentionDays', async () => {
    mockOutgoingSmsDeleteMany.mockResolvedValue({ count: 0 });

    await cleanupOldOutboxRows(undefined, { retentionDays: 7, now: new Date('2026-06-23T00:00:00Z') });

    expect(mockOutgoingSmsDeleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date('2026-06-16T00:00:00.000Z') } },
    });
  });

  it('returns 0 when nothing matches', async () => {
    mockOutgoingSmsDeleteMany.mockResolvedValue({ count: 0 });

    const result = await cleanupOldOutboxRows();
    expect(result.deleted).toBe(0);
  });

  it('rethrows if the DELETE itself fails so Bull can retry', async () => {
    mockOutgoingSmsDeleteMany.mockRejectedValue(new Error('db blip'));

    await expect(cleanupOldOutboxRows()).rejects.toThrow('db blip');
  });
});
