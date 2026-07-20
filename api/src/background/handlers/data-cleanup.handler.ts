import { Job, JobHandler } from '../interfaces/job.interface';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CleanupJobData {
  type: 'daily' | 'weekly';
  manualTrigger?: boolean;
}

interface CleanupStats {
  expiredOtps: number;
  expiredNotifications: number;
  oldTransactions?: number;
  orphanedFiles?: number;
  totalCleaned: number;
}

/**
 * Data cleanup job handler for maintaining database hygiene
 * Handles both daily and weekly cleanup tasks
 */
export const dataCleanupHandler: JobHandler = async (job: Job): Promise<void> => {
  const { type, manualTrigger = false } = job.data as CleanupJobData;
  const startTime = Date.now();
  
  console.log(`Starting ${type} data cleanup${manualTrigger ? ' (manual trigger)' : ''}...`);

  try {
    let stats: CleanupStats;

    if (type === 'daily') {
      stats = await performDailyCleanup();
    } else if (type === 'weekly') {
      stats = await performWeeklyCleanup();
    } else {
      throw new Error(`Unknown cleanup type: ${type as string}`);
    }

    const duration = Date.now() - startTime;
    
    console.log(`${type} cleanup completed in ${duration}ms:`, stats);
    
    // Log cleanup statistics for monitoring
    console.log(`Cleanup job ${job.id} completed:`, {
      type,
      stats,
      duration,
      completedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error(`${type} cleanup failed:`, error);
    throw error;
  }
};

/**
 * Perform daily cleanup tasks
 */
async function performDailyCleanup(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    expiredOtps: 0,
    expiredNotifications: 0,
    totalCleaned: 0,
  };

  // Clean expired OTPs (older than 24 hours)
  const expiredOtpsResult = await prisma.otp.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { isUsed: true, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      ]
    }
  });
  stats.expiredOtps = expiredOtpsResult.count;

  // Clean old read notifications (older than 30 days)
  const oldNotificationsResult = await prisma.notification.deleteMany({
    where: {
      isRead: true,
      sentAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }
  });
  stats.expiredNotifications = oldNotificationsResult.count;

  stats.totalCleaned = stats.expiredOtps + stats.expiredNotifications;

  return stats;
}

/**
 * Perform weekly cleanup tasks
 */
async function performWeeklyCleanup(): Promise<CleanupStats> {
  // Start with daily cleanup
  const stats = await performDailyCleanup();

  // Clean old completed/failed transactions (older than 90 days)
  const oldTransactionsResult = await prisma.transaction.deleteMany({
    where: {
      status: { in: ['COMPLETED', 'FAILED', 'REFUNDED'] },
      createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    }
  });
  stats.oldTransactions = oldTransactionsResult.count;

  // Clean orphaned user locations (users that no longer exist)
  // This is a safety cleanup in case of data inconsistencies
  // Note: Prisma foreign key constraints should prevent this, but we check anyway
  const allUserLocations = await prisma.userLocation.findMany({
    include: { user: true }
  });
  const orphanedUserLocationIds = allUserLocations
    .filter(ul => !ul.user)
    .map(ul => ul.id);
  
  const orphanedUserLocations = orphanedUserLocationIds.length > 0 
    ? await prisma.userLocation.deleteMany({
        where: { id: { in: orphanedUserLocationIds } }
      })
    : { count: 0 };

  // Clean orphaned ad attributes (ads that no longer exist)
  const allAdAttributes = await prisma.adAttribute.findMany({
    include: { ad: true }
  });
  const orphanedAdAttributeIds = allAdAttributes
    .filter(aa => !aa.ad)
    .map(aa => aa.id);
    
  const orphanedAdAttributes = orphanedAdAttributeIds.length > 0
    ? await prisma.adAttribute.deleteMany({
        where: { id: { in: orphanedAdAttributeIds } }
      })
    : { count: 0 };

  // Clean orphaned wishlists (ads or users that no longer exist)
  const allWishlists = await prisma.wishlist.findMany({
    include: { ad: true, user: true }
  });
  const orphanedWishlistIds = allWishlists
    .filter(w => !w.ad || !w.user)
    .map(w => w.id);
    
  const orphanedWishlists = orphanedWishlistIds.length > 0
    ? await prisma.wishlist.deleteMany({
        where: { id: { in: orphanedWishlistIds } }
      })
    : { count: 0 };

  const orphanedCount = orphanedUserLocations.count + orphanedAdAttributes.count + orphanedWishlists.count;
  stats.orphanedFiles = orphanedCount;

  stats.totalCleaned += (stats.oldTransactions || 0) + orphanedCount;

  return stats;
}

/**
 * Get cleanup statistics for monitoring
 */
export const getCleanupStats = async (): Promise<{
  pendingOtps: number;
  unreadNotifications: number;
  pendingTransactions: number;
  reviewAds: number;
}> => {
  const [pendingOtps, unreadNotifications, pendingTransactions, reviewAds] = await Promise.all([
    prisma.otp.count({
      where: {
        isUsed: false,
        expiresAt: { gt: new Date() }
      }
    }),
    prisma.notification.count({
      where: { isRead: false }
    }),
    prisma.transaction.count({
      where: { status: 'PENDING' }
    }),
    prisma.ad.count({
      where: {
        status: 'REVIEW'
      }
    })
  ]);

  return {
    pendingOtps,
    unreadNotifications,
    pendingTransactions,
    reviewAds,
  };
};