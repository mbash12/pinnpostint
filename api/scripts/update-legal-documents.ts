import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateLegalDocuments() {
  console.log('📝 Updating legal documents...');

  try {
    // Update or create Privacy Policy
    const privacyPolicy = await prisma.legalDocument.upsert({
      where: { slug: 'privacy-policy' },
      update: {
        content: '<h1>Privacy Policy for PinNPost</h1><p>Last updated: December 30, 2025</p><h2>Information We Collect</h2><p>We collect information you provide directly to us, such as when you create an account, post ads, or communicate with other users. This may include:</p><ul><li>Contact information such as name and email address</li><li>Profile information such as phone number and location</li><li>Content you post, including ads and messages</li><li>Usage data about how you interact with our services</li></ul><h2>How We Use Your Information</h2><p>We use the information we collect to:</p><ul><li>Provide, maintain, and improve our services</li><li>Process transactions and send related communications</li><li>Communicate with you about your account and our services</li><li>Detect, prevent, and address fraud or other illegal activities</li></ul><h2>Information Sharing and Disclosure</h2><p>We do not share your personal information with third parties except in the following circumstances:</p><ul><li>With your consent</li><li>To comply with legal obligations</li><li>To protect the rights, property, or safety of our users</li></ul><h2>Data Security</h2><p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p><h2>Your Rights</h2><p>You have the right to:</p><ul><li>Access your personal information</li><li>Correct inaccurate personal information</li><li>Delete your personal information</li><li>Object to processing of your personal information</li></ul><h2>Contact Us</h2><p>If you have questions about this privacy policy, please contact us at: support@pinnpost.com</p>',
      },
      create: {
        title: 'Privacy Policy',
        slug: 'privacy-policy',
        content: '<h1>Privacy Policy for PinNPost</h1><p>Last updated: December 30, 2025</p><h2>Information We Collect</h2><p>We collect information you provide directly to us, such as when you create an account, post ads, or communicate with other users. This may include:</p><ul><li>Contact information such as name and email address</li><li>Profile information such as phone number and location</li><li>Content you post, including ads and messages</li><li>Usage data about how you interact with our services</li></ul><h2>How We Use Your Information</h2><p>We use the information we collect to:</p><ul><li>Provide, maintain, and improve our services</li><li>Process transactions and send related communications</li><li>Communicate with you about your account and our services</li><li>Detect, prevent, and address fraud or other illegal activities</li></ul><h2>Information Sharing and Disclosure</h2><p>We do not share your personal information with third parties except in the following circumstances:</p><ul><li>With your consent</li><li>To comply with legal obligations</li><li>To protect the rights, property, or safety of our users</li></ul><h2>Data Security</h2><p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p><h2>Your Rights</h2><p>You have the right to:</p><ul><li>Access your personal information</li><li>Correct inaccurate personal information</li><li>Delete your personal information</li><li>Object to processing of your personal information</li></ul><h2>Contact Us</h2><p>If you have questions about this privacy policy, please contact us at: support@pinnpost.com</p>',
        isActive: true,
      },
    });

    // Update or create Terms of Service
    const termsOfService = await prisma.legalDocument.upsert({
      where: { slug: 'terms-of-service' },
      update: {
        content: '<h1>Terms of Service for PinNPost</h1><p>Last updated: December 30, 2025</p><h2>Acceptance of Terms</h2><p>By accessing and using PinNPost, you accept and agree to be bound by the terms and provisions of this agreement.</p><h2>Description of Service</h2><p>Pin N Post provides a platform for users to buy and sell goods and services within their local communities. The service is provided "as is" without any warranties.</p><h2>User Responsibilities</h2><p>When using our service, you agree to:</p><ul><li>Provide accurate and complete information</li><li>Maintain the security of your account</li><li>Use the service in compliance with applicable laws</li><li>Respect the rights of other users</li></ul><h2>Prohibited Activities</h2><p>You agree not to:</p><ul><li>Post illegal or inappropriate content</li><li>Engage in fraudulent activities</li><li>Harass or abuse other users</li><li>Use the service for commercial purposes without permission</li></ul><h2>Content Ownership</h2><p>Users retain ownership of content they post. However, by posting content, you grant Pin N Post a license to use, display, and distribute that content in connection with our service.</p><h2>Termination</h2><p>We may terminate or suspend your account immediately, without prior notice, for any reason whatsoever, including without limitation if you breach these Terms.</p><h2>Limitation of Liability</h2><p>In no event shall PinNPost, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages.</p><h2>Governing Law</h2><p>These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions.</p><h2>Contact Information</h2><p>If you have questions about these Terms, please contact us at: support@pinnpost.com</p>',
      },
      create: {
        title: 'Terms of Service',
        slug: 'terms-of-service',
        content: '<h1>Terms of Service for PinNPost</h1><p>Last updated: December 30, 2025</p><h2>Acceptance of Terms</h2><p>By accessing and using PinNPost, you accept and agree to be bound by the terms and provisions of this agreement.</p><h2>Description of Service</h2><p>Pin N Post provides a platform for users to buy and sell goods and services within their local communities. The service is provided "as is" without any warranties.</p><h2>User Responsibilities</h2><p>When using our service, you agree to:</p><ul><li>Provide accurate and complete information</li><li>Maintain the security of your account</li><li>Use the service in compliance with applicable laws</li><li>Respect the rights of other users</li></ul><h2>Prohibited Activities</h2><p>You agree not to:</p><ul><li>Post illegal or inappropriate content</li><li>Engage in fraudulent activities</li><li>Harass or abuse other users</li><li>Use the service for commercial purposes without permission</li></ul><h2>Content Ownership</h2><p>Users retain ownership of content they post. However, by posting content, you grant Pin N Post a license to use, display, and distribute that content in connection with our service.</p><h2>Termination</h2><p>We may terminate or suspend your account immediately, without prior notice, for any reason whatsoever, including without limitation if you breach these Terms.</p><h2>Limitation of Liability</h2><p>In no event shall PinNPost, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages.</p><h2>Governing Law</h2><p>These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions.</p><h2>Contact Information</h2><p>If you have questions about these Terms, please contact us at: support@pinnpost.com</p>',
        isActive: true,
      },
    });

    console.log('✅ Legal documents updated successfully');
    console.log(`- Privacy Policy: ${privacyPolicy.id}`);
    console.log(`- Terms of Service: ${termsOfService.id}`);
  } catch (error) {
    console.error('❌ Error updating legal documents:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateLegalDocuments()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });