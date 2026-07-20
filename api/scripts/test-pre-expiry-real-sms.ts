/**
 * Real SMS time-machine for pre-expiry (hits outbox + provider).
 *
 *   cd api
 *   DATABASE_URL=... TEST_SMS_PHONE=7777777777 \
 *     npx ts-node --transpile-only scripts/test-pre-expiry-real-sms.ts
 *
 * Sends a small set of pre-expiry SMS via sendAdWillExpireNotification
 * (notification + outgoing_sms). Uses fake `now` so we don't wait days.
 */

import { PrismaClient, NotificationType } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

import { formatISTDate, sendAdWillExpireNotification } from '../src/utils/notifications';
import { queueDuePreExpiryRemindersForAd } from '../src/utils/pre-expiry-reminders';

const prisma = new PrismaClient();
const LEAD_DAYS = [15, 13, 10];
const TEST_PHONE = (process.env.TEST_SMS_PHONE || '7777777777').replace(/\D/g, '');

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function morningDaysBefore(expiry: Date, daysLeft: number): Date {
  const d = new Date(expiry);
  d.setDate(d.getDate() - daysLeft);
  d.setHours(8, 0, 0, 0);
  return d;
}

async function realDeliver(
  userId: string,
  adId: string,
  _adTitle: string,
  expiryDate: string,
  reminderDays?: number
): Promise<void> {
  const result = await sendAdWillExpireNotification(
    userId,
    adId,
    expiryDate,
    reminderDays
  );
  console.log(
    `   📱 deliver days=${reminderDays} push=${result.pushSuccess} email=${result.emailSuccess} sms=${result.smsSuccess}`
  );
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  PRE-EXPIRY REAL SMS TIME MACHINE');
  console.log(`  phone = ${TEST_PHONE}`);
  console.log('═══════════════════════════════════════════════════\n');

  const suffix = Date.now();

  const stale = await prisma.user.findMany({
    where: { phone: { in: [TEST_PHONE, `+91${TEST_PHONE}`, `91${TEST_PHONE}`] }, email: { startsWith: 'pre-sms-' } },
    select: { id: true },
  });
  // Also clean prior script users
  const stale2 = await prisma.user.findMany({
    where: { email: { startsWith: 'pre-sms-' } },
    select: { id: true },
  });
  const staleIds = [...new Set([...stale, ...stale2].map((u) => u.id))];
  if (staleIds.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: staleIds } } });
    await prisma.ad.deleteMany({ where: { userId: { in: staleIds } } });
    await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    console.log(`🧹 Removed ${staleIds.length} stale users\n`);
  }

  const category = await prisma.category.findFirst();
  if (!category) {
    console.error('❌ No categories — seed DB first');
    process.exit(1);
  }

  await prisma.setting.upsert({
    where: { key: 'reminder_expiration_days' },
    create: { key: 'reminder_expiration_days', value: LEAD_DAYS },
    update: { value: LEAD_DAYS },
  });

  const user = await prisma.user.create({
    data: {
      id: `test-presms-${suffix}`,
      email: `pre-sms-${suffix}@test.com`,
      phone: TEST_PHONE,
      firstName: 'PreSms',
      lastName: 'Real',
      role: 'USER',
      password: 'test123456',
    },
  });

  const cycle1Expiry = new Date();
  cycle1Expiry.setDate(cycle1Expiry.getDate() + 20);
  cycle1Expiry.setHours(18, 0, 0, 0);
  const cycle1ExpiryStr = formatISTDate(cycle1Expiry);

  const ad = await prisma.ad.create({
    data: {
      title: `REAL-SMS-PreExpiry-${suffix}`,
      description: 'Real SMS pre-expiry time machine',
      price: 99,
      status: 'APPROVED',
      expiresAt: cycle1Expiry,
      categoryId: category.id,
      userId: user.id,
    },
  });

  console.log(`📦 Ad ${ad.id}`);
  console.log(`   Cycle 1 expiry ${cycle1ExpiryStr}\n`);

  const smsBefore = await prisma.outgoingSms.count({
    where: { to: { contains: TEST_PHONE.replace(/^\+91/, '').slice(-10) } },
  });

  const run = async (label: string, daysLeft: number, expiry: Date) => {
    const now = morningDaysBefore(expiry, daysLeft);
    console.log(`── ${label} (now=${now.toISOString()}) ──`);
    return queueDuePreExpiryRemindersForAd(ad.id, {
      daysBeforeExpiry: LEAD_DAYS,
      deliver: realDeliver,
      now,
    });
  };

  assert((await run('15d', 15, cycle1Expiry)) === 1, '15d queue');
  assert((await run('15d dedup', 15, cycle1Expiry)) === 0, '15d dedup');
  assert((await run('13d', 12, cycle1Expiry)) === 1, '13d queue');
  assert((await run('10d', 9, cycle1Expiry)) === 1, '10d queue');

  // Renew cycle
  const cycle2Expiry = new Date();
  cycle2Expiry.setDate(cycle2Expiry.getDate() + 25);
  cycle2Expiry.setHours(18, 0, 0, 0);
  const cycle2ExpiryStr = formatISTDate(cycle2Expiry);
  await prisma.ad.update({ where: { id: ad.id }, data: { expiresAt: cycle2Expiry } });
  console.log(`\n── Renew → ${cycle2ExpiryStr} ──`);
  assert((await run('cycle2 15d', 15, cycle2Expiry)) === 1, 'cycle2 15');
  assert((await run('cycle2 10d (not blocked)', 9, cycle2Expiry)) === 1, 'cycle2 10');

  const notifs = await prisma.notification.findMany({
    where: {
      userId: user.id,
      type: NotificationType.SUBSCRIPTION_EXPIRY,
    },
    orderBy: { sentAt: 'asc' },
    select: { title: true, data: true, sentAt: true },
  });

  console.log('\n── Notifications ──');
  for (const n of notifs) {
    const d = n.data as any;
    console.log(`   ${n.sentAt?.toISOString()}  days=${d?.days}  expiry=${d?.expiryDate}  ${n.title}`);
  }

  const smsRows = await prisma.outgoingSms.findMany({
    where: {
      to: { contains: TEST_PHONE.slice(-10) },
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      to: true,
      status: true,
      createdAt: true,
      sentAt: true,
      lastError: true,
      meta: true,
      message: true,
    },
  });

  console.log('\n── Outgoing SMS (last 10 min for this phone) ──');
  for (const s of smsRows) {
    const meta = (s.meta || {}) as any;
    console.log(
      `   ${s.createdAt.toISOString()}  ${s.status}  label=${meta.label ?? '—'}  days=${meta.reminderDays ?? '—'}  err=${s.lastError ?? '—'}`
    );
    console.log(`      ${s.message.slice(0, 90)}…`);
  }

  const smsAfter = smsRows.length;
  const sentOk = smsRows.filter((s) => s.status === 'SENT').length;
  const pending = smsRows.filter((s) => s.status === 'PENDING').length;
  const failed = smsRows.filter((s) => s.status === 'FAILED').length;

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Notifications: ${notifs.length} (expect 5: 15,13,10 + c2:15,10)`);
  console.log(`  Outbox rows this run: ${smsAfter} (baseline before was ~${smsBefore})`);
  console.log(`  SENT=${sentOk}  PENDING=${pending}  FAILED=${failed}`);
  console.log('═══════════════════════════════════════════════════\n');

  assert(notifs.length === 5, `expected 5 notifications, got ${notifs.length}`);
  assert(smsAfter >= 5, `expected ≥5 outbox rows, got ${smsAfter}`);

  if (sentOk < 5) {
    console.log(
      '⚠️  Not all SMS status=SENT — check provider / PENDING retries. Notifications + outbox rows were created.'
    );
  } else {
    console.log('✅ All 5 SMS reported SENT by provider/outbox.');
  }

  // Keep data briefly for admin UI inspection? User asked to test — clean up by default
  // but leave a note. Cleanup to avoid littering.
  console.log('\n🧹 Cleaning test user/ad/notifications (outbox rows kept for audit)…');
  await prisma.notification.deleteMany({ where: { userId: user.id } });
  await prisma.ad.delete({ where: { id: ad.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  console.log('   Done. Outbox SMS rows remain — filter phone in admin SMS Outbox.\n');

  process.exit(sentOk >= 1 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error('\n❌ REAL SMS TEST FAILED:', e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
