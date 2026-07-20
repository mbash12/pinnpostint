import { Job, JobHandler } from '../interfaces/job.interface';
import { NotificationType } from '@prisma/client';
import { prisma } from '../../utils/database';
import { queueAdStatusNotification, queueAdWillExpireNotification } from '../queues/notification.queue';
import { formatISTDate } from '../../utils/notifications';
import { queuePreExpiryRemindersForWindows } from '../../utils/pre-expiry-reminders';

import { config } from '../../config/environment';

// ── helpers ──────────────────────────────────────────────────────────


/**
 * Return a Set of adIds that already got an AD_EXPIRED notification today.
 * Prevents duplicate sends within the morning/afternoon window (up to ~12
 * ticks per window). Resets at midnight so weekly D-day reminders still
 * fire each week.
 */
async function getSentPostExpiryKeysToday(): Promise<Set<string>> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const rows = await prisma.notification.findMany({
    where: {
      type: NotificationType.AD_EXPIRED,
      sentAt: { gte: todayStart },
    },
    select: { data: true },
  });

  const keys = new Set<string>();
  for (const row of rows) {
    const d = row.data as Record<string, unknown> | null;
    if (d?.adId) {
      keys.add(String(d.adId));
    }
  }
  return keys;
}

/**
 * Return a Set of adIds that already got a SUBSCRIPTION_EXPIRY notification today.
 * Used to prevent duplicate pre-expiry debug sends within the 10-min cron ticks.
 */
async function getSentPreExpiryKeysToday(): Promise<Set<string>> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const rows = await prisma.notification.findMany({
    where: {
      type: NotificationType.SUBSCRIPTION_EXPIRY,
      sentAt: { gte: todayStart },
    },
    select: { data: true },
  });

  const keys = new Set<string>();
  for (const row of rows) {
    const d = row.data as Record<string, unknown> | null;
    if (d?.adId) {
      keys.add(String(d.adId));
    }
  }
  return keys;
}

/**
 * Post-expiry reminder handler — weekly D-day reminders + debug daily mode.
 *
 * Normal: runs 8 AM IST window, sends to EXPIRED ads whose D-day matches
 * today's day of week (weekly repeat).
 * Debug (EXPIRED_NOTIFICATION_DEBUG=true): runs 2 PM IST window, sends to
 * ALL expired ads daily.
 *
 * Cron: every 10 min during both windows (2-4,8-9 UTC).
 * Same-day dedup via getSentPostExpiryKeysToday() prevents double-sends.
 */
export const adAfterExpiredReminderHandler: JobHandler<{ adId?: string }> = async (
  job: Job<{ adId?: string }>
): Promise<void> => {
  console.log(`Processing ad after expired reminder job ${job.id}`);

  try {
    const { adId } = job.data;
    const isDebugMode = config.server.expiredNotificationDebug;

    // ── Time gate ──────────────────────────────────────────────
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const inMorning = utcHour >= 2 && utcHour <= 3;               // 7:30-9:20 AM IST
    const inAfternoon =                                           // 2:00-2:30 PM IST
      (utcHour === 8 && utcMinute >= 30) ||
      (utcHour === 9 && utcMinute === 0);


    if (isDebugMode && !inAfternoon) {
      console.log(`[DEBUG] Skipping post-expiry — outside 2 PM IST window (UTC hour ${utcHour})`);
      return;
    }
    if (!isDebugMode && !inMorning) {
      console.log(`Skipping post-expiry — outside 8 AM IST window (UTC hour ${utcHour})`);
      return;
    }

    const todayDayOfWeek = new Date().getDay();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const expiredAds = await prisma.ad.findMany({
      where: {
        status: 'EXPIRED',
        expiresAt: { not: null },
        ...(adId ? { id: adId } : {}),
      },
      include: { user: true },
    });

    if (expiredAds.length === 0) {
      console.log(`No expired ads found for reminder job ${job.id}`);
      return;
    }

    // Filter: D-day match (normal) or all (debug). Exclude day 0.
    const adsToNotify = expiredAds.filter(ad => {
      if (!ad.expiresAt) return false;
      if (ad.expiresAt >= todayStart) return false; // exclude today
      if (!isDebugMode && ad.expiresAt.getDay() !== todayDayOfWeek) return false;
      return true;
    });

    if (adsToNotify.length === 0) {
      const desc = isDebugMode ? 'debug: daily' : `day ${todayDayOfWeek}`;
      console.log(`No expired ads to notify (${desc}) for job ${job.id}`);
      return;
    }

    // Dedup: skip ads already notified today (batched query + in-memory Set)
    const sentToday = await getSentPostExpiryKeysToday();

    let queuedCount = 0;
    for (const ad of adsToNotify) {
      if (sentToday.has(ad.id)) continue;

      const expiryDateStr = ad.expiresAt ? formatISTDate(ad.expiresAt) : undefined;
      await queueAdStatusNotification(
        ad.userId,
        ad.id,
        ad.title,
        'EXPIRED',
        undefined,
        ad.slug || undefined,
        expiryDateStr,
        undefined,
        'post-expiry'
      ).catch(err =>
        console.error(`Failed to queue post-expiration reminder for ad ${ad.id}:`, err)
      );

      sentToday.add(ad.id);
      queuedCount++;
    }

    const modeLabel = isDebugMode ? 'debug: daily' : `day ${todayDayOfWeek}`;
    console.log(
      `Ad after expired reminder job ${job.id} completed. ` +
      `Queued ${queuedCount}/${adsToNotify.length} (${modeLabel}, ${expiredAds.length} total expired)`
    );
  } catch (error) {
    console.error(`Ad after expired reminder job ${job.id} failed:`, error);
    throw error;
  }
};

