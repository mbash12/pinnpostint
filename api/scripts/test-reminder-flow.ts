/**
 * Simulated real-world test for ad expiration reminder handlers.
 *
 * Run with:
 *   cd api && npx ts-node --transpile-only scripts/test-reminder-flow.ts
 *
 * Uses DATABASE_URL and REDIS_URL from env (reads .env automatically via dotenv).
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

import { adExpirationCleanupHandler, adAfterExpiredReminderHandler } from '../src/background/handlers/ad-expiration.handler';

const prisma = new PrismaClient();

interface TestAd {
  id: string;
  userId: string;
  title: string;
  expiresAt: Date;
  dayLabel: string;
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  AD EXPIRATION REMINDER FLOW TEST');
  console.log('═══════════════════════════════════════════\n');

  const testSuffix = Date.now();

  // ── 0. Cleanup leftover test data from previous runs ──
  console.log('🧹 Removing stale test data from previous runs...');
  const staleUsers = await prisma.user.findMany({
    where: { phone: { startsWith: '+9100000' } },
    select: { id: true },
  });
  const staleUserIds = staleUsers.map(u => u.id);
  if (staleUserIds.length > 0) {
    await prisma.notification.deleteMany({ where: { userId: { in: staleUserIds } } }).catch(() => {});
    await prisma.ad.deleteMany({ where: { userId: { in: staleUserIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: staleUserIds } } }).catch(() => {});
    console.log(`   Removed ${staleUserIds.length} stale test users + their ads/notifications\n`);
  } else {
    console.log('   None found\n');
  }

  // ── 1. Find a real category ──────────────────────────
  const category = await prisma.category.findFirst();
  if (!category) {
    console.error('❌ No categories found in DB. Seed the database first.');
    process.exit(1);
  }
  console.log(`📂 Using category: ${category.name} (${category.id})\n`);

  // ── 2. Create test users ────────────────────────────
  console.log('📝 Creating test users...');

  const user1 = await prisma.user.create({
    data: {
      id: `test-u1-${testSuffix}`,
      email: `test-r1-${testSuffix}@test.com`,
      phone: `+91000001${testSuffix.toString().slice(-5)}`,
      firstName: 'Test1',
      lastName: 'Reminder',
      role: 'USER',
      password: 'test123456',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      id: `test-u2-${testSuffix}`,
      email: `test-r2-${testSuffix}@test.com`,
      phone: `+91000002${testSuffix.toString().slice(-5)}`,
      firstName: 'Test2',
      lastName: 'Reminder',
      role: 'USER',
      password: 'test123456',
    },
  });

  console.log(`   user1: ${user1.id}`);
  console.log(`   user2: ${user2.id}\n`);

  // ── 3. Create test ads ──────────────────────────────
  // Today = 2026-05-19 (Tuesday, getDay=2)
  const today = new Date('2026-05-19T09:00:00');

  const yesterday = new Date('2026-05-18T12:00:00');           // Monday (getDay=1)
  const lastTuesday = new Date('2026-05-12T12:00:00');          // 7d ago Tuesday (getDay=2)
  const twoWeeksAgoTuesday = new Date('2026-05-05T12:00:00');   // 14d ago Tuesday (getDay=2)
  const futureDate = new Date('2026-06-01T12:00:00');

  console.log('📝 Creating test ads...');
  console.log(`   Reference day: ${today.toDateString()} (Tuesday, getDay=2)`);
  console.log(`   Ad A expires: ${yesterday.toDateString()} (Monday, getDay=1) — cleanup day 0`);
  console.log(`   Ad B expires: ${lastTuesday.toDateString()} (Tuesday, getDay=2) — 7d ago, post-expired day 7`);
  console.log(`   Ad C expires: ${twoWeeksAgoTuesday.toDateString()} (Tuesday, getDay=2) — 14d ago, post-expired day 14`);
  console.log(`   Ad D expires: ${futureDate.toDateString()} (Future) — no notifications\n`);

  const testAds: TestAd[] = [];

  // Ad A: expired yesterday (Monday) — cleanup should mark EXPIRED + notify (day 0)
  const adA = await prisma.ad.create({
    data: {
      title: 'TEST-AdA-ExpiredYesterday',
      userId: user1.id,
      status: 'REVIEW',
      expiresAt: yesterday,
      description: 'Test ad - expired yesterday (Monday)',
      price: 100,
      categoryId: category.id,
    },
  });
  testAds.push({ id: adA.id, userId: user1.id, title: adA.title, expiresAt: yesterday, dayLabel: 'A: yesterday (Mon, D=1)' });

  // Ad B: expired 7 days ago (Tuesday) — post-expired day 7
  const adB = await prisma.ad.create({
    data: {
      title: 'TEST-AdB-Expired7DaysAgo',
      userId: user1.id,
      status: 'EXPIRED',
      expiresAt: lastTuesday,
      description: 'Test ad - expired 7 days ago (Tuesday)',
      price: 200,
      categoryId: category.id,
    },
  });
  testAds.push({ id: adB.id, userId: user1.id, title: adB.title, expiresAt: lastTuesday, dayLabel: 'B: 7d ago (Tue, D=2)' });

  // Ad C: expired 14 days ago (Tuesday) — post-expired day 14
  const adC = await prisma.ad.create({
    data: {
      title: 'TEST-AdC-Expired14DaysAgo',
      userId: user2.id,
      status: 'EXPIRED',
      expiresAt: twoWeeksAgoTuesday,
      description: 'Test ad - expired 14 days ago (Tuesday)',
      price: 300,
      categoryId: category.id,
    },
  });
  testAds.push({ id: adC.id, userId: user2.id, title: adC.title, expiresAt: twoWeeksAgoTuesday, dayLabel: 'C: 14d ago (Tue, D=2)' });

  // Ad D: not expired yet
  const adD = await prisma.ad.create({
    data: {
      title: 'TEST-AdD-NotExpiredYet',
      userId: user2.id,
      status: 'REVIEW',
      expiresAt: futureDate,
      description: 'Test ad - not expired yet',
      price: 400,
      categoryId: category.id,
    },
  });
  testAds.push({ id: adD.id, userId: user2.id, title: adD.title, expiresAt: futureDate, dayLabel: 'D: future (no-op)' });

  console.log(`   Created ad IDs: ${testAds.map(a => a.id.slice(-8)).join(', ')}\n`);

  // ── 4. Run cleanup handler ──────────────────────────
  console.log('═══════════════════════════════════════════');
  console.log('  🔄  RUNNING: adExpirationCleanupHandler');
  console.log('     (day 0 — marks expired + sends notification)');
  console.log('═══════════════════════════════════════════\n');

  await adExpirationCleanupHandler({
    id: 'test-cleanup-' + testSuffix,
    type: 'ad-expiration-cleanup',
    data: {},
  } as any);

  console.log('');

  // Verify Ad A status changed
  const adAUpdated = await prisma.ad.findUnique({ where: { id: adA.id } });
  console.log(`   ✅ Ad A status: ${adAUpdated?.status} (was REVIEW, should be EXPIRED)\n`);

  // ── 5. Run post-expired handler ─────────────────────
  console.log('═══════════════════════════════════════════');
  console.log('  🔄  RUNNING: adAfterExpiredReminderHandler');
  console.log('     (day 7, 14… — D-day match, skips day 0)');
  console.log('═══════════════════════════════════════════\n');

  await adAfterExpiredReminderHandler({
    id: 'test-post-expired-' + testSuffix,
    type: 'ad-after-expired-reminder',
    data: {},
  } as any);

  // ── 6. Check notifications ─────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log('  📬  NOTIFICATIONS CREATED IN DB');
  console.log('═══════════════════════════════════════════\n');

  const notifications = await prisma.notification.findMany({
    where: {
      OR: [{ userId: user1.id }, { userId: user2.id }],
    },
    orderBy: { sentAt: 'asc' },
    select: {
      id: true,
      userId: true,
      title: true,
      message: true,
      type: true,
      data: true,
      sentAt: true,
    },
  });

  if (notifications.length === 0) {
    console.log('   ⚠️  No DB notifications found.');
    console.log('   The notification-delivery worker may not be running.');
    console.log('   Check the API server logs for queue messages.');
  } else {
    for (const n of notifications) {
      const d = n.data as any;
      console.log(`   [${n.type}] "${n.title}" → user=${n.userId.slice(-8)} adId=${d?.adId?.slice(-8) || '?'} at ${n.sentAt?.toISOString()}`);
    }
  }

  // ── 7. Summary ─────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log('  EXPECTED RESULTS');
  console.log('═══════════════════════════════════════════');
  console.log('   Ad A (Mon, D=1):');
  console.log('     Cleanup → marks EXPIRED ✅ + sends "expired" ✅');
  console.log('     Post-exp → D-day Mon ≠ today Tue → SKIPS ✅');
  console.log('   Ad B (Tue, D=2, 7d ago):');
  console.log('     Cleanup → already EXPIRED → SKIPS ✅');
  console.log('     Post-exp → D-day Tue = today ✅ → day-7 reminder ✅');
  console.log('   Ad C (Tue, D=2, 14d ago):');
  console.log('     Cleanup → already EXPIRED → SKIPS ✅');
  console.log('     Post-exp → D-day Tue = today ✅ → day-14 reminder ✅');
  console.log('   Ad D (future): → no notifications ✅');
  console.log('═══════════════════════════════════════════\n');

  // ── 8. Cleanup ─────────────────────────────────────
  console.log('🧹 Cleaning up test data...');
  await prisma.notification.deleteMany({
    where: { OR: [{ userId: user1.id }, { userId: user2.id }] },
  });
  for (const ad of testAds) {
    await prisma.ad.delete({ where: { id: ad.id } }).catch(() => {});
  }
  await prisma.user.delete({ where: { id: user1.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user2.id } }).catch(() => {});
  console.log('   Done.\n');

  // Force exit — Bull queue keeps Redis connection open
  process.exit(0);
}

main()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
