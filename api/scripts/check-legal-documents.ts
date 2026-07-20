import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLegalDocuments() {
  try {
    const privacyPolicy = await prisma.legalDocument.findUnique({
      where: { slug: 'privacy-policy' },
    });
    
    const termsOfService = await prisma.legalDocument.findUnique({
      where: { slug: 'terms-of-service' },
    });

    console.log('Privacy Policy content:', privacyPolicy?.content?.substring(0, 200) + '...');
    console.log('Terms of Service content:', termsOfService?.content?.substring(0, 200) + '...');
  } catch (error) {
    console.error('Error checking legal documents:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLegalDocuments();