require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateAdsExpiration() {
  try {
    console.log('Updating ads expiration dates...');

    // Calculate 7 days from now
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Update all ads to have expiresAt = 7 days from now
    const result = await prisma.ad.updateMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { lt: new Date() } }
        ]
      },
      data: {
        expiresAt: sevenDaysFromNow
      }
    });

    console.log(`Updated ${result.count} ads to expire on ${sevenDaysFromNow.toISOString()}`);

    // Also update all ads to APPROVED status if they're REJECTED or EXPIRED (but not REVIEW)
    const statusResult = await prisma.ad.updateMany({
      where: {
        status: {
          in: ['REJECTED', 'EXPIRED']
        }
      },
      data: {
        status: 'APPROVED'
      }
    });

    console.log(`Updated ${statusResult.count} ads to APPROVED status`);

    console.log('Update completed successfully!');

  } catch (error) {
    console.error('Error updating ads:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdsExpiration();