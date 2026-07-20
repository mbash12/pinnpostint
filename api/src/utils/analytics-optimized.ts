import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import { getOrSetCache, invalidateAnalyticsCache, CacheNamespace, generateCacheKey } from './cache';

/**
 * Optimized Analytics Queries using Database Aggregations
 * These queries use SQL GROUP BY and aggregate functions instead of loading raw data
 */

/**
 * Get date range based on period
 */
function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(endDate.getDate() - 30);
  }

  return { startDate, endDate };
}

/**
 * Optimized Dashboard Stats
 * Uses caching and efficient queries
 */
export async function getOptimizedDashboardStats(period: string) {
  const cacheKey = generateCacheKey(CacheNamespace.DASHBOARD, `stats:${period}`);
  
  return await getOrSetCache(
    cacheKey,
    async () => {
      const { startDate, endDate } = getDateRange(period);

      // Use raw SQL for better performance with aggregations
      const [dashboardData] = await prisma.$queryRaw`
        SELECT
          (SELECT COUNT(*) FROM "users") as "totalUsers",
          (SELECT COUNT(*) FROM "users" WHERE "createdAt" BETWEEN ${startDate} AND ${endDate}) as "newUsers",
          (SELECT COUNT(*) FROM "ads") as "totalAds",
          (SELECT COUNT(*) FROM "ads" WHERE "createdAt" BETWEEN ${startDate} AND ${endDate}) as "newAds",
          (SELECT COUNT(*) FROM "ads" WHERE status = 'REVIEW') as "pendingAds",
          (SELECT COUNT(*) FROM "ads" WHERE status = 'APPROVED') as "approvedAds",
          (SELECT COUNT(*) FROM "bookings") as "totalBookings",
          (SELECT COUNT(*) FROM "bookings" WHERE "createdAt" BETWEEN ${startDate} AND ${endDate}) as "newBookings",
          (SELECT COUNT(*) FROM "subscriptions" WHERE "isActive" = true AND "endDate" >= NOW()) as "activeSubscriptions",
          (SELECT COALESCE(SUM(amount), 0)::numeric FROM "transactions" WHERE status = 'COMPLETED') as "totalRevenue",
          (SELECT COALESCE(SUM(amount), 0)::numeric FROM "transactions" 
           WHERE status = 'COMPLETED' AND "createdAt" BETWEEN ${startDate} AND ${endDate}) as "monthlyRevenue";
      ` as any;

      return {
        totalUsers: Number(dashboardData.totalUsers),
        totalAds: Number(dashboardData.totalAds),
        approvedAds: Number(dashboardData.approvedAds),
        pendingAds: Number(dashboardData.pendingAds),
        totalBookings: Number(dashboardData.totalBookings),
        activeSubscriptions: Number(dashboardData.activeSubscriptions),
        totalRevenue: Number(dashboardData.totalRevenue),
        monthlyRevenue: Number(dashboardData.monthlyRevenue),
        recentUsers: Number(dashboardData.newUsers),
        recentAds: Number(dashboardData.newAds),
        recentActivity: {
          newUsers: Number(dashboardData.newUsers),
          newAds: Number(dashboardData.newAds),
          newBookings: Number(dashboardData.newBookings),
          recentRevenue: Number(dashboardData.monthlyRevenue),
          approvedAds: Number(dashboardData.approvedAds),
          period
        }
      };
    },
    300 // 5 minutes TTL
  );
}

/**
 * Optimized User Analytics
 * Uses database GROUP BY instead of loading all records
 */
