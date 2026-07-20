/**
 * Check recent ads and if admin notifications were created for them
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking recent ads and notifications...\n');

  // Get recent ads with REVIEW status
  const recentAds = await prisma.ad.findMany({
    where: {
      status: 'REVIEW'
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10,
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

  console.log(`Found ${recentAds.length} ads with REVIEW status:\n`);

  for (const ad of recentAds) {
    console.log(`📝 Ad: "${ad.title}"`);
    console.log(`   ID: ${ad.id}`);
    console.log(`   Created: ${new Date(ad.createdAt).toLocaleString()}`);
    console.log(`   By: ${ad.user.firstName} ${ad.user.lastName || ''} (${ad.user.phone})`);

    // Check if notification was created for this ad
    const notifications = await prisma.notification.findMany({
      where: {
        type: 'ADMIN_ALERT',
        title: 'New Ad Pending Review',
        sentAt: {
          gte: ad.createdAt,
          lte: new Date(ad.createdAt.getTime() + 60000) // Within 1 minute after ad creation
        }
      }
    });

    console.log(`   Notifications created: ${notifications.length}`);
    if (notifications.length > 0) {
      notifications.forEach(notif => {
        console.log(`     - To user ${notif.userId} at ${new Date(notif.sentAt).toLocaleString()}`);
      });
    } else {
      console.log(`     ❌ NO NOTIFICATION FOUND!`);
    }
    console.log('');
  }

  // Check all admin notifications in the last hour
  console.log('\n📋 All admin notifications in the last hour:\n');
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentNotifications = await prisma.notification.findMany({
    where: {
      type: 'ADMIN_ALERT',
      sentAt: {
        gte: oneHourAgo
      }
    },
    orderBy: {
      sentAt: 'desc'
    },
    include: {
      user: {
        select: {
          firstName: true,
          email: true,
          role: true
        }
      }
    }
  });

  if (recentNotifications.length === 0) {
    console.log('❌ No admin notifications found in the last hour!');
  } else {
    recentNotifications.forEach(notif => {
      console.log(`[${notif.type}] ${notif.title}`);
      console.log(`  To: ${notif.user.firstName} (${notif.user.email}) - Role: ${notif.user.role}`);
      console.log(`  Message: ${notif.message}`);
      console.log(`  At: ${new Date(notif.sentAt).toLocaleString()}`);
      console.log(`  Read: ${notif.isRead ? 'Yes' : 'No'}`);
      console.log('');
    });
  }

  await prisma.$disconnect();
}

main()
  .then(() => {
    console.log('\n✨ Check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
