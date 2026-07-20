const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    console.log('🚀 Creating super admin user...');

    const email = 'admin@pinnpost.com';
    const password = 'admin123';
    const phone = '+6281234567890'; // Default phone number for admin

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      console.log('⚠️  Super admin already exists with this email');
      
      // Update password if admin exists
      const hashedPassword = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { email },
        data: { 
          password: hashedPassword,
          role: 'ADMIN',
          isActive: true,
          isVerified: true
        }
      });
      
      console.log('✅ Super admin password updated successfully');
      return;
    }

    // Check if phone number is already taken
    const existingPhone = await prisma.user.findUnique({
      where: { phone }
    });

    if (existingPhone) {
      console.log('⚠️  Phone number already exists, using alternative phone number');
      // Generate a unique phone number
      const timestamp = Date.now().toString().slice(-8);
      const uniquePhone = `+628${timestamp}`;
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create super admin user
      const superAdmin = await prisma.user.create({
        data: {
          email,
          phone: uniquePhone,
          password: hashedPassword,
          firstName: 'Super',
          lastName: 'Admin',
          role: 'ADMIN',
          isActive: true,
          isVerified: true
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isVerified: true,
          createdAt: true
        }
      });

      console.log('✅ Super admin created successfully:');
      console.log(JSON.stringify(superAdmin, null, 2));
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create super admin user
    const superAdmin = await prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'ADMIN',
        isActive: true,
        isVerified: true
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true
      }
    });

    console.log('✅ Super admin created successfully:');
    console.log(JSON.stringify(superAdmin, null, 2));

    console.log('\n📋 Login credentials:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('\n🔗 Use these credentials to login at: POST /api/v1/auth/admin/login');

  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createSuperAdmin();
