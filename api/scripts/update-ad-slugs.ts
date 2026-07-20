import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to generate slug from title
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

async function updateAdSlugs() {
  console.log('🔄 Updating slugs for existing ads...');

  try {
    // Get all ads that don't have a slug or have an empty slug
    const adsWithoutSlugs = await prisma.ad.findMany({
      where: {
        OR: [
          { slug: null },
          { slug: '' }
        ]
      },
      select: {
        id: true,
        title: true,
        slug: true
      }
    });

    console.log(`📋 Found ${adsWithoutSlugs.length} ads without slugs`);

    if (adsWithoutSlugs.length === 0) {
      console.log('✅ All ads already have slugs, nothing to update');
      return;
    }

    // Update each ad with a slug based on its title
    for (const ad of adsWithoutSlugs) {
      const newSlug = generateSlug(ad.title);

      // Make sure the slug is unique by appending a number if needed
      let uniqueSlug = newSlug;
      let counter = 1;
      let isUnique = false;

      while (!isUnique) {
        const existingAd = await prisma.ad.findFirst({
          where: {
            slug: uniqueSlug,
            NOT: { id: ad.id } // Exclude the current ad from the check
          },
          select: { id: true }
        });

        if (!existingAd) {
          isUnique = true; // This slug is unique
        } else {
          uniqueSlug = `${newSlug}-${counter}`;
          counter++;
        }
      }

      await prisma.ad.update({
        where: { id: ad.id },
        data: { slug: uniqueSlug }
      });

      console.log(`✅ Updated ad ${ad.id} with slug: ${uniqueSlug}`);
    }

    console.log('✅ All ads have been updated with slugs');
  } catch (error) {
    console.error('❌ Error updating ad slugs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateAdSlugs()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });