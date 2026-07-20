import { NotificationType } from '@prisma/client';
import { prisma } from './database';
import { formatISTDate } from './notifications';
import { queueAdWillExpireNotification } from '../background/queues/notification.queue';
import {
  getReminderDaysBeforeExpiry,
  normalizeReminderDays,
} from './reminder-schedule-settings';

export type PreExpiryDeliverFn = (
  userId: string,
  adId: string,
  adTitle: string,
  expiryDate: string,
  reminderDays?: number
) => Promise<void>;

/**
 * Dedup key for pre-expiry reminders.
 * Includes expiryDate so a renew/extend cycle can re-send the same
 * lead-time tiers (15/13/10) without being blocked by the previous cycle.
 */
export function preExpiryReminderKey(
  adId: string,
  reminderDays: number,
  expiryDate: string
): string {
  return `${adId}:${reminderDays}:${expiryDate}`;
}

/**
 * Return keys already sent in the last 30 days.
 * Keys are scoped by expiryDate so renew/extend cycles can re-notify.
 * Rows without expiryDate are ignored (cannot safely scope to a cycle).
 *
 * Pass `adId` on per-ad catch-up paths to avoid loading the full 30-day set.
 */
export async function getSentPreExpiryReminderKeys(adId?: string): Promise<Set<string>> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const rows = await prisma.notification.findMany({
    where: {
      type: NotificationType.SUBSCRIPTION_EXPIRY,
      sentAt: { gte: since },
      ...(adId
        ? { data: { path: ['adId'], equals: adId } }
        : {}),
    },
    select: { data: true },
  });

  const keys = new Set<string>();
  for (const row of rows) {
    const d = row.data as Record<string, unknown> | null;
    if (!d?.adId || typeof d.days !== 'number') continue;
    if (typeof d.expiryDate !== 'string' || !d.expiryDate) continue;
    if (adId && String(d.adId) !== adId) continue;
    keys.add(preExpiryReminderKey(String(d.adId), d.days, d.expiryDate));
  }
  return keys;
}

// All pre-expiry window math is done in IST (Asia/Kolkata, UTC+5:30),
// regardless of the API container's own TZ (which is UTC in production).
// Ad expiry instants are stored as IST midnight (00:00 IST = 18:30 UTC the
// previous UTC day). If we computed "end of day" in the container TZ the
// boundary would land on UTC midnight and every reminder tier would fire
// one IST calendar day early. So every boundary below is an IST end-of-day
// expressed as a UTC instant.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MS_PER_DAY = 86_400_000;

/**
 * UTC instant of 23:59:59.999 IST on the IST calendar day that is
 * `dayOffset` IST days after the IST calendar day containing `now`.
 * `dayOffset=0` => end of today (IST), `dayOffset=15` => end of the
 * IST day 15 days from today. Pure IST — no Date.setDate / container TZ.
 */
function istEndOfDayUTC(now: Date, dayOffset: number): Date {
  const istMs = now.getTime() + IST_OFFSET_MS;
  const istTodayStart = Math.floor(istMs / MS_PER_DAY) * MS_PER_DAY;
  const istEodMs = istTodayStart + (dayOffset + 1) * MS_PER_DAY - 1; // 23:59:59.999 IST
  return new Date(istEodMs - IST_OFFSET_MS);
}

export function buildWindowBounds(
  now: Date,
  reminderDays: number,
  nextSmaller: number
): { windowStart: Date; windowEnd: Date } {
  // Upper boundary is always the end of the IST day `reminderDays` out.
  const windowEnd = istEndOfDayUTC(now, reminderDays);

  // Lower boundary: for the smallest tier (nextSmaller === 0), the window
  // starts "now" so it fires as soon as the ad enters this final tier.
  // For larger tiers, it starts at the end of the next-smaller tier's IST
  // day (i.e. the boundary between the two tiers is IST midnight).
  const windowStart =
    nextSmaller > 0 ? istEndOfDayUTC(now, nextSmaller) : new Date(now);

  return { windowStart, windowEnd };
}

/**
 * Queue any pre-expiry reminder tiers the ad currently falls into,
 * skipping ones already sent for this expiry cycle.
 *
 * Used by the morning cron and by approve/extend catch-up so ads that
 * become live after the morning window still get the correct lead SMS.
 */
