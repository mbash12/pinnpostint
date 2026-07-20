import {
  preExpiryReminderKey,
  getSentPreExpiryReminderKeys,
  buildWindowBounds,
} from '../utils/pre-expiry-reminders';

const mockFindMany = jest.fn();

jest.mock('../utils/database', () => ({
  prisma: {
    notification: {
      findMany: (...args: any[]) => mockFindMany(...args),
    },
    ad: { findUnique: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock('../background/queues/notification.queue', () => ({
  queueAdWillExpireNotification: jest.fn(),
}));

jest.mock('../utils/reminder-schedule-settings', () => ({
  getReminderDaysBeforeExpiry: jest.fn().mockResolvedValue([15, 13, 10]),
  normalizeReminderDays: jest.fn((v: any) => (Array.isArray(v) ? v : [])),
}));

// Expiry instants are stored as IST midnight (00:00 IST = 18:30 UTC the
// previous UTC day). The morning cron runs at UTC 02:00 (IST 07:30).
// Window boundaries MUST be IST end-of-day, otherwise a reminder tier
// fires one IST calendar day early (the bug this regression test locks).
// Ad expires 28 Jul 00:00 IST = 2026-07-27T18:30:00.000Z.
const EXPIRY_IST_MIDNIGHT = new Date('2026-07-27T18:30:00.000Z');

describe('buildWindowBounds (IST end-of-day boundaries)', () => {
  // Morning cron ticks at UTC 02:00 (= IST 07:30) each day.
  const cronAtUTC02 = (utcDay: number) =>
    new Date(`2026-07-${String(utcDay).padStart(2, '0')}T02:00:00.000Z`);

  // Ideal first-fire morning, by tier (expiry = 28 Jul IST):
  //   15d -> 13 Jul morning, 13d -> 15 Jul morning, 10d -> 18 Jul morning.
  const fires = (now: Date, N: number, next: number) => {
    const { windowStart, windowEnd } = buildWindowBounds(now, N, next);
    return EXPIRY_IST_MIDNIGHT > windowStart && EXPIRY_IST_MIDNIGHT <= windowEnd;
  };

  it('15d does NOT fire on 12 Jul morning (one day too early)', () => {
    expect(fires(cronAtUTC02(12), 15, 13)).toBe(false);
  });
  it('15d fires on 13 Jul morning (15 IST days before 28 Jul)', () => {
    expect(fires(cronAtUTC02(13), 15, 13)).toBe(true);
  });
  it('13d does NOT fire on 14 Jul morning', () => {
    expect(fires(cronAtUTC02(14), 13, 10)).toBe(false);
  });
  it('13d fires on 15 Jul morning (13 IST days before 28 Jul)', () => {
    expect(fires(cronAtUTC02(15), 13, 10)).toBe(true);
  });
  it('10d does NOT fire on 17 Jul morning', () => {
    expect(fires(cronAtUTC02(17), 10, 0)).toBe(false);
  });
  it('10d fires on 18 Jul morning (10 IST days before 28 Jul)', () => {
    expect(fires(cronAtUTC02(18), 10, 0)).toBe(true);
  });

  it('windowEnd for 10d at 18 Jul morning is IST eod of 28 Jul', () => {
    // anchor IST date = 18 Jul; +10 IST days = 28 Jul; eod 28 Jul 23:59:59.999 IST.
    const { windowEnd } = buildWindowBounds(cronAtUTC02(18), 10, 0);
    expect(windowEnd.toISOString()).toBe('2026-07-28T18:29:59.999Z');
  });

  it('smallest tier (nextSmaller=0) starts from raw now, not IST eod', () => {
    const now = cronAtUTC02(18);
    const { windowStart } = buildWindowBounds(now, 10, 0);
    expect(windowStart.getTime()).toBe(now.getTime());
  });
});

describe('preExpiryReminderKey', () => {
  it('scopes by ad, days, and expiry date', () => {
    expect(preExpiryReminderKey('ad-1', 10, '16/07/2026')).toBe(
      'ad-1:10:16/07/2026'
    );
    expect(preExpiryReminderKey('ad-1', 10, '16/07/2026')).not.toBe(
      preExpiryReminderKey('ad-1', 10, '27/06/2026')
    );
  });
});

describe('getSentPreExpiryReminderKeys', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it('does not let a previous cycle block the same lead day on a new expiry', async () => {
    mockFindMany.mockResolvedValue([
      {
        data: {
          adId: 'ad-1',
          days: 10,
          expiryDate: '27/06/2026',
        },
      },
      {
        data: {
          adId: 'ad-1',
          days: 15,
          expiryDate: '16/07/2026',
        },
      },
    ]);

    const keys = await getSentPreExpiryReminderKeys();

    expect(keys.has('ad-1:10:27/06/2026')).toBe(true);
    expect(keys.has('ad-1:15:16/07/2026')).toBe(true);
    // New cycle 10-day key must still be free
    expect(keys.has('ad-1:10:16/07/2026')).toBe(false);
    // Legacy bare key must not be present
    expect(keys.has('ad-1:10')).toBe(false);
  });

  it('ignores rows without expiryDate', async () => {
    mockFindMany.mockResolvedValue([
      { data: { adId: 'ad-1', days: 10 } },
    ]);

    const keys = await getSentPreExpiryReminderKeys();
    expect(keys.size).toBe(0);
  });

  it('scopes the DB query when adId is provided', async () => {
    mockFindMany.mockResolvedValue([]);

    await getSentPreExpiryReminderKeys('ad-42');

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          data: expect.objectContaining({
            path: ['adId'],
            equals: 'ad-42',
          }),
        }),
      })
    );
  });
});
