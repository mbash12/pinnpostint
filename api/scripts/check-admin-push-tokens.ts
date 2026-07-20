/**
 * Check admin push tokens
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking admin push tokens...\n');

  const admins = await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      isActive: true
    },
    include: {
      pushTokens: true,
      profile: true
    }
  });

  console.log(`Found ${admins.length} active admin(s):\n`);

  for (const admin of admins) {
    console.log(`👤 Admin: ${admin.firstName} (${admin.email || admin.phone})`);
    console.log(`   ID: ${admin.id}`);
    console.log(`   Push notifications enabled in profile: ${admin.profile?.pushNotifications ?? 'not set'}`);
    console.log(`   Email notifications enabled in profile: ${admin.profile?.emailNotifications ?? 'not set'}`);
    console.log(`   FCM tokens registered: ${admin.pushTokens.length}`);

    if (admin.pushTokens.length > 0) {
      admin.pushTokens.forEach(token => {
        console.log(`     - Platform: ${token.platform}`);
        console.log(`       Device: ${token.device || 'Unknown'}`);
        console.log(`       Token: ${token.token.substring(0, 30)}...`);
        console.log(`       Active: ${token.isActive}`);
        console.log(`       Last used: ${new Date(token.lastUsed).toLocaleString()}`);
      });
    } else {
      console.log(`     ❌ NO PUSH TOKENS REGISTERED!`);
      console.log(`     ⚠️  Push notifications will NOT work for this admin!`);
      console.log(`     💡 To enable push notifications, the admin needs to:`);
      console.log(`        1. Log into the admin panel`);
      console.log(`        2. Grant browser notification permission`);
      console.log(`        3. The FCM token will be auto-registered`);
    }
    console.log('');
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
