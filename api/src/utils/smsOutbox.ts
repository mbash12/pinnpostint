import { OutgoingSmsStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './database';
import { sendSms } from './sms';

/**
 * Persistent SMS outbox.
 *
 * Replaces the previous fire-and-forget pattern where any network blip
 * during the SMS provider HTTP call silently lost the message. Every
 * send now goes through `enqueueSms` which:
 *
 *   1. Writes an `outgoing_sms` row (status PENDING, nextRetryAt = now)
 *   2. Attempts an immediate send
 *   3. On success → row goes to SENT
 *   4. On failure → row stays PENDING with exponential backoff
 *
 * The `sms-outbox-drain` Bull cron job (every 60s) sweeps rows whose
 * `nextRetryAt <= now` and retries them. After `maxAttempts` retries
 * the row is marked FAILED for manual inspection.
 *
 * The outbox lives in Postgres so it survives Redis outages. If the
 * provider is down for an hour, every queued SMS will eventually be
 * delivered as soon as the provider recovers.
 */

export type SmsKind = 'notification' | 'otp' | 'admin-test';

/** Structured ops metadata shown on the admin SMS outbox monitor. */
export type SmsOutboxMeta = {
  adId?: string;
  adTitle?: string;
  notificationType?: string;
  reminderDays?: number;
  expiryDate?: string;
  /** Short label e.g. "pre-expiry:10d" or "approved" */
  label?: string;
};

export interface EnqueueSmsInput {
  to: string;
  message: string;
  templateId?: string;
  kind?: SmsKind;
  /** Override the default max retry count (default 6 for notifications, 3 for otp). */
  maxAttempts?: number;
  meta?: SmsOutboxMeta;
}

export interface EnqueueSmsResult {
  /** True when the row was created (i.e. enqueueSms did not throw). */
  queued: boolean;
  /** True when the immediate send attempt succeeded. */
  sent: boolean;
  /** Outbox row id (always present when queued=true). */
  id?: string;
  /** Error from the immediate send attempt, if any. */
  error?: string;
}

export interface DrainResult {
  scanned: number;
  sent: number;
  failed: number;
  /** Rows that hit maxAttempts and were marked FAILED during this drain. */
  exhausted: number;
}

// ── backoff ────────────────────────────────────────────────────────
// retryCount = number of attempts that have already happened and failed.
// The returned delay is how long to wait before the next attempt.

const BASE_DELAY_MS = 60_000;        // 1 minute
const MAX_DELAY_MS = 30 * 60_000;    // 30 minutes

export function computeBackoffMs(retryCount: number): number {
  if (retryCount < 0) return BASE_DELAY_MS;
  const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
  return Math.min(delay, MAX_DELAY_MS);
}

const DEFAULT_MAX_ATTEMPTS: Record<SmsKind, number> = {
  notification: 6,
  otp: 3,
  'admin-test': 1,
};

/**
 * Enqueue an SMS for durable delivery.
 *
 * Never throws for SMS provider failures — those are recorded on the
 * outbox row and retried by the drain job. Only throws when the outbox
 * row itself cannot be written (i.e. Postgres is down).
 */
export async function enqueueSms(input: EnqueueSmsInput): Promise<EnqueueSmsResult> {
  const kind: SmsKind = input.kind ?? 'notification';
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS[kind];

  const row = await prisma.outgoingSms.create({
    data: {
      to: input.to,
      message: input.message,
      templateId: input.templateId ?? null,
      kind,
      status: 'PENDING',
      retryCount: 0,
      maxAttempts,
      nextRetryAt: new Date(),
      meta: (input.meta ?? null) as Prisma.InputJsonValue,
    },
  });

  // Try the immediate send. Failure here is non-fatal — the row is the
  // source of truth and the drain job will retry.
  const sendResult = await sendSms(input.to, input.message, {
    templateId: input.templateId,
  });

  if (sendResult.success) {
    await prisma.outgoingSms.update({
      where: { id: row.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        providerResponse: (sendResult.response ?? null) as Prisma.InputJsonValue,
      },
    });
    return { queued: true, sent: true, id: row.id };
  }

  await prisma.outgoingSms.update({
    where: { id: row.id },
    data: {
      status: 'PENDING',
      retryCount: 1,
      lastError: sendResult.error ?? 'Unknown SMS provider failure',
      nextRetryAt: new Date(Date.now() + computeBackoffMs(1)),
    },
  });
  return {
    queued: true,
    sent: false,
    id: row.id,
    error: sendResult.error,
  };
}

/**
 * Process one batch of due outbox rows.
 *
 * Selects up to `batchSize` PENDING rows whose `nextRetryAt <= now`,
 * attempts each one, and updates the row accordingly. Throwing causes
 * Bull to retry the whole drain batch — we catch everything per-row
 * so a single bad row cannot poison the batch.
 */
export async function drainOutbox(
  prismaClient: PrismaClient = prisma,
  options: { batchSize?: number; now?: Date } = {}
): Promise<DrainResult> {
  const batchSize = options.batchSize ?? 100;
  const now = options.now ?? new Date();

  const dueRows = await prismaClient.outgoingSms.findMany({
    where: {
      status: 'PENDING',
      nextRetryAt: { lte: now },
    },
    orderBy: { nextRetryAt: 'asc' },
    take: batchSize,
  });

  const result: DrainResult = { scanned: dueRows.length, sent: 0, failed: 0, exhausted: 0 };

  for (const row of dueRows) {
    try {
      const sendResult = await sendSms(row.to, row.message, {
        templateId: row.templateId ?? undefined,
      });

      if (sendResult.success) {
        await prismaClient.outgoingSms.update({
          where: { id: row.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            providerResponse: (sendResult.response ?? null) as Prisma.InputJsonValue,
          },
        });
        result.sent++;
        continue;
      }

      const newRetryCount = row.retryCount + 1;
      const exhausted = newRetryCount >= row.maxAttempts;
      await prismaClient.outgoingSms.update({
        where: { id: row.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          retryCount: newRetryCount,
          lastError: sendResult.error ?? 'Unknown SMS provider failure',
          nextRetryAt: new Date(Date.now() + computeBackoffMs(newRetryCount)),
          sentAt: exhausted ? null : undefined,
        },
      });
      if (exhausted) {
        result.exhausted++;
      } else {
        result.failed++;
      }
    } catch (error) {
      // A row-level exception (e.g. Prisma blip) must not abort the batch.
      // Push the row out a bit and continue.
      console.error(`[smsOutbox] row ${row.id} threw during drain:`, error);
      try {
        await prismaClient.outgoingSms.update({
          where: { id: row.id },
          data: {
            lastError: error instanceof Error ? error.message : String(error),
            nextRetryAt: new Date(Date.now() + computeBackoffMs(row.retryCount)),
          },
        });
      } catch (nestedErr) {
        console.error(`[smsOutbox] failed to record error for row ${row.id}:`, nestedErr);
      }
      result.failed++;
    }
  }

  return result;
}

/**
 * Get a summary of outbox health for observability / dashboards.
 */
export async function getOutboxStats(prismaClient: PrismaClient = prisma) {
  const grouped = await prismaClient.outgoingSms.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const counts: Record<OutgoingSmsStatus, number> = {
    PENDING: 0,
    SENT: 0,
    FAILED: 0,
    DEAD: 0,
  };
  for (const g of grouped) {
    counts[g.status] = g._count._all;
  }
  return counts;
}

export interface ListOutboxOptions {
  status?: OutgoingSmsStatus;
  kind?: string;
  page?: number;
  limit?: number;
  search?: string;
  /** Filter by meta.label contains, e.g. "pre-expiry" */
  label?: string;
  /** Filter by meta.reminderDays */
  reminderDays?: number;
}

export interface ListOutboxResult {
  rows: Awaited<ReturnType<PrismaClient['outgoingSms']['findMany']>>;
  total: number;
  page: number;
  limit: number;
}

/**
 * List outbox rows for the admin monitor.
 *
 * Filtering: status, kind, label/reminderDays (meta), and a substring
 * search over phone, message body, and common meta fields.
 */
export async function listOutboxRows(
  prismaClient: PrismaClient = prisma,
  options: ListOutboxOptions = {}
): Promise<ListOutboxResult> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));

  const where: Prisma.OutgoingSmsWhereInput = {};
  if (options.status) where.status = options.status;
  if (options.kind) where.kind = options.kind;

  const andFilters: Prisma.OutgoingSmsWhereInput[] = [];

  if (options.label) {
    if (options.label === 'pre-expiry') {
      // Match pre-expiry and pre-expiry:15d etc., not bare "expiry"
      andFilters.push({
        meta: {
          path: ['label'],
          string_contains: 'pre-expiry',
        },
      });
    } else {
      andFilters.push({
        meta: {
          path: ['label'],
          equals: options.label,
        },
      });
    }
  }

  if (typeof options.reminderDays === 'number' && Number.isFinite(options.reminderDays)) {
    andFilters.push({
      meta: {
        path: ['reminderDays'],
        equals: options.reminderDays,
      },
    });
  }

  if (options.search) {
    const safe = options.search.replace(/[%_]/g, '\\$&');
    andFilters.push({
      OR: [
        { to: { contains: safe, mode: 'insensitive' } },
        { message: { contains: safe, mode: 'insensitive' } },
        {
          meta: {
            path: ['adId'],
            string_contains: safe,
          },
        },
        {
          meta: {
            path: ['adTitle'],
            string_contains: safe,
          },
        },
        {
          meta: {
            path: ['label'],
            string_contains: safe,
          },
        },
      ],
    });
  }

  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  const [rows, total] = await Promise.all([
    prismaClient.outgoingSms.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prismaClient.outgoingSms.count({ where }),
  ]);

  return { rows, total, page, limit };
}

