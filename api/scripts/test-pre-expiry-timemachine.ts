/**
 * Time-machine test for pre-expiry reminders (15 / 13 / 10) + renew-cycle dedup.
 *
 * Keeps a fixed expiresAt and advances a fake `now` through each lead-time
 * window (same helper used on approve/extend — no morning cron gate).
 *
 * Run (DB required):
 *   cd api && npx ts-node --transpile-only scripts/test-pre-expiry-timemachine.ts
 *
 * Local docker:
 *   make up   # or docker compose -f docker/docker-compose.yml up -d db
 *   # point api/.env DATABASE_URL at localhost, then run the command above
 *
 * Vagrant lab:
 *   cd infrastructure/vps-lab && vagrant up
 *   vagrant ssh -c 'cd /opt/pinnpostint/api && npx ts-node --transpile-only scripts/test-pre-expiry-timemachine.ts'
 */

import { PrismaClient, NotificationType } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

import { formatISTDate } from '../src/utils/notifications';
import {
  queueDuePreExpiryRemindersForAd,
  preExpiryReminderKey,
} from '../src/utils/pre-expiry-reminders';

const prisma = new PrismaClient();
const LEAD_DAYS = [15, 13, 10];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

/** Morning of (expiryDate - daysLeft), 08:00 local. */
function morningDaysBefore(expiry: Date, daysLeft: number): Date {
  const d = new Date(expiry);
  d.setDate(d.getDate() - daysLeft);
  d.setHours(8, 0, 0, 0);
  return d;
}

async function inlineDeliver(
  userId: string,
  adId: string,
  adTitle: string,
  expiryDate: string,
  reminderDays?: number
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      title:
        typeof reminderDays === 'number'
          ? `Advertisement Expires in ${reminderDays} Days`
          : 'Advertisement Expiring Soon',
      message: `Your advertisement "${adTitle}" will expire in ${reminderDays} days (${expiryDate}).`,
      type: NotificationType.SUBSCRIPTION_EXPIRY,
      data: { adId, adTitle, expiryDate, days: reminderDays },
    },
  });
  console.log(`   ✉️  SUBSCRIPTION_EXPIRY days=${reminderDays} expiry=${expiryDate}`);
}