export async function queueDuePreExpiryRemindersForAd(
  adId: string,
  options?: {
    daysBeforeExpiry?: number[];
    /** Override delivery (tests can write notifications inline without Bull). */
    deliver?: PreExpiryDeliverFn;
    /** Override "now" for time-machine tests. */
    now?: Date;
  }
): Promise<number> {
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
    select: {
      id: true,
      title: true,
      userId: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!ad?.expiresAt) return 0;
  if (ad.status !== 'REVIEW' && ad.status !== 'APPROVED') return 0;

  const reminderDaysArray =
    options?.daysBeforeExpiry === undefined
      ? await getReminderDaysBeforeExpiry()
      : normalizeReminderDays(options.daysBeforeExpiry, 'before');

  if (reminderDaysArray.length === 0) return 0;

  const deliver = options?.deliver ?? queueAdWillExpireNotification;
  const sentKeys = await getSentPreExpiryReminderKeys(ad.id);
  const now = options?.now ?? new Date();
  const expiryDateStr = formatISTDate(ad.expiresAt);
  const sortedDesc = [...reminderDaysArray].sort((a, b) => b - a);

  let queued = 0;

  for (let i = 0; i < sortedDesc.length; i++) {
    const reminderDays = sortedDesc[i];
    const nextSmaller = i < sortedDesc.length - 1 ? sortedDesc[i + 1] : 0;
    const { windowStart, windowEnd } = buildWindowBounds(now, reminderDays, nextSmaller);

    if (!(ad.expiresAt > windowStart && ad.expiresAt <= windowEnd)) {
      continue;
    }

    const key = preExpiryReminderKey(ad.id, reminderDays, expiryDateStr);
    if (sentKeys.has(key)) continue;

    try {
      await deliver(
        ad.userId,
        ad.id,
        ad.title,
        expiryDateStr,
        reminderDays
      );
      sentKeys.add(key);
      queued++;
    } catch (err) {
      console.error(`Failed to queue pre-expiry reminder for ad ${ad.id}:`, err);
    }
  }

  return queued;
}

/**
 * Shared tiered-window scan used by the normal (non-debug) cron path.
 */
export async function queuePreExpiryRemindersForWindows(options?: {
  daysBeforeExpiry?: number[];
  adId?: string;
  deliver?: PreExpiryDeliverFn;
}): Promise<void> {
  const reminderDaysArray =
    options?.daysBeforeExpiry === undefined
      ? await getReminderDaysBeforeExpiry()
      : normalizeReminderDays(options.daysBeforeExpiry, 'before');

  if (reminderDaysArray.length === 0) {
    console.log('No reminder days configured — skipping');
    return;
  }

  const deliver = options?.deliver ?? queueAdWillExpireNotification;
  const sentKeys = await getSentPreExpiryReminderKeys(options?.adId);
  const now = new Date();
  const sortedDesc = [...reminderDaysArray].sort((a, b) => b - a);

  for (let i = 0; i < sortedDesc.length; i++) {
    const reminderDays = sortedDesc[i];
    const nextSmaller = i < sortedDesc.length - 1 ? sortedDesc[i + 1] : 0;
    const { windowStart, windowEnd } = buildWindowBounds(now, reminderDays, nextSmaller);

    const expiringAds = await prisma.ad.findMany({
      where: {
        expiresAt: { gt: windowStart, lte: windowEnd },
        status: { in: ['REVIEW', 'APPROVED'] },
        ...(options?.adId ? { id: options.adId } : {}),
      },
      select: {
        id: true,
        title: true,
        userId: true,
        expiresAt: true,
      },
    });

    console.log(`Found ${expiringAds.length} ads within ${reminderDays}-day window`);

    for (const ad of expiringAds) {
      if (!ad.expiresAt) continue;
      const expiryDateStr = formatISTDate(ad.expiresAt);
      const key = preExpiryReminderKey(ad.id, reminderDays, expiryDateStr);
      if (sentKeys.has(key)) continue;

      try {
        await deliver(
          ad.userId,
          ad.id,
          ad.title,
          expiryDateStr,
          reminderDays
        );
        sentKeys.add(key);
      } catch (err) {
        console.error(`Failed to queue expiration reminder for ad ${ad.id}:`, err);
      }
    }
  }
}
