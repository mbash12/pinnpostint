/**
 * Test script to send a notification to all admin users
 * Usage: npx ts-node scripts/test-admin-notification.ts
 */

import { PrismaClient } from '@prisma/client';
import { sendNotificationToAdmins } from '../src/utils/notifications';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔔 Testing Admin Notification System...\n');

    // Check how many admins exist
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        isActive: true
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        phone: true
      }
    });

    console.log(`Found ${admins.length} active admin(s):`);
    admins.forEach(admin => {
      console.log(`  - ${admin.firstName} (${admin.email || admin.phone})`);
    });
    console.log('');

    if (admins.length === 0) {
      console.log('❌ No active admins found. Please create an admin user first.');
      return;
    }

    // Send test notification
    console.log('📤 Sending test notification to admins...');
    const result = await sendNotificationToAdmins(
      '🧪 Test Notification',
      'This is a test notification to verify the admin notification system is working correctly.',
      'SYSTEM',
      { test: true, timestamp: new Date().toISOString() }
    );

    console.log('\n✅ Notification sent successfully!');
    console.log(`  - Push notifications: ${result.pushSuccess} sent`);
    console.log(`  - Email notifications: ${result.emailSuccess} sent`);
    console.log(`  - Total admins targeted: ${result.totalAdmins}`);

    // Show recent notifications
    console.log('\n📋 Recent notifications in database:');
    const recentNotifications = await prisma.notification.findMany({
      where: {
        user: {
          role: 'ADMIN'
        }
      },
      orderBy: {
        sentAt: 'desc'
      },
      take: 5,
      include: {
        user: {
          select: {
            firstName: true,
            email: true
          }
        }
      }
    });

    recentNotifications.forEach(notif => {
      console.log(`  - [${notif.type}] ${notif.title}`);
      console.log(`    To: ${notif.user.firstName} (${notif.user.email})`);
      console.log(`    At: ${new Date(notif.sentAt).toLocaleString()}`);
      console.log(`    Read: ${notif.isRead ? 'Yes' : 'No'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n✨ Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
