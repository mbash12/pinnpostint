/**
 * Tests for adExpirationCleanupHandler (day 0) and
 * adAfterExpiredReminderHandler (day 7, 14, 21… D-day weekly).
 *
 * Uses jest.useFakeTimers() with setSystemTime() so Date.getDay() works
 * naturally — no need to mock Date.prototype.
 */
import {
  adExpirationCleanupHandler,
  adAfterExpiredReminderHandler,
} from '../background/handlers/ad-expiration.handler';

// ── mocks ──────────────────────────────────────────────────────────
const mockAdFindMany = jest.fn();
const mockAdUpdateMany = jest.fn();
const mockSubscriptionUpdateMany = jest.fn();
const mockNotificationFindMany = jest.fn();
const mockQueueAdStatusNotification = jest.fn();
const mockQueueAdWillExpireNotification = jest.fn();

jest.mock('../utils/database', () => ({
  prisma: {
    ad: {
      findMany: (...args: any[]) => mockAdFindMany(...args),
      updateMany: (...args: any[]) => mockAdUpdateMany(...args),
    },
    subscription: {
      updateMany: (...args: any[]) => mockSubscriptionUpdateMany(...args),
    },
    notification: {
      findMany: (...args: any[]) => mockNotificationFindMany(...args),
    },
  },
}));

jest.mock('../background/queues/notification.queue', () => ({
  queueAdStatusNotification: (...args: any[]) =>
    mockQueueAdStatusNotification(...args),
  queueAdWillExpireNotification: (...args: any[]) =>
    mockQueueAdWillExpireNotification(...args),
}));

jest.mock('../utils/reminder-schedule-settings', () => ({
  getReminderDaysBeforeExpiry: jest.fn().mockResolvedValue([7, 3, 1]),
  normalizeReminderDays: jest.fn((v: any) => {
    if (Array.isArray(v)) return v;
    return v > 0 ? [v] : [];
  }),
}));


let mockExpiredNotificationDebug = false;
jest.mock('../config/environment', () => ({
  get config() {
    return { server: { expiredNotificationDebug: mockExpiredNotificationDebug } };
  },
}));

jest.mock('../utils/notifications', () => ({
  // Plain function — jest resetMocks:true would wipe jest.fn implementations
  formatISTDate: (d: Date) => d.toISOString(),
}));

// ── helpers ────────────────────────────────────────────────────────
function fakeJob(data: Record<string, any> = {}) {
  return { id: 'test-job-id', type: 'test', data: {} as any, ...data } as any;
}

function expiredAd(overrides: Partial<{
  id: string;
  title: string;
  expiresAt: Date;
  userId: string;
  slug: string;
}> = {}) {
  return {
    id: overrides.id ?? 'ad-1',
    title: overrides.title ?? 'Test Ad',
    expiresAt: overrides.expiresAt ?? new Date(),
    userId: overrides.userId ?? 'user-1',
    slug: overrides.slug ?? 'test-ad',
    status: 'EXPIRED',
    user: { id: overrides.userId ?? 'user-1' },
  };
}

/**
 * Use fake timers and freeze system time to a known date.
 * Call this at the top of a test (or describe block) that needs
 * a deterministic "now".
 *
 * Day-of-week reference:
 *   2026-05-19 = Tuesday  (getDay: 2)
 *   2026-05-20 = Wednesday(3)
 *   2026-05-21 = Thursday (4)
 *   2026-05-22 = Friday   (5)
 */

// ── tests ─────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockAdUpdateMany.mockResolvedValue({ count: 1 });
  mockSubscriptionUpdateMany.mockResolvedValue({ count: 1 });
  mockNotificationFindMany.mockResolvedValue([]);
  mockQueueAdStatusNotification.mockResolvedValue(undefined);
  mockQueueAdWillExpireNotification.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('adExpirationCleanupHandler (day 0)', () => {
  it('sends EXPIRED notification for ALL newly-expired ads — no D-day filter', async () => {
    const yesterday = new Date('2026-05-18T12:00:00'); // Monday, day before

    mockAdFindMany.mockResolvedValue([
      expiredAd({ expiresAt: yesterday, id: 'ad-1', userId: 'u1' }),
      expiredAd({ expiresAt: yesterday, id: 'ad-2', userId: 'u2' }),
    ]);

    await adExpirationCleanupHandler(fakeJob());

    const expiryDateStr = yesterday.toISOString();
    expect(mockQueueAdStatusNotification).toHaveBeenCalledTimes(2);
    expect(mockQueueAdStatusNotification).toHaveBeenCalledWith(
      'u1', 'ad-1', 'Test Ad', 'EXPIRED', undefined, 'test-ad', expiryDateStr, undefined, 'expiry'
    );
    expect(mockQueueAdStatusNotification).toHaveBeenCalledWith(
      'u2', 'ad-2', 'Test Ad', 'EXPIRED', undefined, 'test-ad', expiryDateStr, undefined, 'expiry'
    );
  });

  it('still marks ads EXPIRED and deactivates subscriptions', async () => {
    const yesterday = new Date('2026-05-18T12:00:00');

    mockAdFindMany.mockResolvedValue([
      expiredAd({ expiresAt: yesterday, id: 'ad-1', userId: 'u1' }),
    ]);

    await adExpirationCleanupHandler(fakeJob());

    expect(mockAdUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['ad-1'] } },
      data: { status: 'EXPIRED' },
    });
    expect(mockSubscriptionUpdateMany).toHaveBeenCalledWith({
      where: { adId: { in: ['ad-1'] }, isActive: true },
      data: { isActive: false },
    });
  });

  it('handles empty expired ads list gracefully', async () => {
    mockAdFindMany.mockResolvedValue([]);

    await adExpirationCleanupHandler(fakeJob());

    expect(mockQueueAdStatusNotification).not.toHaveBeenCalled();
    expect(mockAdUpdateMany).not.toHaveBeenCalled();
  });
});