export async function getOptimizedUserAnalytics(period: string) {
  const cacheKey = generateCacheKey(CacheNamespace.ANALYTICS, `users:${period}`);
  
  return await getOrSetCache(
    cacheKey,
    async () => {
      const { startDate, endDate } = getDateRange(period);

      // Get basic counts
      const [totalUsers, verifiedUsers, activeUsers, usersByRole] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isVerified: true } }),
        prisma.user.count({
          where: {
            OR: [
              { ads: { some: { createdAt: { gte: startDate, lte: endDate } } } },
              { bookings: { some: { createdAt: { gte: startDate, lte: endDate } } } }
            ]
          }
        }),
        prisma.user.groupBy({
          by: ['role'],
          _count: { id: true }
        })
      ]);

      // OPTIMIZED: Use raw SQL for registration trend (GROUP BY date)
      const registrationTrendResult = await prisma.$queryRaw`
        SELECT 
          DATE("createdAt") as date, 
          COUNT(*)::integer as count
        FROM "users"
        WHERE "createdAt" BETWEEN ${startDate} AND ${endDate}
        GROUP BY DATE("createdAt")
        ORDER BY date;
      ` as any[];

      const registrationTrend = registrationTrendResult.map(row => ({
        date: row.date,
        count: Number(row.count)
      }));

      const userGrowth = registrationTrend.reduce((sum, item) => sum + item.count, 0);

      return {
        totalUsers,
        verifiedUsers,
        unverifiedUsers: totalUsers - verifiedUsers,
        activeUsers,
        usersByRole: usersByRole.reduce((acc, item) => {
          acc[item.role] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        userGrowth,
        registrationTrend,
        period
      };
    },
    600 // 10 minutes TTL
  );
}

/**
 * Optimized Ad Analytics
 * Uses database aggregations
 */
export async function getOptimizedAdAnalytics(period: string) {
  const cacheKey = generateCacheKey(CacheNamespace.ANALYTICS, `ads:${period}`);
  
  return await getOrSetCache(
    cacheKey,
    async () => {
      const { startDate, endDate } = getDateRange(period);

      // Get basic counts
      const [totalAds, adsByStatus, featuredAds, expiredAds] = await Promise.all([
        prisma.ad.count(),
        prisma.ad.groupBy({
          by: ['status'],
          _count: { id: true }
        }),
        prisma.ad.count({ where: { isFeatured: true } }),
        prisma.ad.count({ where: { status: 'EXPIRED' } })
      ]);

      // OPTIMIZED: Use raw SQL for ad creation trend
      const creationTrendResult = await prisma.$queryRaw`
        SELECT 
          DATE("createdAt") as date, 
          COUNT(*)::integer as count
        FROM "ads"
        WHERE "createdAt" BETWEEN ${startDate} AND ${endDate}
        GROUP BY DATE("createdAt")
        ORDER BY date;
      ` as any[];

      const creationTrend = creationTrendResult.map(row => ({
        date: row.date,
        count: Number(row.count)
      }));

      const adGrowth = creationTrend.reduce((sum, item) => sum + item.count, 0);

      // Get top categories with counts
      const adsByCategory = await prisma.$queryRaw`
        SELECT 
          "categoryId", 
          COUNT(*)::integer as count
        FROM "ads"
        GROUP BY "categoryId"
        ORDER BY count DESC
        LIMIT 10;
      ` as any[];

      // Get category names
      const categoryIds = adsByCategory.map(item => item.categoryId);
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true }
      });

      const categoriesWithCounts = adsByCategory.map(item => ({
        categoryId: item.categoryId,
        categoryName: categories.find(cat => cat.id === item.categoryId)?.name || 'Unknown',
        count: Number(item.count)
      }));

      return {
        totalAds,
        featuredAds,
        expiredAds,
        adsByStatus: adsByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        adsByCategory: categoriesWithCounts.reduce((acc, item) => {
          acc[item.categoryName] = item.count;
          return acc;
        }, {} as Record<string, number>),
        topCategories: categoriesWithCounts,
        adGrowth,
        averagePrice: 0, // TODO: Calculate from actual ad prices
        creationTrend,
        period
      };
    },
    600 // 10 minutes TTL
  );
}

/**
 * Optimized Revenue Analytics
 * Uses database aggregations
 */