/**
 * Pre-expiry reminder handler — sliding window with dedup.
 *
 * Debug mode (EXPIRED_NOTIFICATION_DEBUG=true):
 *   Hardcoded 7-day window, no settings, no dedup — sends daily to every
 *   APPROVED/REVIEW ad expiring within 7 days. Runs 2:00-2:30 PM IST.
 */
export const adExpirationReminderHandler: JobHandler<{ daysBeforeExpiry?: number[]; adId?: string }> = async (
  job: Job<{ daysBeforeExpiry?: number[]; adId?: string }>
): Promise<void> => {
  console.log(`Processing ad expiration reminder job ${job.id}`);

  try {
    const { daysBeforeExpiry, adId } = job.data;
    const isDebugMode = config.server.expiredNotificationDebug;

    // ── Time gate ──────────────────────────────────────────────
    const gateNow = new Date();
    const utcHour = gateNow.getUTCHours();
    const utcMinute = gateNow.getUTCMinutes();
    const inMorning = utcHour >= 2 && utcHour <= 3;               // 7:30-9:20 AM IST
    const inAfternoon =                                           // 2:00-5:00 PM IST
      (utcHour === 8 && utcMinute >= 30) ||
      (utcHour >= 9 && utcHour <= 10) ||
      (utcHour === 11 && utcMinute <= 30);


    if (isDebugMode && !inAfternoon) {
      console.log(`[DEBUG] Skipping pre-expiry — outside window (UTC hour ${utcHour})`);
      return;
    }
    if (!isDebugMode && !inMorning) {
      console.log(`Skipping pre-expiry — outside 8 AM IST window (UTC hour ${utcHour})`);
      return;
    }

    if (isDebugMode) {
      // ── Debug: hardcoded 7-day window, dedup harian ──
      const DEBUG_WINDOW_DAYS = 7;
      const now = new Date();
      const windowEnd = new Date(now);
      windowEnd.setDate(windowEnd.getDate() + DEBUG_WINDOW_DAYS);
      windowEnd.setHours(23, 59, 59, 999);

      const sentToday = await getSentPreExpiryKeysToday();
      const ads = await prisma.ad.findMany({
        where: {
          expiresAt: { gt: now, lte: windowEnd },
          status: { in: ['REVIEW', 'APPROVED'] },
          ...(adId ? { id: adId } : {}),
        },
        include: { user: true },
      });

      console.log(`[DEBUG] Found ${ads.length} ads within ${DEBUG_WINDOW_DAYS}-day window`);

      for (const ad of ads) {
        if (sentToday.has(ad.id)) continue;

        const daysLeft = Math.ceil(
          (ad.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        await queueAdWillExpireNotification(
          ad.userId, ad.id, ad.title,
          ad.expiresAt ? formatISTDate(ad.expiresAt) : 'N/A',
          daysLeft
        ).catch(err =>
          console.error(`[DEBUG] Failed to queue reminder for ad ${ad.id}:`, err)
        );

        sentToday.add(ad.id);
      }
    } else {
      // ── Normal: tiered windows with expiry-scoped dedup ──
      await queuePreExpiryRemindersForWindows({ daysBeforeExpiry, adId });
    }
    console.log(`Ad expiration reminder job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`Ad expiration reminder job ${job.id} failed:`, error);
    throw error;
  }
};

/**
 * Job handler for cleaning up expired ads
 * Marks ads as EXPIRED when they pass their expiration date
 */
export const adExpirationCleanupHandler: JobHandler<{ adId?: string }> = async (job: Job<{ adId?: string }>): Promise<void> => {
  console.log(`Processing ad expiration cleanup job ${job.id}`);
  
  try {
    const { adId } = job.data || {};

    // Date-only cutoff: an ad is "expired" only after its full expiry date
    // has passed.  expiresAt = June 11 → active all day June 11 → marked
    // EXPIRED on June 12 at the first hourly run.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    // Find ads whose expiry date is strictly before today
    const expiredAds = await prisma.ad.findMany({
      where: {
        expiresAt: {
          lt: startOfToday
        },
        status: {
          in: ['REVIEW', 'APPROVED']
        },
        ...(adId ? { id: adId } : {})
      },
      include: {
        user: true
      }
    });
    
    console.log(`Found ${expiredAds.length} expired ads to clean up`);
    
    if (expiredAds.length === 0) {
      console.log(`No expired ads found for cleanup job ${job.id}`);
      return;
    }
    
    // Update ads to EXPIRED status
    const adIds = expiredAds.map(ad => ad.id);
    
    const updateResult = await prisma.ad.updateMany({
      where: {
        id: {
          in: adIds
        }
      },
      data: {
        status: 'EXPIRED'
      }
    });
    
    console.log(`Updated ${updateResult.count} ads to EXPIRED status`);
    
    // Deactivate associated subscriptions
    const subscriptionUpdateResult = await prisma.subscription.updateMany({
      where: {
        adId: {
          in: adIds
        },
        isActive: true
      },
      data: {
        isActive: false
      }
    });
    
    console.log(`Deactivated ${subscriptionUpdateResult.count} subscriptions`);
    
    // Queue "expired" notification for all newly-expired ads — this is day 0
    // (the day the ad actually expired). Weekly post-expiry reminders (day 7,
    // 14, 21…) are handled by adAfterExpiredReminderHandler on D-day.
    for (const ad of expiredAds) {
      const expiryDateStr = ad.expiresAt ? formatISTDate(ad.expiresAt) : undefined;
      await queueAdStatusNotification(
        ad.userId,
        ad.id,
        ad.title,
        'EXPIRED',
        undefined,
        ad.slug || undefined,
        expiryDateStr,
        undefined,
        'expiry'
      ).catch(err => console.error(`Failed to queue expiration notification for ad ${ad.id}:`, err));
    }

    console.log(`Ad expiration cleanup job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`Ad expiration cleanup job ${job.id} failed:`, error);
    throw error;
  }
};


/**
 * Utility function to find ads expiring within a specific number of days
 */
export const findExpiringAds = async (daysFromNow: number) => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysFromNow);
  
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  return await prisma.ad.findMany({
    where: {
      expiresAt: {
        gte: startOfDay,
        lte: endOfDay
      },
      status: {
        in: ['REVIEW', 'APPROVED']
      }
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true
        }
      }
    }
  });
};