describe('adAfterExpiredReminderHandler (day 7, 14, 21…)', () => {
  it('sends reminder for ads whose D-day matches today BUT expired before today (NOT day 0)', async () => {
    // Freeze "now" to Thursday 2026-05-21 at 9 AM
    jest.useFakeTimers().setSystemTime(new Date('2026-05-21T09:00:00'));

    // Ad that expired last Thursday (7 days ago): 2026-05-14 (getDay=4, Thursday)
    const lastThursday = new Date('2026-05-14T12:00:00');

    mockAdFindMany.mockResolvedValue([
      expiredAd({ expiresAt: lastThursday, id: 'ad-old', userId: 'u1' }),
    ]);

    await adAfterExpiredReminderHandler(fakeJob());

    expect(mockQueueAdStatusNotification).toHaveBeenCalledWith(
      'u1', 'ad-old', 'Test Ad', 'EXPIRED', undefined, 'test-ad',
      lastThursday.toISOString(), undefined, 'post-expiry'
    );
  });

  it('does NOT send reminder for ads that expired TODAY (day 0 — cleanup handles it)', async () => {
    // Freeze "now" to Thursday 2026-05-21 at 9 AM
    jest.useFakeTimers().setSystemTime(new Date('2026-05-21T09:00:00'));

    // Ad that expires TODAY at noon
    const todayNoon = new Date('2026-05-21T12:00:00');

    mockAdFindMany.mockResolvedValue([
      expiredAd({ expiresAt: todayNoon, id: 'ad-today', userId: 'u2' }),
    ]);

    await adAfterExpiredReminderHandler(fakeJob());

    // Should NOT send — todayStart = 2026-05-21 00:00, expiresAt = 2026-05-21 12:00 → expiresAt < todayStart is FALSE
    expect(mockQueueAdStatusNotification).not.toHaveBeenCalled();
  });

  it('does NOT send reminder when D-day does not match today', async () => {
    // Freeze "now" to Thursday 2026-05-21 (getDay=4)
    jest.useFakeTimers().setSystemTime(new Date('2026-05-21T09:00:00'));

    // Ad that expired last Monday: 2026-05-18 (getDay=1, Monday)
    const lastMonday = new Date('2026-05-18T12:00:00');

    mockAdFindMany.mockResolvedValue([
      expiredAd({ expiresAt: lastMonday, id: 'ad-mon', userId: 'u3' }),
    ]);

    await adAfterExpiredReminderHandler(fakeJob());

    // D-day Monday(1) ≠ today Thursday(4) → no notification
    expect(mockQueueAdStatusNotification).not.toHaveBeenCalled();
  });

  it('sends for multiple old ads matching D-day while skipping today-ad', async () => {
    // Freeze "now" to Tuesday 2026-05-19 (getDay=2)
    jest.useFakeTimers().setSystemTime(new Date('2026-05-19T09:00:00'));

    // Tuesday 7 days ago: 2026-05-12
    const lastTuesday = new Date('2026-05-12T12:00:00');
    // Tuesday 14 days ago: 2026-05-05
    const twoWeeksAgoTuesday = new Date('2026-05-05T12:00:00');
    // Today at noon: 2026-05-19 (day 0, D-day matches but should be skipped)
    const todayNoon = new Date('2026-05-19T12:00:00');

    mockAdFindMany.mockResolvedValue([
      expiredAd({ expiresAt: lastTuesday, id: 'ad-old1', userId: 'u1' }),
      expiredAd({ expiresAt: todayNoon, id: 'ad-today', userId: 'u2' }),
      expiredAd({ expiresAt: twoWeeksAgoTuesday, id: 'ad-old2', userId: 'u3' }),
    ]);

    await adAfterExpiredReminderHandler(fakeJob());

    // Day-0 ad skipped; only the two older Tuesday ads get reminders
    expect(mockQueueAdStatusNotification).toHaveBeenCalledTimes(2);
    expect(mockQueueAdStatusNotification).toHaveBeenCalledWith(
      'u1', 'ad-old1', 'Test Ad', 'EXPIRED', undefined, 'test-ad',
      lastTuesday.toISOString(), undefined, 'post-expiry'
    );
    expect(mockQueueAdStatusNotification).toHaveBeenCalledWith(
      'u3', 'ad-old2', 'Test Ad', 'EXPIRED', undefined, 'test-ad',
      twoWeeksAgoTuesday.toISOString(), undefined, 'post-expiry'
    );

    const todayCalls = mockQueueAdStatusNotification.mock.calls.filter(
      (call: any[]) => call[1] === 'ad-today'
    );
    expect(todayCalls).toHaveLength(0);
  });
});

