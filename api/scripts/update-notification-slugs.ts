import { PrismaClient } from '@prisma/client';

// Explicit database URL
const DATABASE_URL = 'postgresql://demo:demo@localhost:5432/pinpost';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

async function updateNotificationSlugs() {
  try {
    console.log('Updating notification slugs...');
    console.log(`Using database: ${DATABASE_URL}`);
    
    // Get all AD_APPROVED and AD_REJECTED notifications
    const notifications = await prisma.notification.findMany({
      where: {
        type: {
          in: ['AD_APPROVED', 'AD_REJECTED']
        }
      }
    });
    
    console.log(`Found ${notifications.length} notifications to check`);
    
    for (const notification of notifications) {
      const data = notification.data as any;
      const adId = data?.adId;
      const adSlug = data?.adSlug;
      
      if (!adId) {
        console.log(`Skipping notification ${notification.id} - no adId`);
        continue;
      }
      
      // Skip if already has adSlug
      if (adSlug) {
        console.log(`Skipping notification ${notification.id} - already has adSlug`);
        continue;
      }
      
      // Get the ad with its slug
      const ad = await prisma.ad.findUnique({
        where: { id: adId },
        select: { slug: true }
      });
      
      if (!ad || !ad.slug) {
        console.log(`Skipping notification ${notification.id} - ad not found or no slug`);
        continue;
      }
      
      // Update the notification data to include adSlug
      const updatedData = {
        ...data,
        adSlug: ad.slug
      };
      
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          data: updatedData
        }
      });
      
      console.log(`Updated notification ${notification.id} with adSlug: ${ad.slug}`);
    }
    
    console.log('Successfully updated notification slugs');
  } catch (error) {
    console.error('Error updating notification slugs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateNotificationSlugs()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });