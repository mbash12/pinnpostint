#!/usr/bin/env node
/**
 * Catch-up: queue any due pre-expiry reminder tiers for specific ads,
 * bypassing the morning/afternoon cron time-gate.
 *
 * Uses the compiled dist (no ts-node needed) so it runs inside the
 * `pinn-api` container:
 *
 *   docker exec pinn-api node /app/scripts/catchup-pre-expiry.js <adId>...
 *
 * If no adIds are passed, auto-detects APPROVED/REVIEW ads expiring
 * within 16 days that are missing their smallest configured lead tier
 * (the one most commonly wedged) and queues them.
 *
 * This does NOT send SMS directly. It calls the normal
 * `queueDuePreExpiryRemindersForAd` → `queueAdWillExpireNotification`
 * path, which enqueues `notification-delivery` Bull jobs into Redis.
 * The running API worker then drains them through the durable outbox,
 * producing real `outgoing_sms` rows with correct `pre-expiry:Nd`
 * labels — exactly as the morning cron would.
 */
'use strict';

const path = require('path');
// Dist is at /app/dist/src/... inside the container.
const distRoot = path.resolve(__dirname, '..', 'dist', 'src');

async function main() {
  const argAdIds = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const auto = argAdIds.length === 0 || argAdIds.includes('--auto');

  const { prisma } = require(path.join(distRoot, 'utils', 'database.js'));
  const {
    queueDuePreExpiryRemindersForAd,
  } = require(path.join(distRoot, 'utils', 'pre-expiry-reminders.js'));

  let adIds = argAdIds.filter((a) => !a.startsWith('--'));
  if (auto) {
    console.log('🔍 Auto-detecting APPROVED/REVIEW ads expiring within 16 days…');
    const rows = await prisma.ad.findMany({
      where: {
        status: { in: ['APPROVED', 'REVIEW'] },
        expiresAt: {
          gt: new Date(),
          lt: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true, title: true, expiresAt: true },
      orderBy: { expiresAt: 'asc' },
    });
    adIds = rows.map((r) => r.id);
    console.log(`   found ${adIds.length} ad(s)`);
    for (const r of rows) {
      console.log(`   • ${r.id}  "${r.title}"  expires ${r.expiresAt.toISOString()}`);
    }
  }

  if (adIds.length === 0) {
    console.log('No ads to catch up. Bye.');
    await prisma.$disconnect();
    return;
  }

  let totalQueued = 0;
  for (const adId of adIds) {
    try {
      const queued = await queueDuePreExpiryRemindersForAd(adId);
      totalQueued += queued;
      console.log(`✓ ${adId}: queued ${queued} reminder tier(s)`);
    } catch (err) {
      console.error(`✗ ${adId}: failed — ${err.message}`);
    }
  }

  console.log(`\nDone. ${totalQueued} reminder tier(s) queued across ${adIds.length} ad(s).`);
  console.log('The API worker will drain these into outgoing_sms shortly.');
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('catchup failed:', e);
  process.exit(1);
});