export async function getOptimizedRevenueAnalytics(period: string) {
  const cacheKey = generateCacheKey(CacheNamespace.ANALYTICS, `revenue:${period}`);
  
  return await getOrSetCache(
    cacheKey,
    async () => {
      const { startDate, endDate } = getDateRange(period);

      // Get revenue data
      const [
        totalRevenue,
        periodRevenue,
        revenueByProvider,
        subscriptionRevenue,
        revenueTrendResult
      ] = await Promise.all([
        // Total revenue
        prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { status: 'COMPLETED' }
        }),

        // Period revenue
        prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            status: 'COMPLETED',
            createdAt: { gte: startDate, lte: endDate }
          }
        }),

        // Revenue by provider
        prisma.transaction.groupBy({
          by: ['paymentProvider'],
          _sum: { amount: true },
          where: {
            status: 'COMPLETED',
            createdAt: { gte: startDate, lte: endDate }
          }
        }),

        // Subscription revenue
        prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            status: 'COMPLETED',
            subscription: { isNot: null },
            createdAt: { gte: startDate, lte: endDate }
          }
        }),

        // OPTIMIZED: Revenue trend with daily aggregation
        prisma.$queryRaw`
          SELECT 
            DATE("createdAt") as date, 
            COALESCE(SUM(amount), 0)::numeric as revenue
          FROM "transactions"
          WHERE status = 'COMPLETED' AND "createdAt" BETWEEN ${startDate} AND ${endDate}
          GROUP BY DATE("createdAt")
          ORDER BY date;
        ` as Promise<any[]>
      ]);

      const revenueTrend = revenueTrendResult.map(row => ({
        date: row.date,
        revenue: Number(row.revenue)
      }));

      // Calculate growth
      const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const previousPeriodStart = new Date(startDate);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays);

      const previousPeriodRevenue = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          status: 'COMPLETED',
          createdAt: { gte: previousPeriodStart, lt: startDate }
        }
      });

      const currentRevenue = periodRevenue._sum?.amount?.toNumber() || 0;
      const previousRevenue = previousPeriodRevenue._sum?.amount?.toNumber() || 0;
      const revenueGrowth = previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : currentRevenue > 0 ? 100 : 0;

      const currentPeriodRevenue = periodRevenue._sum?.amount?.toNumber() || 0;
      const currentSubscriptionRevenue = subscriptionRevenue._sum?.amount?.toNumber() || 0;

      return {
        totalRevenue: totalRevenue._sum?.amount?.toNumber() || 0,
        monthlyRevenue: currentPeriodRevenue,
        revenueGrowth: Math.round(revenueGrowth * 100) / 100,
        subscriptionRevenue: currentSubscriptionRevenue,
        bookingRevenue: 0, // TODO: Add booking relation to Transaction model
        revenueByProvider: revenueByProvider.reduce((acc, item) => {
          acc[item.paymentProvider] = item._sum?.amount?.toNumber() || 0;
          return acc;
        }, {} as Record<string, number>),
        revenueBySource: {
          subscriptions: currentSubscriptionRevenue,
          bookings: 0,
          other: Math.max(0, currentPeriodRevenue - currentSubscriptionRevenue)
        },
        revenueTrend,
        period
      };
    },
    600 // 10 minutes TTL
  );
}

/**
 * Optimized Location Analytics
 */
export async function getOptimizedLocationAnalytics(period: string, country?: string, state?: string, city?: string) {
  const cacheKey = generateCacheKey(CacheNamespace.ANALYTICS, `locations:${period}:${country}:${state}:${city}`);
  
  return await getOrSetCache(
    cacheKey,
    async () => {
      const { startDate, endDate } = getDateRange(period);

      // 1. Top locations by user activity (Raw SQL for efficiency)
      const topLocations = await prisma.$queryRaw`
        SELECT 
          l.id, l.name, l.country,
          c.name as city_name,
          s.name as state_name,
          COUNT(ul."userId")::integer as "userCount"
        FROM "locations" l
        LEFT JOIN "cities" c ON l."cityId" = c.id
        LEFT JOIN "states" s ON l."stateId" = s.id
        LEFT JOIN "user_locations" ul ON l.id = ul."locationId"
        GROUP BY l.id, l.name, l.country, c.name, s.name
        ORDER BY "userCount" DESC
        LIMIT 10;
      ` as any[];

      // 2. Location growth trend (GROUP BY date)
      const locationGrowthResult = await prisma.$queryRaw`
        SELECT 
          DATE("createdAt") as date, 
          COUNT(*)::integer as count
        FROM "locations"
        WHERE "createdAt" BETWEEN ${startDate} AND ${endDate}
        GROUP BY DATE("createdAt")
        ORDER BY date;
      ` as any[];

      // 3. Ads by city (using the Ad model's denormalized locationCity field)
      const adsByLocation = await prisma.ad.groupBy({
        by: ['locationCity'],
        _count: { id: true },
        where: {
          createdAt: { gte: startDate, lte: endDate },
          locationCity: { not: null }
        },
        orderBy: { _count: { id: 'desc' } },
        take: 20
      });

      return {
        topLocations: topLocations.map(l => ({
          id: l.id,
          name: l.name,
          city: { name: l.city_name },
          state: { name: l.state_name },
          country: l.country,
          userCount: Number(l.userCount)
        })),
        locationGrowth: locationGrowthResult.map(row => ({
          date: row.date,
          count: Number(row.count)
        })),
        adsByLocation: adsByLocation.map(item => ({
          locationCity: item.locationCity,
          count: item._count.id
        })),
        period
      };
    },
    600 // 10 minutes TTL
  );
}

