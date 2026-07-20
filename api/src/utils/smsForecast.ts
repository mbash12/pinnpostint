import { prisma } from './database';
import { getReminderDaysBeforeExpiry } from './reminder-schedule-settings';
import { formatISTDate } from './notifications';
import { AdStatus, Prisma } from '@prisma/client';

/** Keep outbox long enough to cover max pre-expiry lead (15d) + buffer. */
export const TRACKER_HISTORY_LOOKBACK_DAYS = 60;

export type TrackerSmsStatus =
  | 'sent'
  | 'pending'
  | 'failed'
  | 'dead'
  | 'scheduled'
  | 'missed'
  | 'n/a';

export interface TrackerSmsSlot {
  status: TrackerSmsStatus;
  /** Calendar date the SMS is/was due (YYYY-MM-DD, local/server date). */
  scheduledDate: string | null;
  /** IST display date if known (dd/mm/yyyy). */
  scheduledLabel: string | null;
  sentAt: string | null;
  outboxId: string | null;
  outboxStatus: string | null;
  /** Extra context, e.g. lead days for pre-expiry. */
  detail?: string | null;
}

export interface TrackerPreExpirySlot extends TrackerSmsSlot {
  reminderDays: number;
}

export interface AdSmsTrackerRow {
  adId: string;
  adTitle: string;
  adStatus: string;
  userId: string;
  userName: string;
  userPhone: string;
  expiresAt: string;
  expiresAtIso: string;
  daysLeft: number;
  preExpiry: TrackerPreExpirySlot[];
  expiry: TrackerSmsSlot;
  lastPostExpiry: TrackerSmsSlot;
  nextPostExpiry: TrackerSmsSlot;
}