export type RetryOutboxResult =
  | { ok: true; row: { id: string; status: OutgoingSmsStatus; retryCount: number; nextRetryAt: Date } }
  | { ok: false; reason: 'not_found' | 'already_pending' };

/**
 * Re-queue a previously exhausted (FAILED) outbox row for another
 * attempt. Resets retryCount to 0, sets status to PENDING, and pushes
 * nextRetryAt to now so the next drain tick picks it up immediately.
 *
 * Returns `{ ok: false, reason: 'not_found' }` if the row doesn't
 * exist and `{ ok: false, reason: 'already_pending' }` if it's
 * already PENDING (retrying a row that's actively in flight would
 * duplicate the send).
 */
export async function retryOutboxRow(
  prismaClient: PrismaClient = prisma,
  id: string
): Promise<RetryOutboxResult> {
  const existing = await prismaClient.outgoingSms.findUnique({ where: { id } });
  if (!existing) return { ok: false, reason: 'not_found' };
  if (existing.status === 'PENDING') {
    return { ok: false, reason: 'already_pending' };
  }

  const updated = await prismaClient.outgoingSms.update({
    where: { id },
    data: {
      status: 'PENDING',
      retryCount: 0,
      nextRetryAt: new Date(),
      lastError: null,
    },
    select: { id: true, status: true, retryCount: true, nextRetryAt: true },
  });
  return { ok: true, row: updated };
}