describe('adAfterExpiredReminderHandler (EXPIRED_NOTIFICATION_DEBUG — daily mode)', () => {
  beforeEach(() => {
    mockExpiredNotificationDebug = true;
  });

  afterEach(() => {
    mockExpiredNotificationDebug = false;
  });

  it('sends reminder for any expired ad regardless of D-day', async () => {
    // Afternoon window: UTC 08:30–09:00 (2 PM IST). Use explicit Z.
    jest.useFakeTimers().setSystemTime(new Date('2026-05-21T08:35:00.000Z'));

    // Monday (getDay=1) — would NOT match in normal mode
    const lastMonday = new Date('2026-05-18T12:00:00');
    // Wednesday (getDay=3) — would NOT match in normal mode
    const lastWednesday = new Date('2026-05-20T12:00:00');

    mockAdFindMany.mockResolvedValue([
      expiredAd({ expiresAt: lastMonday, id: 'ad-mon', userId: 'u1' }),
      expiredAd({ expiresAt: lastWednesday, id: 'ad-wed', userId: 'u2' }),
    ]);

    await adAfterExpiredReminderHandler(fakeJob());

    expect(mockQueueAdStatusNotification).toHaveBeenCalledTimes(2);
    expect(mockQueueAdStatusNotification).toHaveBeenCalledWith(
      'u1', 'ad-mon', 'Test Ad', 'EXPIRED', undefined, 'test-ad',
      lastMonday.toISOString(), undefined, 'post-expiry'
    );
    expect(mockQueueAdStatusNotification).toHaveBeenCalledWith(
      'u2', 'ad-wed', 'Test Ad', 'EXPIRED', undefined, 'test-ad',
      lastWednesday.toISOString(), undefined, 'post-expiry'
    );
  });

  it('still excludes day-0 (today) ads in debug mode', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-21T08:35:00.000Z'));

    const todayNoon = new Date('2026-05-21T12:00:00');

    mockAdFindMany.mockResolvedValue([
      expiredAd({ expiresAt: todayNoon, id: 'ad-today', userId: 'u1' }),
    ]);

    await adAfterExpiredReminderHandler(fakeJob());

    // Day 0 should still be excluded — cleanup handler covers it
    expect(mockQueueAdStatusNotification).not.toHaveBeenCalled();
  });

  it('sends daily for all expired ads (not just matching D-day)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-21T08:35:00.000Z'));

    // Mix of different D-days, all before today
    const monday = new Date('2026-05-18T12:00:00');   // day 1
    const tuesday = new Date('2026-05-19T12:00:00');  // day 2
    const wednesday = new Date('2026-05-20T12:00:00'); // day 3
    const lastThursday = new Date('2026-05-14T12:00:00'); // day 4 (Thursday, matches today)
    const todayNoon = new Date('2026-05-21T12:00:00'); // day 0 (today)

    mockAdFindMany.mockResolvedValue([
      expiredAd({ expiresAt: monday, id: 'ad-mon', userId: 'u1' }),
      expiredAd({ expiresAt: tuesday, id: 'ad-tue', userId: 'u2' }),
      expiredAd({ expiresAt: wednesday, id: 'ad-wed', userId: 'u3' }),
      expiredAd({ expiresAt: lastThursday, id: 'ad-thu', userId: 'u4' }),
      expiredAd({ expiresAt: todayNoon, id: 'ad-today', userId: 'u5' }),
    ]);

    await adAfterExpiredReminderHandler(fakeJob());

    // All 4 old ads get notifications; day-0 skipped
    expect(mockQueueAdStatusNotification).toHaveBeenCalledTimes(4);

    const notifiedIds = mockQueueAdStatusNotification.mock.calls.map(
      (call: any[]) => call[1]
    );
    expect(notifiedIds).toContain('ad-mon');
    expect(notifiedIds).toContain('ad-tue');
    expect(notifiedIds).toContain('ad-wed');
    expect(notifiedIds).toContain('ad-thu');
    expect(notifiedIds).not.toContain('ad-today');
  });
});
