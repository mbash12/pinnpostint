/**
 * Unit tests for ad SMS tracker correlation helpers.
 */
import {
  nextPostExpiryDate,
  findExpiryHit,
  findPostExpiryHits,
  expirySmsDueDate,
  type TrackerOutboxHit,
} from '../utils/smsForecast';

function hit(overrides: Partial<TrackerOutboxHit> & { id: string }): TrackerOutboxHit {
  return {
    status: 'SENT',
    createdAt: new Date('2026-05-15T03:00:00Z'),
    sentAt: new Date('2026-05-15T03:00:00Z'),
    label: null,
    reminderDays: null,
    expiryDate: null,
    ...overrides,
  };
}

describe('nextPostExpiryDate', () => {
  // expires Thursday 2026-05-14 → day-0 due Fri 15 → weekly Thursdays after that
  const expiresAt = new Date(2026, 4, 14, 12, 0, 0); // local May 14

  it('includes today when unsent on weekly D-day', () => {
    const thursday = new Date(2026, 4, 21, 9, 0, 0); // May 21
    const next = nextPostExpiryDate(expiresAt, thursday, { afterSend: false });
    expect(next).not.toBeNull();
    expect(next!.getFullYear()).toBe(2026);
    expect(next!.getMonth()).toBe(4);
    expect(next!.getDate()).toBe(21);
  });

  it('advances to next week after a send today', () => {
    const thursday = new Date(2026, 4, 21, 9, 0, 0);
    const next = nextPostExpiryDate(expiresAt, thursday, { afterSend: true });
    expect(next).not.toBeNull();
    expect(next!.getDate()).toBe(28);
  });

  it('skips day-0 due date even when inclusive from expiryDue', () => {
    const due = expirySmsDueDate(expiresAt);
    const next = nextPostExpiryDate(expiresAt, due, { afterSend: false });
    expect(next).not.toBeNull();
    expect(next!.getDate()).toBe(21);
  });

  it('returns a date on or after minDate', () => {
    // Expiry was May 14; today is July 13. Next Thursday is July 16.
    const july13 = new Date(2026, 6, 13, 12, 0, 0);
    const from = new Date(2026, 4, 29, 14, 30, 0); // last send May 29
    const next = nextPostExpiryDate(expiresAt, from, {
      afterSend: true,
      minDate: july13,
    });
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThanOrEqual(
      new Date(2026, 6, 13, 0, 0, 0).getTime()
    );
    expect(next!.getDay()).toBe(expiresAt.getDay()); // Thursday
  });
});

describe('findExpiryHit / findPostExpiryHits', () => {
  const expiresAt = new Date(2026, 4, 14, 12, 0, 0);
  const expiryDue = expirySmsDueDate(expiresAt);
  const expiryLabel = '14/05/2026';

  it('distinguishes labelled day-0 from post-expiry on same cycle', () => {
    const hits: TrackerOutboxHit[] = [
      hit({
        id: 'day0',
        label: 'expiry',
        expiryDate: expiryLabel,
        sentAt: new Date(2026, 4, 15, 3, 0, 0),
        createdAt: new Date(2026, 4, 15, 3, 0, 0),
      }),
      hit({
        id: 'week1',
        label: 'post-expiry',
        expiryDate: expiryLabel,
        sentAt: new Date(2026, 4, 21, 3, 0, 0),
        createdAt: new Date(2026, 4, 21, 3, 0, 0),
      }),
      hit({
        id: 'week2',
        label: 'post-expiry',
        expiryDate: expiryLabel,
        sentAt: new Date(2026, 4, 28, 3, 0, 0),
        createdAt: new Date(2026, 4, 28, 3, 0, 0),
      }),
    ];

    const expiryHit = findExpiryHit(hits, expiryLabel, expiryDue);
    expect(expiryHit?.id).toBe('day0');

    const posts = findPostExpiryHits(hits, expiryLabel, expiryDue, expiryHit?.id);
    expect(posts.map((p) => p.id)).toEqual(['week1', 'week2']);
  });

  it('does not treat previous-cycle expiry SMS as this cycle', () => {
    const hits: TrackerOutboxHit[] = [
      hit({
        id: 'old-cycle',
        label: 'expiry',
        expiryDate: '01/04/2026',
        sentAt: new Date(2026, 3, 2, 3, 0, 0),
        createdAt: new Date(2026, 3, 2, 3, 0, 0),
      }),
      hit({
        id: 'new-day0',
        label: 'expiry',
        expiryDate: expiryLabel,
        sentAt: new Date(2026, 4, 15, 3, 0, 0),
        createdAt: new Date(2026, 4, 15, 3, 0, 0),
      }),
    ];

    expect(findExpiryHit(hits, expiryLabel, expiryDue)?.id).toBe('new-day0');
  });

  it('uses timed legacy fallback when label is expiry without expiryDate', () => {
    const hits: TrackerOutboxHit[] = [
      hit({
        id: 'legacy-day0',
        label: 'ad-expired',
        expiryDate: null,
        sentAt: new Date(expiryDue.getFullYear(), expiryDue.getMonth(), expiryDue.getDate(), 3, 0, 0),
        createdAt: new Date(expiryDue.getFullYear(), expiryDue.getMonth(), expiryDue.getDate(), 3, 0, 0),
      }),
      hit({
        id: 'legacy-week',
        label: 'ad-expired',
        expiryDate: null,
        sentAt: new Date(2026, 4, 21, 3, 0, 0),
        createdAt: new Date(2026, 4, 21, 3, 0, 0),
      }),
    ];

    const expiryHit = findExpiryHit(hits, expiryLabel, expiryDue);
    expect(expiryHit?.id).toBe('legacy-day0');

    const posts = findPostExpiryHits(hits, expiryLabel, expiryDue, expiryHit?.id);
    expect(posts.map((p) => p.id)).toEqual(['legacy-week']);
  });

  it('does not treat a late-sent expiry-labeled SMS as post-expiry', () => {
    const hits: TrackerOutboxHit[] = [
      hit({
        id: 'late-day0',
        label: 'expiry',
        expiryDate: expiryLabel,
        sentAt: new Date(2026, 4, 29, 14, 30, 0), // sent May 29, well after expiryDue
        createdAt: new Date(2026, 4, 29, 14, 30, 0),
      }),
    ];

    const expiryHit = findExpiryHit(hits, expiryLabel, expiryDue);
    expect(expiryHit?.id).toBe('late-day0');

    const posts = findPostExpiryHits(hits, expiryLabel, expiryDue, expiryHit?.id);
    expect(posts.map((p) => p.id)).toEqual([]);
  });
});