export interface CleanupOptions {
  /** Delete rows whose `createdAt` is older than this many days. Default 30. */
  retentionDays?: number;
  /** Optional explicit clock for tests. Defaults to `new Date()`. */
  now?: Date;
}

export interface CleanupResult {
  cutoff: Date;
  retentionDays: number;
  deleted: number;
}

/** Default retention: covers max pre-expiry lead (15d) + buffer for admin tracker. */
export const DEFAULT_SMS_OUTBOX_RETENTION_DAYS = 30;

/**
 * Delete outbox rows older than `retentionDays`. Without this the
 * `outgoing_sms` table grows monotonically and eventually fills the
 * Postgres volume. Runs nightly via the `sms-outbox-cleanup` Bull cron.
 *
 * The cutoff is `now - retentionDays` on `createdAt` — i.e. rows we
 * haven't even attempted in N days. Safe to run while the drain cron
 * is also active because the drain only touches rows where
 * `status = PENDING`; we never delete a row that the drain is about
 * to retry (it's well within the retention window by construction since
 * maxAttempts is 6 with up to 30-min backoff per attempt).
 */
export async function cleanupOldOutboxRows(
  prismaClient: PrismaClient = prisma,
  options: CleanupOptions = {}
): Promise<CleanupResult> {
  const retentionDays = options.retentionDays ?? DEFAULT_SMS_OUTBOX_RETENTION_DAYS;
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  // Single DELETE with a WHERE clause — Postgres returns the count.
  const result = await prismaClient.outgoingSms.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return { cutoff, retentionDays, deleted: result.count };
}