/**
 * Utility function to find expired ads that need cleanup
 */
export const findExpiredAds = async () => {
  const now = new Date();
  
  return await prisma.ad.findMany({
    where: {
      expiresAt: {
        lt: now
      },
      status: {
        in: ['REVIEW', 'APPROVED']
      }
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true
        }
      }
    }
  });
};

/**
 * Job handler for auto-applying ad revisions after grace period
 * Runs every hour to check for revisions past their autoApplyAt time
 */
export const autoApplyRevisionsHandler: JobHandler = async (job: Job): Promise<void> => {
  console.log(`Processing auto-apply revisions job ${job.id}`);
  
  try {
    const now = new Date();
    
    // Find revisions that should auto-apply
    const pendingRevisions = await prisma.adRevision.findMany({
      where: {
        status: 'REVIEW',
        autoApplyAt: { lte: now }
      },
      include: {
        ad: {
          select: {
            id: true,
            title: true,
            userId: true
          }
        }
      }
    });
    
    console.log(`Found ${pendingRevisions.length} revisions to auto-apply`);
    
    if (pendingRevisions.length === 0) {
      console.log(`No revisions to auto-apply for job ${job.id}`);
      return;
    }
    
    // Apply each revision
    for (const revision of pendingRevisions) {
      try {
        const changes = revision.changes as any;
        const { attributes, ...adUpdateData } = changes;

        // Build the update data
        const updateData: any = {
          ...adUpdateData,
          hasRevision: false,
          updatedAt: new Date()
        };

        // Handle attributes and ad update in a single transaction
        await prisma.$transaction(async (tx) => {
          // Handle attributes if present
          if (attributes && Array.isArray(attributes) && attributes.length > 0) {
            // Delete existing attributes
            await tx.adAttribute.deleteMany({
              where: { adId: revision.adId }
            });

            // Create new attributes
            await tx.adAttribute.createMany({
              data: attributes.map((attr: { attributeId: string; value: string }) => ({
                adId: revision.adId,
                attributeId: attr.attributeId,
                value: attr.value
              }))
            });
          }

          // Update ad (excluding attributes since we handled them separately)
          await tx.ad.update({
            where: { id: revision.adId },
            data: updateData
          });

          // Mark revision as auto-applied
          await tx.adRevision.update({
            where: { id: revision.id },
            data: {
              status: 'AUTO_APPLIED',
              reviewedAt: now
            }
          });
        });
        
        // Notify user
        await prisma.notification.create({
          data: {
            userId: revision.ad.userId,
            title: 'Changes Applied',
            message: `Your changes to "${revision.ad.title}" have been automatically applied.`,
            type: 'AD_APPROVED',
            data: {
              adId: revision.adId,
              autoApplied: true
            }
          }
        });
        
        console.log(`Auto-applied revision ${revision.id} for ad ${revision.adId}`);
      } catch (error) {
        console.error(`Failed to auto-apply revision ${revision.id}:`, error);
        // Continue with other revisions
      }
    }
    
    console.log(`Auto-apply revisions job ${job.id} completed`);
  } catch (error) {
    console.error(`Auto-apply revisions job ${job.id} failed:`, error);
    throw error;
  }
};