/**
 * Optimized Wishlist Analytics
 */
export async function getOptimizedWishlistAnalytics(period: string) {
  const cacheKey = generateCacheKey(CacheNamespace.ANALYTICS, `wishlists:${period}`);
  
  return await getOrSetCache(
    cacheKey,
    async () => {
      const { startDate, endDate } = getDateRange(period);

      const [totalWishlists, newWishlists, activeWishlistUsers] = await Promise.all([
        prisma.wishlist.count(),
        prisma.wishlist.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
        prisma.user.count({
          where: { wishlists: { some: { createdAt: { gte: startDate, lte: endDate } } } }
        })
      ]);

      // Top wishlisted ads
      const mostWishlistedAds = await prisma.wishlist.groupBy({
        by: ['adId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      });

      // Get ad details for the top ads
      const adIds = mostWishlistedAds.map(item => item.adId);
      const ads = await prisma.ad.findMany({
        where: { id: { in: adIds } },
        select: {
          id: true,
          title: true,
          price: true,
          category: { select: { name: true } }
        }
      });

      // Wishlists by category (using raw SQL JOIN for efficiency)
      const categoryStats = await prisma.$queryRaw`
        SELECT 
          c.name as category_name, 
          COUNT(w.id)::integer as wishlist_count
        FROM "wishlists" w
        JOIN "ads" a ON w."adId" = a.id
        JOIN "categories" c ON a."categoryId" = c.id
        WHERE w."createdAt" BETWEEN ${startDate} AND ${endDate}
        GROUP BY c.name
        ORDER BY wishlist_count DESC
        LIMIT 10;
      ` as any[];

      // Wishlist growth trend
      const growthTrend = await prisma.$queryRaw`
        SELECT 
          DATE("createdAt") as date, 
          COUNT(*)::integer as count
        FROM "wishlists"
        WHERE "createdAt" BETWEEN ${startDate} AND ${endDate}
        GROUP BY DATE("createdAt")
        ORDER BY date;
      ` as any[];

      return {
        totalWishlists,
        newWishlists,
        activeWishlistUsers,
        mostWishlistedAds: mostWishlistedAds.map(item => ({
          adId: item.adId,
          wishlistCount: item._count.id,
          ad: ads.find(ad => ad.id === item.adId)
        })),
        wishlistsByCategory: categoryStats.map(row => ({
          category_name: row.category_name,
          wishlist_count: Number(row.wishlist_count)
        })),
        wishlistGrowth: growthTrend.map(row => ({
          date: row.date,
          count: Number(row.count)
        })),
        period
      };
    },
    600 // 10 minutes TTL
  );
}

/**
 * Invalidate all analytics caches
 * Call this when data changes significantly
 */
export { invalidateAnalyticsCache };

export default {
  getOptimizedDashboardStats,
  getOptimizedUserAnalytics,
  getOptimizedAdAnalytics,
  getOptimizedRevenueAnalytics,
  invalidateAnalyticsCache
};