async function daysForCycle(adId: string, expiryDate: string): Promise<number[]> {
  const rows = await prisma.notification.findMany({
    where: {
      type: NotificationType.SUBSCRIPTION_EXPIRY,
      data: { path: ['adId'], equals: adId },
    },
    select: { data: true },
    orderBy: { sentAt: 'asc' },
  });
  return rows
    .filter((r) => (r.data as any)?.expiryDate === expiryDate)
    .map((r) => (r.data as any).days as number)
    .filter((d) => typeof d === 'number');
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  PRE-EXPIRY TIME MACHINE (15 → 13 → 10 + renew)');
  console.log('═══════════════════════════════════════════════════\n');

  const suffix = Date.now();

  const stale = await prisma.user.findMany({
    where: { phone: { startsWith: '+9100009' } },
    select: { id: true },
  });
  if (stale.length) {
    const ids = stale.map((u) => u.id);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.ad.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.log(`🧹 Removed ${stale.length} stale test users\n`);
  }

  const category = await prisma.category.findFirst();
  if (!category) {
    console.error('❌ No categories — seed the DB first.');
    process.exit(1);
  }

  await prisma.setting.upsert({
    where: { key: 'reminder_expiration_days' },
    create: { key: 'reminder_expiration_days', value: LEAD_DAYS },
    update: { value: LEAD_DAYS },
  });
  console.log(`⚙️  reminder_expiration_days = ${JSON.stringify(LEAD_DAYS)}\n`);

  const user = await prisma.user.create({
    data: {
      id: `test-pre-${suffix}`,
      email: `pre-expiry-${suffix}@test.com`,
      phone: `+9100009${String(suffix).slice(-5)}`,
      firstName: 'PreExpiry',
      lastName: 'TimeMachine',
      role: 'USER',
      password: 'test123456',
    },
  });

  // Fixed expiry: 20 days from today at 18:00 (stable calendar target)
  const cycle1Expiry = new Date();
  cycle1Expiry.setDate(cycle1Expiry.getDate() + 20);
  cycle1Expiry.setHours(18, 0, 0, 0);
  const cycle1ExpiryStr = formatISTDate(cycle1Expiry);

  const ad = await prisma.ad.create({
    data: {
      title: `TEST-PreExpiry-${suffix}`,
      description: 'Time machine pre-expiry test ad',
      price: 99,
      status: 'APPROVED',
      expiresAt: cycle1Expiry,
      categoryId: category.id,
      userId: user.id,
    },
  });

  console.log(`📦 Ad ${ad.id}`);
  console.log(`   Cycle 1 expiresAt = ${cycle1ExpiryStr} (${cycle1Expiry.toISOString()})\n`);

  const runAt = async (label: string, daysLeft: number) => {
    const now = morningDaysBefore(cycle1Expiry, daysLeft);
    console.log(`── ${label} (fake now = ${now.toISOString()}, ~${daysLeft}d left) ──`);
    const queued = await queueDuePreExpiryRemindersForAd(ad.id, {
      daysBeforeExpiry: LEAD_DAYS,
      deliver: inlineDeliver,
      now,
    });
    return queued;
  };

  let queued = await runAt('T = expiry−15d', 15);
  assert(queued === 1, `15d: expected 1, got ${queued}`);
  let days = await daysForCycle(ad.id, cycle1ExpiryStr);
  assert(JSON.stringify(days) === '[15]', `after 15: ${JSON.stringify(days)}`);
  console.log('   ✅ 15 recorded\n');

  queued = await runAt('T = expiry−15d again (dedup)', 15);
  assert(queued === 0, `dedup at 15: expected 0, got ${queued}`);
  console.log('   ✅ dedup holds\n');

  queued = await runAt('T = expiry−12d (13-day window)', 12);
  assert(queued === 1, `13d: expected 1, got ${queued}`);
  days = await daysForCycle(ad.id, cycle1ExpiryStr);
  assert(days.includes(13) && days.includes(15), `after 13: ${JSON.stringify(days)}`);
  console.log(`   ✅ 13 recorded (${JSON.stringify(days)})\n`);

  queued = await runAt('T = expiry−9d (10-day window)', 9);
  assert(queued === 1, `10d: expected 1, got ${queued}`);
  days = await daysForCycle(ad.id, cycle1ExpiryStr);
  assert(
    days.includes(10) && days.includes(13) && days.includes(15),
    `after 10: ${JSON.stringify(days)}`
  );
  console.log(`   ✅ 10 recorded (${JSON.stringify(days)})\n`);

  // ── Renew / cycle 2 ─────────────────────────────────────
  console.log('── Renew: new expiresAt = +25d from real now (cycle 2) ──');
  const cycle2Expiry = new Date();
  cycle2Expiry.setDate(cycle2Expiry.getDate() + 25);
  cycle2Expiry.setHours(18, 0, 0, 0);
  const cycle2ExpiryStr = formatISTDate(cycle2Expiry);
  await prisma.ad.update({ where: { id: ad.id }, data: { expiresAt: cycle2Expiry } });
  console.log(`   Cycle 2 expiry = ${cycle2ExpiryStr}`);
  console.log(
    `   Old blocking key would have been: ${preExpiryReminderKey(ad.id, 10, cycle1ExpiryStr)}`
  );

  const runAtCycle2 = async (label: string, daysLeft: number) => {
    const now = morningDaysBefore(cycle2Expiry, daysLeft);
    console.log(`── ${label} (fake now = ${now.toISOString()}) ──`);
    return queueDuePreExpiryRemindersForAd(ad.id, {
      daysBeforeExpiry: LEAD_DAYS,
      deliver: inlineDeliver,
      now,
    });
  };

  queued = await runAtCycle2('Cycle2 T = expiry−15d', 15);
  assert(queued === 1, `cycle2 15d: expected 1, got ${queued}`);
  let c2 = await daysForCycle(ad.id, cycle2ExpiryStr);
  assert(c2.includes(15), `cycle2 days ${JSON.stringify(c2)}`);
  console.log(`   ✅ cycle2 15 (${JSON.stringify(c2)})\n`);

  queued = await runAtCycle2('Cycle2 T = expiry−9d (must NOT be blocked by cycle1 10)', 9);
  assert(
    queued === 1,
    `cycle2 10d: expected 1, got ${queued} — cross-cycle dedup bug still present?`
  );
  c2 = await daysForCycle(ad.id, cycle2ExpiryStr);
  assert(c2.includes(10) && c2.includes(15), `cycle2 after 10: ${JSON.stringify(c2)}`);
  console.log(`   ✅ cycle2 10 sent — renew dedup fix verified (${JSON.stringify(c2)})\n`);

  console.log('═══════════════════════════════════════════════════');
  console.log('  ALL ASSERTIONS PASSED');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('🧹 Cleaning up…');
  await prisma.notification.deleteMany({ where: { userId: user.id } });
  await prisma.ad.delete({ where: { id: ad.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  console.log('   Done.\n');
  process.exit(0);
}

main()
  .catch(async (e) => {
    console.error('\n❌ TIME MACHINE FAILED:', e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