export interface AdSmsTrackerResult {
  rows: AdSmsTrackerRow[];
  leadDays: number[];
  summary: {
    total: number;
    withUpcoming: number;
    withMissed: number;
    expired: number;
    active: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type OutboxHit = {
  id: string;
  status: string;
  createdAt: Date;
  sentAt: Date | null;
  label: string | null;
  reminderDays: number | null;
  expiryDate: string | null;
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / msPerDay);
}

function mapOutboxStatus(status: string): TrackerSmsStatus {
  if (status === 'SENT') return 'sent';
  if (status === 'PENDING') return 'pending';
  if (status === 'FAILED') return 'failed';
  if (status === 'DEAD') return 'dead';
  return 'missed';
}

function slotFromOutbox(hit: OutboxHit | undefined, scheduled: Date | null, now: Date): TrackerSmsSlot {
  const scheduledDate = scheduled ? toYmd(scheduled) : null;
  const scheduledLabel = scheduled ? formatISTDate(scheduled) : null;
  if (hit) {
    return {
      status: mapOutboxStatus(hit.status),
      scheduledDate,
      scheduledLabel,
      sentAt: (hit.sentAt ?? hit.createdAt).toISOString(),
      outboxId: hit.id,
      outboxStatus: hit.status,
    };
  }
  if (!scheduled) {
    return {
      status: 'n/a',
      scheduledDate: null,
      scheduledLabel: null,
      sentAt: null,
      outboxId: null,
      outboxStatus: null,
    };
  }
  const due = startOfDay(scheduled);
  if (due.getTime() > startOfDay(now).getTime()) {
    return {
      status: 'scheduled',
      scheduledDate,
      scheduledLabel,
      sentAt: null,
      outboxId: null,
      outboxStatus: null,
    };
  }
  return {
    status: 'missed',
    scheduledDate,
    scheduledLabel,
    sentAt: null,
    outboxId: null,
    outboxStatus: null,
  };
}

/**
 * Cleanup marks ads EXPIRED on the first run of the calendar day AFTER expiresAt.
 * That is also when the day-0 expiry SMS is queued.
 */
export function expirySmsDueDate(expiresAt: Date): Date {
  const d = startOfDay(expiresAt);
  return addDays(d, 1);
}

/**
 * Next weekly post-expiry D-day after expiry due, matching expiresAt weekday.
 *
 * - `afterSend: false` (default): inclusive of `from` — so on D-day before
 *   the morning cron, "next" is today.
 * - `afterSend: true`: exclusive — start the day after `from` so a send
 *   today advances to next week.
 */
export function nextPostExpiryDate(
  expiresAt: Date,
  from: Date,
  options?: { afterSend?: boolean; minDate?: Date }
): Date | null {
  const expiryDue = expirySmsDueDate(expiresAt);
  const targetDow = expiresAt.getDay();
  let cursor = options?.afterSend
    ? addDays(startOfDay(from), 1)
    : startOfDay(from);
  const minDate = addDays(expiryDue, 1);
  if (cursor < minDate) cursor = minDate;
  const floor = options?.minDate ? startOfDay(options.minDate) : null;
  if (floor && cursor < floor) cursor = floor;

  for (let i = 0; i < 21; i++) {
    if (cursor.getDay() === targetDow && cursor > expiryDue) {
      return cursor;
    }
    cursor = addDays(cursor, 1);
  }
  return null;
}

function sameCycle(hit: OutboxHit, expiryLabel: string): boolean {
  return hit.expiryDate === expiryLabel;
}

function isNearExpiryDue(hit: OutboxHit, expiryDue: Date): boolean {
  const t = (hit.sentAt ?? hit.createdAt).getTime();
  const start = addDays(startOfDay(expiryDue), -1).getTime();
  const end = addDays(startOfDay(expiryDue), 2).getTime();
  return t >= start && t <= end;
}

export function findExpiryHit(
  hits: OutboxHit[],
  expiryLabel: string,
  expiryDue: Date
): OutboxHit | undefined {
  return (
    hits.find((h) => h.label === 'expiry' && sameCycle(h, expiryLabel)) ||
    // Legacy rows: label expiry/ad-expired without expiryDate, timed near day-0 due
    hits.find(
      (h) =>
        (h.label === 'expiry' || h.label === 'ad-expired') &&
        !h.expiryDate &&
        isNearExpiryDue(h, expiryDue)
    )
  );
}

export function findPostExpiryHits(
  hits: OutboxHit[],
  expiryLabel: string,
  expiryDue: Date,
  expiryHitId?: string
): OutboxHit[] {
  const labeled = hits.filter(
    (h) => h.label === 'post-expiry' && sameCycle(h, expiryLabel)
  );
  if (labeled.length > 0) {
    return labeled.sort(
      (a, b) =>
        (a.sentAt ?? a.createdAt).getTime() - (b.sentAt ?? b.createdAt).getTime()
    );
  }

  // Legacy: remaining expiry-labeled rows after day-0 window / not the day-0 hit
  return hits
    .filter((h) => {
      if (h.label === 'expiry') return false; // day-0, never post-expiry
      if (h.label !== 'ad-expired') return false;
      if (expiryHitId && h.id === expiryHitId) return false;
      if (h.expiryDate && h.expiryDate !== expiryLabel) return false;
      const t = (h.sentAt ?? h.createdAt).getTime();
      return t > addDays(startOfDay(expiryDue), 2).getTime();
    })
    .sort(
      (a, b) =>
        (a.sentAt ?? a.createdAt).getTime() - (b.sentAt ?? b.createdAt).getTime()
    );
}

/** Exported for unit tests. */
export type TrackerOutboxHit = OutboxHit;

function hitCoversSameSlot(existing: OutboxHit, candidate: OutboxHit): boolean {
  if (existing.label !== candidate.label) return false;
  if (existing.expiryDate !== candidate.expiryDate) return false;
  if (existing.reminderDays !== candidate.reminderDays) return false;
  return true;
}

function notificationRowToHit(row: {
  id: string;
  type: string;
  sentAt: Date | null;
  data: unknown;
}): OutboxHit | null {
  const d =
    row.data && typeof row.data === 'object'
      ? (row.data as Record<string, unknown>)
      : null;
  if (!d?.adId) return null;

  const when = row.sentAt;
  if (!when) return null;
  const expiryDate = typeof d.expiryDate === 'string' ? d.expiryDate : null;

  if (row.type === 'SUBSCRIPTION_EXPIRY') {
    if (typeof d.days !== 'number') return null;
    return {
      id: `notif:${row.id}`,
      status: 'SENT',
      createdAt: when,
      sentAt: row.sentAt ?? when,
      label: `pre-expiry:${d.days}d`,
      reminderDays: d.days,
      expiryDate,
    };
  }

  if (row.type === 'AD_EXPIRED') {
    const label = d.smsLabel === 'post-expiry' ? 'post-expiry' : 'expiry';
    return {
      id: `notif:${row.id}`,
      status: 'SENT',
      createdAt: when,
      sentAt: row.sentAt ?? when,
      label,
      reminderDays: null,
      expiryDate,
    };
  }

  return null;
}

function parseMeta(meta: unknown): {
  label: string | null;
  reminderDays: number | null;
  expiryDate: string | null;
  adId: string | null;
} {
  if (!meta || typeof meta !== 'object') {
    return { label: null, reminderDays: null, expiryDate: null, adId: null };
  }
  const m = meta as Record<string, unknown>;
  return {
    label: typeof m.label === 'string' ? m.label : null,
    reminderDays: typeof m.reminderDays === 'number' ? m.reminderDays : null,
    expiryDate: typeof m.expiryDate === 'string' ? m.expiryDate : null,
    adId: typeof m.adId === 'string' ? m.adId : null,
  };
}

/**
 * Ad-centric SMS lifecycle tracker.
 *
 * One row per ad that still participates in expiry SMS:
 *   - APPROVED/REVIEW with expiresAt (pre-expiry + upcoming expiry)
 *   - EXPIRED with expiresAt (post-expiry weekly)
 *
 * Correlates planned dates with outgoing_sms meta (adId / label / reminderDays).
 */
export async function computeAdSmsTracker(options?: {
  search?: string;
  page?: number;
  limit?: number;
  now?: Date;
}): Promise<AdSmsTrackerResult> {
  const now = options?.now ?? new Date();
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 25));
  const search = options?.search?.trim() || '';

  const leadDays = await getReminderDaysBeforeExpiry();

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const baseWhere: Prisma.AdWhereInput = {
    expiresAt: { not: null },
    status: { in: [AdStatus.REVIEW, AdStatus.APPROVED, AdStatus.EXPIRED] },
    user: { phone: { gt: '' } },
  };

  const scopeWhere: Prisma.AdWhereInput = {
    // TESTING ONLY: active ads are always shown; otherwise only ads created,
    // extended (renewed subscription created this month), or expired this month.
    OR: [
      { status: { in: [AdStatus.REVIEW, AdStatus.APPROVED] } },
      { createdAt: { gte: monthStart } },
      {
        subscriptions: {
          some: { isRenewed: true, createdAt: { gte: monthStart } },
        },
      },
      { expiresAt: { gte: monthStart } },
    ],
  };

  const searchWhere: Prisma.AdWhereInput | undefined = search
    ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { id: { contains: search, mode: 'insensitive' } },
          { user: { phone: { contains: search } } },
          {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      }
    : undefined;

  const where: Prisma.AdWhereInput = searchWhere
    ? { AND: [baseWhere, scopeWhere, searchWhere] }
    : { AND: [baseWhere, scopeWhere] };

  const total = await prisma.ad.count({ where });
  const ads = await prisma.ad.findMany({
    where,
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
    },
    orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
    skip: (page - 1) * limit,
    take: limit,
  });

  const adIds = ads.map((a) => a.id);
  type RawOutbox = {
    id: string;
    status: string;
    createdAt: Date;
    sentAt: Date | null;
    meta: unknown;
  };
  type RawNotif = {
    id: string;
    type: string;
    sentAt: Date | null;
    data: unknown;
  };

  const historySince = addDays(now, -TRACKER_HISTORY_LOOKBACK_DAYS);

  const outboxRows: RawOutbox[] =
    adIds.length === 0
      ? []
      : await prisma.$queryRaw<RawOutbox[]>`
          SELECT id, status, "createdAt", "sentAt", meta
          FROM outgoing_sms
          WHERE kind = 'notification'
            AND meta->>'adId' IN (${Prisma.join(adIds)})
          ORDER BY "createdAt" ASC
        `;

  const notifRows: RawNotif[] =
    adIds.length === 0
      ? []
      : await prisma.$queryRaw<RawNotif[]>`
          SELECT id, type::text AS type, "sentAt", data
          FROM notifications
          WHERE type IN ('SUBSCRIPTION_EXPIRY', 'AD_EXPIRED')
            AND data->>'adId' IN (${Prisma.join(adIds)})
            AND "sentAt" >= ${historySince}
          ORDER BY "sentAt" ASC
        `;

  const byAd = new Map<string, OutboxHit[]>();
  for (const row of outboxRows) {
    const meta = parseMeta(row.meta);
    if (!meta.adId || !adIds.includes(meta.adId)) continue;
    const hit: OutboxHit = {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
      sentAt: row.sentAt,
      label: meta.label,
      reminderDays: meta.reminderDays,
      expiryDate: meta.expiryDate,
    };
    const list = byAd.get(meta.adId) ?? [];
    list.push(hit);
    byAd.set(meta.adId, list);
  }

  // Fill gaps when outbox rows were cleaned up or predate meta column.
  for (const row of notifRows) {
    const hit = notificationRowToHit(row);
    if (!hit) continue;
    const d = row.data as Record<string, unknown>;
    const adId = String(d.adId);
    if (!adIds.includes(adId)) continue;
    const list = byAd.get(adId) ?? [];
    if (list.some((h) => hitCoversSameSlot(h, hit))) continue;
    list.push(hit);
    byAd.set(adId, list);
  }

  const rows: AdSmsTrackerRow[] = ads.map((ad) => {
    const expiresAt = ad.expiresAt!;
    const expiryLabel = formatISTDate(expiresAt);
    const hits = byAd.get(ad.id) ?? [];
    const daysLeft = daysBetween(now, expiresAt);

    const preExpiry: TrackerPreExpirySlot[] = leadDays.map((n) => {
      const scheduled = startOfDay(addDays(expiresAt, -n));
      const exact =
        hits.find(
          (h) => h.reminderDays === n && h.expiryDate === expiryLabel
        ) ||
        hits.find(
          (h) => h.label === `pre-expiry:${n}d` && h.expiryDate === expiryLabel
        ) ||
        // Legacy notification without expiryDate: match lead day near scheduled date
        hits.find(
          (h) =>
            h.reminderDays === n &&
            !h.expiryDate &&
            Math.abs(
              startOfDay(h.sentAt ?? h.createdAt).getTime() - scheduled.getTime()
            ) <=
              2 * 24 * 60 * 60 * 1000
        );
      const slot = slotFromOutbox(exact, scheduled, now);
      return {
        ...slot,
        reminderDays: n,
        detail: `${n}d before expiry`,
      };
    });

    const expiryDue = expirySmsDueDate(expiresAt);
    const expiryHit = findExpiryHit(hits, expiryLabel, expiryDue);
    const postHits = findPostExpiryHits(hits, expiryLabel, expiryDue, expiryHit?.id);
    const lastPostHit = postHits.length > 0 ? postHits[postHits.length - 1] : undefined;

    const expirySlot = slotFromOutbox(expiryHit, expiryDue, now);
    if (
      (ad.status === 'APPROVED' || ad.status === 'REVIEW') &&
      !expiryHit &&
      startOfDay(expiryDue).getTime() >= startOfDay(now).getTime()
    ) {
      expirySlot.status = 'scheduled';
    }

    const lastPostExpiry: TrackerSmsSlot = lastPostHit
      ? {
          ...slotFromOutbox(lastPostHit, lastPostHit.sentAt ?? lastPostHit.createdAt, now),
          detail: 'Last weekly post-expiry SMS',
        }
      : {
          status: 'n/a',
          scheduledDate: null,
          scheduledLabel: null,
          sentAt: null,
          outboxId: null,
          outboxStatus: null,
          detail: ad.status === 'EXPIRED' ? 'No post-expiry SMS yet' : null,
        };

    const nextPostDate =
      ad.status === 'EXPIRED' || startOfDay(expiresAt).getTime() < startOfDay(now).getTime()
        ? nextPostExpiryDate(
            expiresAt,
            lastPostHit ? (lastPostHit.sentAt ?? lastPostHit.createdAt) : now,
            { afterSend: Boolean(lastPostHit), minDate: now }
          )
        : nextPostExpiryDate(expiresAt, expiryDue, { minDate: now });

    const nextPostExpiry: TrackerSmsSlot = nextPostDate
      ? {
          status: 'scheduled',
          scheduledDate: toYmd(nextPostDate),
          scheduledLabel: formatISTDate(nextPostDate),
          sentAt: null,
          outboxId: null,
          outboxStatus: null,
          detail:
            ad.status === 'APPROVED' || ad.status === 'REVIEW'
              ? 'After expiry (weekly)'
              : 'Next weekly D-day',
        }
      : {
          status: 'n/a',
          scheduledDate: null,
          scheduledLabel: null,
          sentAt: null,
          outboxId: null,
          outboxStatus: null,
        };

    return {
      adId: ad.id,
      adTitle: ad.title,
      adStatus: ad.status,
      userId: ad.user.id,
      userName: [ad.user.firstName, ad.user.lastName].filter(Boolean).join(' ') || '—',
      userPhone: ad.user.phone || '—',
      expiresAt: expiryLabel,
      expiresAtIso: expiresAt.toISOString(),
      daysLeft,
      preExpiry,
      expiry: { ...expirySlot, detail: 'Day-0 expiry SMS' },
      lastPostExpiry,
      nextPostExpiry,
    };
  });

  const withMissed = rows.filter(
    (r) =>
      r.preExpiry.some((p) => p.status === 'missed') ||
      r.expiry.status === 'missed' ||
      r.lastPostExpiry.status === 'failed' ||
      r.lastPostExpiry.status === 'dead'
  ).length;
  const withUpcoming = rows.filter(
    (r) =>
      r.preExpiry.some((p) => p.status === 'scheduled') ||
      r.expiry.status === 'scheduled' ||
      r.nextPostExpiry.status === 'scheduled'
  ).length;

  return {
    rows,
    leadDays,
    summary: {
      total,
      withUpcoming,
      withMissed,
      expired: rows.filter((r) => r.adStatus === 'EXPIRED').length,
      active: rows.filter((r) => r.adStatus === 'APPROVED' || r.adStatus === 'REVIEW').length,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// Keep legacy day forecast for any older callers / tests.
export type ForecastType = 'pre-expiry' | 'expiry' | 'post-expiry';

export interface ForecastRow {
  adId: string;
  adTitle: string;
  userId: string;
  userName: string;
  userPhone: string;
  expiresAt: string;
  daysLeft: number | null;
  reminderDays?: number | null;
  smsType: ForecastType;
  smsMessage: string;
  smsTemplateId: string | null;
}

export async function computeForecast(targetDate: Date): Promise<{
  rows: ForecastRow[];
  summary: { 'pre-expiry': number; expiry: number; 'post-expiry': number };
}> {
  // Re-export thin wrapper using previous logic via tracker is not equivalent;
  // keep a minimal implementation for the old endpoint.
  const { notificationTemplates } = await import('../config/notification-templates');
  const dayStart = startOfDay(targetDate);
  const dayOfWeek = targetDate.getDay();
  const rows: ForecastRow[] = [];
  const reminderDays = await getReminderDaysBeforeExpiry();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  for (const n of reminderDays) {
    const windowStart = addDays(targetDate, n);
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = addDays(targetDate, n);
    windowEnd.setHours(23, 59, 59, 999);
    const ads = await prisma.ad.findMany({
      where: {
        expiresAt: { gte: windowStart, lte: windowEnd },
        status: { in: ['REVIEW', 'APPROVED'] },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    for (const ad of ads) {
      if (!ad.user.phone) continue;
      const expiryStr = formatISTDate(ad.expiresAt!);
      rows.push({
        adId: ad.id,
        adTitle: ad.title,
        userId: ad.user.id,
        userName: [ad.user.firstName, ad.user.lastName].filter(Boolean).join(' ') || '—',
        userPhone: ad.user.phone,
        expiresAt: expiryStr,
        daysLeft: daysBetween(targetDate, ad.expiresAt!),
        reminderDays: n,
        smsType: 'pre-expiry',
        smsMessage: notificationTemplates.adWillExpire.sms.message({
          adTitle: ad.title,
          expiryDate: expiryStr,
        }),
        smsTemplateId: notificationTemplates.adWillExpire.sms.templateId ?? null,
      });
    }
  }

  const expiredAds = await prisma.ad.findMany({
    where: {
      expiresAt: { lt: dayStart },
      status: { in: ['REVIEW', 'APPROVED'] },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
  });
  for (const ad of expiredAds) {
    if (!ad.user.phone) continue;
    rows.push({
      adId: ad.id,
      adTitle: ad.title,
      userId: ad.user.id,
      userName: [ad.user.firstName, ad.user.lastName].filter(Boolean).join(' ') || '—',
      userPhone: ad.user.phone,
      expiresAt: formatISTDate(ad.expiresAt!),
      daysLeft: 0,
      reminderDays: null,
      smsType: 'expiry',
      smsMessage: notificationTemplates.adExpired.sms.message({ adTitle: ad.title }),
      smsTemplateId: notificationTemplates.adExpired.sms.templateId ?? null,
    });
  }

  const postExpiryWhere: Prisma.AdWhereInput = {
    status: AdStatus.EXPIRED,
    expiresAt: { not: null },
    // TESTING ONLY: expired ads shown only if created, extended, or expired this month.
    OR: [
      { createdAt: { gte: monthStart } },
      {
        subscriptions: {
          some: { isRenewed: true, createdAt: { gte: monthStart } },
        },
      },
      { expiresAt: { gte: monthStart } },
    ],
  };
  const postExpiryAds = await prisma.ad.findMany({
    where: postExpiryWhere,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
  });
  for (const ad of postExpiryAds) {
    if (!ad.user.phone || !ad.expiresAt) continue;
    if (ad.expiresAt >= dayStart) continue;
    if (ad.expiresAt.getDay() !== dayOfWeek) continue;
    rows.push({
      adId: ad.id,
      adTitle: ad.title,
      userId: ad.user.id,
      userName: [ad.user.firstName, ad.user.lastName].filter(Boolean).join(' ') || '—',
      userPhone: ad.user.phone,
      expiresAt: formatISTDate(ad.expiresAt),
      daysLeft: -daysBetween(ad.expiresAt, targetDate),
      reminderDays: null,
      smsType: 'post-expiry',
      smsMessage: notificationTemplates.adExpired.sms.message({ adTitle: ad.title }),
      smsTemplateId: notificationTemplates.adExpired.sms.templateId ?? null,
    });
  }

  return {
    rows,
    summary: {
      'pre-expiry': rows.filter((r) => r.smsType === 'pre-expiry').length,
      expiry: rows.filter((r) => r.smsType === 'expiry').length,
      'post-expiry': rows.filter((r) => r.smsType === 'post-expiry').length,
    },
  };
}
