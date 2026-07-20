import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const generateSlug = (title: string, id: string): string => {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return `${baseSlug}-${id.slice(0, 8)}`;
};

async function updateSlugs() {
  const adsWithoutSlug = await prisma.ad.findMany({
    where: { slug: null },
    select: { id: true, title: true }
  });

  console.log(`Found ${adsWithoutSlug.length} ads without slugs`);

  for (const ad of adsWithoutSlug) {
    const slug = generateSlug(ad.title, ad.id);
    await prisma.ad.update({
      where: { id: ad.id },
      data: { slug }
    });
    console.log(`Updated ad ${ad.id} with slug: ${slug}`);
  }

  console.log('✅ All ads updated with slugs');
}

updateSlugs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
