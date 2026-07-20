import { PrismaClient, UserRole, AdStatus, TransactionStatus, PaymentProvider, NotificationType, BookingStatus } from '@prisma/client';
import { hash } from 'bcrypt';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

// Import the updated location seeding function
import { seedLocations } from './seed-locations';
import { seedAttributes } from './seed-attributes';

// Helper functions
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

// Read categories data from JSON
const readCategoriesData = () => {
  try {
    // Try multiple possible paths for both dev and compiled environments
    const possiblePaths = [
      path.join(__dirname, '../src/data/categories_en.json'), // Development path
      path.join(__dirname, '../data/categories_en.json'),     // Compiled path
      path.join(__dirname, './data/categories_en.json'),      // Alternative compiled path
      path.join(process.cwd(), 'src/data/categories_en.json'), // Absolute path fallback
    ];

    let categoriesPath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        categoriesPath = p;
        break;
      }
    }

    if (!categoriesPath) {
      throw new Error('categories_en.json not found in any expected location');
    }

    const categoriesData = fs.readFileSync(categoriesPath, 'utf8');
    return JSON.parse(categoriesData);
  } catch (error) {
    console.error('Error reading categories_en.json:', error);
    return [];
  }
};

const generatePhone = (): string => {
  const timestamp = Date.now().toString().slice(-8);
  return `+628${timestamp}`;
};

const generateUuid = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Get API base URL for constructing full image URLs
const getApiBaseUrl = (): string => {
  return process.env.API_URL || 'https://api.pinnpost.com';
};

// Seed Indian locations using the proper data files
async function seedIndianLocations() {
  try {
    // Call the proper seedLocations function that uses the data files
    const locationStats = await seedLocations();

    // Count the created records
    const statesCount = await prisma.state.count();
    const citiesCount = await prisma.city.count();
    const postalCodesCount = await prisma.postalCode.count();
    const locationsCount = await prisma.location.count();

    console.log(`   ✓ States: ${statesCount}, Cities: ${citiesCount}, Postal Codes: ${postalCodesCount}, Locations: ${locationsCount}`);
    return {
      states: statesCount,
      cities: citiesCount,
      postalCodes: postalCodesCount,
      locations: locationsCount
    };
  } catch (error) {
    console.log('⚠️  Error seeding location data, skipping...');
    console.error(error);
    return { states: 0, cities: 0, postalCodes: 0, locations: 0 };
  }
}

// Main seeder function
async function main() {
  console.log('🚀 Starting database seeding...');

  try {
    // Clean existing data (in reverse order of dependencies)
    console.log('🧹 Cleaning existing data...');
    await prisma.adAttribute.deleteMany();
    await prisma.wishlist.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.ad.deleteMany();
    await prisma.attribute.deleteMany();
    await prisma.userLocation.deleteMany();
    await prisma.otp.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.location.deleteMany();
    await prisma.subcategory.deleteMany();
    await prisma.category.deleteMany();
    await prisma.blog.deleteMany();
    await prisma.blogCategory.deleteMany();
    await prisma.faq.deleteMany();
    await prisma.faqCategory.deleteMany();
    await prisma.landingPage.deleteMany();
    await prisma.setting.deleteMany();
    await prisma.postalCode.deleteMany();
    await prisma.city.deleteMany();
    await prisma.state.deleteMany();

    console.log('✅ Database cleaned successfully');

    // 1. Seed Indian Locations (States, Cities, Postal Codes)
    const locationStats = await seedIndianLocations();

    // 2. Create Settings
    console.log('⚙️  Creating system settings...');
    await prisma.setting.createMany({
      data: [
        { key: 'app_name', value: 'PinNPost' },
        { key: 'app_version', value: '1.0.0' },
        { key: 'ad_expiry_days', value: 7 },
        { key: 'subscription_price', value: 100 },
        { key: 'subscription_currency', value: 'INR' },
        { key: 'max_images_per_ad', value: 10 },
        { key: 'enable_notifications', value: true },
        { key: 'maintenance_mode', value: false },
        // System settings for admin panel
        { key: 'booking_price', value: 9.99 },
        { key: 'reminder_expiration_days', value: [15, 13, 10] },
        { key: 'sms_notifications_enabled', value: true },
        { key: 'auto_refund_days', value: 7 },
        { key: 'auto_complete_booking_days', value: 7 }, // Auto-complete confirmed bookings after 7 days
        { key: 'auto_cancel_booking_days', value: 3 }, // Auto-cancel pending bookings after 3 days
        { key: 'subscription_duration', value: 15 },
        { key: 'free_ad_duration', value: 7 },
        { key: 'service_fee_fixed', value: 5.00 }, // ₹5.00 fixed service fee
        // Hero section settings
        { key: 'hero_title', value: 'Find Everything You Need' },
        { key: 'hero_subtitle', value: 'Discover amazing deals on products and services near you' },
        { key: 'hero_image', value: 'https://placehold.co/1920x500/CC1614/FFFFFF?text=Hero+Banner' },
        // Contact settings
        { key: 'customer_care_email', value: 'info@pinnpost.com' },
        // Legal settings
        { key: 'terms_of_service', value: '' },
        { key: 'privacy_policy', value: '' },
        { key: 'site_name', value: 'PinNPost' },
      ]
    });

    // 2. Create Users
    console.log('👥 Creating users...');

    // Super Admin
    const hashedAdminPassword = await hash('admin123', 12);
    const superAdmin = await prisma.user.create({
      data: {
        phone: '+6281234567890',
        email: 'admin@pinnpost.com',
        password: hashedAdminPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        isActive: true,
        isVerified: true,
      }
    });

    // Regular Users
    const users: any[] = [];
    for (let i = 1; i <= 10; i++) {
      const user = await prisma.user.create({
        data: {
          phone: generatePhone(),
          email: `user${i}@example.com`,
          password: await hash('password123', 12),
          firstName: `User${i}`,
          lastName: `Test${i}`,
          role: UserRole.USER,
          isActive: true,
          isVerified: true,
        }
      });
      users.push(user);
    }

    // 3. Get existing locations from seeded data
    console.log('📍 Fetching seeded locations...');
    const createdLocations = await prisma.location.findMany({
      include: { state: true, city: true, postalCode: true }
    });
    console.log(`   ✓ Found ${createdLocations.length} locations`);

    // 4. Create Profiles
    console.log('📝 Creating user profiles...');
    for (const user of users) {
      // Select a random location to associate with profile
      const randomLocation = createdLocations.length > 0 ? createdLocations[Math.floor(Math.random() * createdLocations.length)] : null;

      await prisma.profile.create({
        data: {
          userId: user.id,
          bio: `This is ${user.firstName}'s bio. I love buying and selling things on PinNPost!`,
          address: `${user.firstName} Address ${Math.floor(Math.random() * 1000)}`,
          country: 'India',
          cityId: randomLocation ? randomLocation.cityId : null,
          stateId: randomLocation ? randomLocation.stateId : null,
          postalCodeId: randomLocation ? randomLocation.postalCodeId : null,
          dob: new Date(1990 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          gender: ['Male', 'Female', 'Other'][Math.floor(Math.random() * 3)],
        }
      });
    }

    // 5. Create Categories and Subcategories from JSON data
    console.log('🏷️  Creating categories and subcategories...');
    const categoriesData = readCategoriesData();
    const createdCategories: any[] = [];

    // Track all used slugs to ensure global uniqueness
    const usedSlugs = new Set<string>();

    for (let i = 0; i < categoriesData.length; i++) {
      const categoryData = categoriesData[i];

      // Create category with full icon URL
      const baseUrl = getApiBaseUrl();
      const category = await prisma.category.create({
        data: {
          name: categoryData.name,
          slug: generateSlug(categoryData.name),
          description: `${categoryData.name} category`,
          image: `${baseUrl}/public/ICON/${categoryData.image}`, // Full URL to public ICON folder
          isActive: true,
          isFeatured: i < 5, // Mark first 5 categories as featured
          order: i + 1,
        }
      });

      createdCategories.push(category);
      console.log(`   ✓ Created category: ${category.name}`);

      // Create subcategories for this category
      if (categoryData.subcategories && categoryData.subcategories.length > 0) {
        const subcategoriesData: {
          name: string;
          slug: string;
          description: string;
          image: string;
          categoryId: string;
          isActive: boolean;
          order: number;
        }[] = [];

        for (let j = 0; j < categoryData.subcategories.length; j++) {
          const subcat = categoryData.subcategories[j];
          let slug = generateSlug(subcat.name);

          // Ensure globally unique slug by appending a counter if needed
          let uniqueSlug = slug;
          let counter = 1;
          while (usedSlugs.has(uniqueSlug)) {
            uniqueSlug = `${slug}-${counter}`;
            counter++;
          }

          // Add the slug to the used set
          usedSlugs.add(uniqueSlug);

          subcategoriesData.push({
            name: subcat.name,
            slug: uniqueSlug,
            description: `${subcat.name} subcategory`,
            image: `${baseUrl}/public/ICON/${subcat.image}`, // Full URL to public ICON folder
            categoryId: category.id,
            isActive: true,
            order: j + 1,
          });
        }

        await prisma.subcategory.createMany({
          data: subcategoriesData
        });

        console.log(`   ✓ Created ${subcategoriesData.length} subcategories for ${category.name}`);
      }
    }

    // 6. Create Attributes for Subcategories using comprehensive seeder
    console.log('🎛️  Creating attributes...');
    await seedAttributes();

    // 7. Create Blog Categories and Blogs
    console.log('📰 Creating blogs and blog categories...');
    await prisma.blogCategory.createMany({
      data: [
        {
          name: 'Platform Updates',
          slug: 'platform-updates',
          description: 'Latest updates and features for Pin N Post platform',
          order: 1,
        },
        {
          name: 'User Stories',
          slug: 'user-stories',
          description: 'Success stories from our users',
          order: 2,
        },
        {
          name: 'Tips & Tricks',
          slug: 'tips-tricks',
          description: 'Helpful tips for buying and selling',
          order: 3,
        },
      ]
    });

    const createdBlogCategories = await prisma.blogCategory.findMany();

    await prisma.blog.createMany({
      data: [
        {
          title: 'Welcome to Pin N Post Platform',
          slug: 'welcome-to-pinntpost-platform',
          content: 'We are excited to launch our new platform that connects buyers and sellers in your local community. With our easy-to-use interface and powerful features, you can buy and sell anything with confidence.',
          imageUrl: 'https://placehold.co/800x400/00B894/FFFFFF?text=Welcome+to+PinNPost',
          isActive: true,
          isFeatured: true,
          authorId: superAdmin.id,
          categoryId: createdBlogCategories[0].id,
        },
        {
          title: 'How to Sell Your Items Quickly',
          slug: 'how-to-sell-your-items-quickly',
          content: 'Selling items on Pin N Post is easy. Follow these simple steps: 1. Take clear photos, 2. Write detailed descriptions, 3. Set competitive prices, 4. Respond to inquiries promptly.',
          imageUrl: 'https://placehold.co/800x400/FDCB6E/FFFFFF?text=Selling+Tips',
          isActive: true,
          isFeatured: false,
          authorId: superAdmin.id,
          categoryId: createdBlogCategories[2].id,
        },
        {
          title: 'Success Story: From Local Business to Regional Leader',
          slug: 'success-story-local-business-regional-leader',
          content: 'Meet Sarah, who started her small boutique business on Pin N Post and grew it into a regional success story. Her dedication to quality items and excellent customer service made all the difference.',
          imageUrl: 'https://placehold.co/800x400/A29BFE/FFFFFF?text=Success+Story',
          isActive: true,
          isFeatured: true,
          authorId: superAdmin.id,
          categoryId: createdBlogCategories[1].id,
        },
      ]
    });

    // 8. Create FAQ Categories and FAQs
    console.log('❓ Creating FAQ categories and FAQs...');
    await prisma.faqCategory.createMany({
      data: [
        {
          name: 'General',
          slug: 'general',
          description: 'General questions about PinNPost',
          order: 1,
        },
        {
          name: 'Buying',
          slug: 'buying',
          description: 'Questions related to buying items',
          order: 2,
        },
        {
          name: 'Selling',
          slug: 'selling',
          description: 'Questions related to selling items',
          order: 3,
        },
        {
          name: 'Account & Safety',
          slug: 'account-safety',
          description: 'Account management and safety tips',
          order: 4,
        },
      ]
    });

    const createdFaqCategories = await prisma.faqCategory.findMany();
    
    await prisma.faq.createMany({
      data: [
        // General FAQs
        {
          question: 'What is PinNPost?',
          answer: 'Pin N Post is a local marketplace platform that connects buyers and sellers in their community. You can buy and sell various items safely and easily.',
          order: 1,
          categoryId: createdFaqCategories[0].id,
        },
        {
          question: 'Is Pin N Post free to use?',
          answer: 'Yes, basic features are free to use. We only charge a small fee for premium features like promoting your ads.',
          order: 2,
          categoryId: createdFaqCategories[0].id,
        },
        // Buying FAQs
        {
          question: 'How do I buy an item?',
          answer: 'Simply browse through listings, contact seller through our messaging system, and arrange for pickup or delivery. Always verify the item before making payment.',
          order: 1,
          categoryId: createdFaqCategories[1].id,
        },
        {
          question: 'Is it safe to buy from unknown sellers?',
          answer: 'We recommend meeting in public places and inspecting items before payment. Never share financial information outside our platform.',
          order: 2,
          categoryId: createdFaqCategories[1].id,
        },
        // Selling FAQs
        {
          question: 'How do I list an item for sale?',
          answer: 'Click on "Post Ad", choose your category, upload photos, write a description, set your price, and publish. Your ad will be live immediately!',
          order: 1,
          categoryId: createdFaqCategories[2].id,
        },
        {
          question: 'How much does it cost to post an ad?',
          answer: 'Basic ads are free for 7 days. You can extend or promote your ads for a small fee to get more visibility.',
          order: 2,
          categoryId: createdFaqCategories[2].id,
        },
        // Account & Safety FAQs
        {
          question: 'How do I create an account?',
          answer: 'Download our app or visit our website, click on "Sign Up", enter your phone number, verify it with OTP, and you\'re ready to go!',
          order: 1,
          categoryId: createdFaqCategories[3].id,
        },
        {
          question: 'How can I report suspicious activity?',
          answer: 'Use the "Report" button on any listing or user profile. Our team reviews all reports and takes appropriate action.',
          order: 2,
          categoryId: createdFaqCategories[3].id,
        },
      ]
    });

    // 9. Create Landing Page Config
    console.log('🏠 Creating landing page configuration...');
    await prisma.landingPage.createMany({
      data: [
        {
          sectionKey: 'hero',
          config: {
            title: 'Welcome to PinNPost',
            subtitle: 'Buy and sell anything in your local community',
            backgroundImage: 'https://placehold.co/1920x600/2D3436/FFFFFF?text=Hero+Background',
            ctaText: 'Start Shopping',
            ctaLink: '/ads'
          },
        },
        {
          sectionKey: 'featured_categories',
          config: {
            title: 'Popular Categories',
            categories: [
              { name: 'Free Items', icon: 'gift', slug: 'free-items' },
              { name: 'Cars', icon: 'car', slug: 'cars' },
              { name: 'Property', icon: 'home', slug: 'property' },
              { name: 'Phones & Gadgets', icon: 'smartphone', slug: 'phones-gadgets' },
              { name: 'Hobbies & Sports', icon: 'football', slug: 'hobbies-sports' },
            ]
          },
        },
        {
          sectionKey: 'how_it_works',
          config: {
            title: 'How It Works',
            steps: [
              { title: 'Browse', description: 'Find items you love' },
              { title: 'Connect', description: 'Contact sellers directly' },
              { title: 'Transact', description: 'Buy safely and securely' },
            ]
          },
        },
        {
          sectionKey: 'testimonials',
          config: {
            title: 'What Our Users Say',
            testimonials: [
              { name: 'Rahul S.', text: 'Great platform! Sold my old laptop in just 2 days.' },
              { name: 'Priya M.', text: 'Found exactly what I was looking for. Amazing prices!' },
              { name: 'Amit K.', text: 'Very user-friendly app. Highly recommended!' },
            ]
          },
        },
      ]
    });

    // 10. Create User Locations
    console.log('🗺️  Creating user locations...');
    if (createdLocations.length > 0) {
      for (let i = 0; i < users.length; i++) {
        await prisma.userLocation.create({
          data: {
            userId: users[i].id,
            locationId: createdLocations[i % createdLocations.length].id,
            isPrimary: true,
          }
        });
      }
      console.log(`   ✓ Created ${Math.min(users.length, createdLocations.length)} user locations`);
    } else {
      console.log('   ⚠️ No locations found, skipping user locations');
    }

    // 11. Create Sample Ads
    console.log('📦 Creating sample ads...');
    const allCategories = await prisma.category.findMany();
    const allSubcategories = await prisma.subcategory.findMany();
    
    // Create 50 ads with more featured ads
    const TOTAL_ADS = 50;
    const FEATURED_ADS_COUNT = 12; // Make 12 ads featured
    const MIN_APPROVED_FEATURED = 5; // At least 5 featured ads must be approved
    
    for (let i = 0; i < TOTAL_ADS; i++) {
      const category = allCategories[Math.floor(Math.random() * allCategories.length)];
      const subcategory = allSubcategories.filter(s => s.categoryId === category.id)[0];

      if (subcategory) {
        const title = `Sample ${category.name} Item ${i + 1}`;
        const isFeatured = i < FEATURED_ADS_COUNT;
        
        // Ensure first 5 featured ads are always APPROVED, others can be random
        let status: AdStatus;
        if (isFeatured && i < MIN_APPROVED_FEATURED) {
          status = AdStatus.APPROVED;
        } else {
          status = [AdStatus.REVIEW, AdStatus.APPROVED, AdStatus.REJECTED][Math.floor(Math.random() * 3)] as AdStatus;
        }
        
        // Get location data for the ad
        const adLocation = createdLocations.length > 0 ? createdLocations[i % createdLocations.length] : null;

        const ad = await prisma.ad.create({
          data: {
            title,
            description: `This is a great ${category.name.toLowerCase()} item in excellent condition. Perfect for anyone looking for quality products at reasonable prices. Item has been well-maintained and is ready for immediate use.`,
            price: Math.floor(Math.random() * 50000) + 1000,
            status,
            images: [
              `https://placehold.co/600x400/74B9FF/FFFFFF?text=Ad+${i + 1}+Image+1`,
              `https://placehold.co/600x400/74B9FF/FFFFFF?text=Ad+${i + 1}+Image+2`,
              `https://placehold.co/600x400/74B9FF/FFFFFF?text=Ad+${i + 1}+Image+3`,
            ],
            categoryId: category.id,
            subcategoryId: subcategory.id,
            userId: users[i % users.length].id,
            isFeatured,
            slug: generateSlug(title),
            expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)), // 7 days from now
            // Populate verbose location fields
            locationLatitude: adLocation?.latitude,
            locationLongitude: adLocation?.longitude,
            locationRoad: adLocation?.address ? `Road ${i + 1}` : null,
            locationHouseNumber: adLocation?.address ? `${Math.floor(Math.random() * 100) + 1}` : null,
            locationCity: adLocation?.city?.name,
            locationState: adLocation?.state?.name,
            locationCountry: adLocation?.country || 'India',
            locationPostalCode: adLocation?.postalCode?.code,
            locationFormatted: adLocation?.address || `${adLocation?.city?.name || ''}, ${adLocation?.state?.name || ''}`.trim(),
          }
        });

        // Add attributes for some ads
        if (Math.random() > 0.5) {
          const attributes = await prisma.attribute.findMany({
            where: { subcategoryId: subcategory.id }
          });

          for (const attr of attributes.slice(0, 2)) {
            let value: string;
            if (attr.type === 'select' && Array.isArray(attr.options)) {
              value = (attr.options as string[])[Math.floor(Math.random() * (attr.options as string[]).length)];
            } else if (attr.type === 'number') {
              value = String(Math.floor(Math.random() * 100));
            } else {
              value = 'Sample value';
            }

            await prisma.adAttribute.create({
              data: {
                adId: ad.id,
                attributeId: attr.id,
                value,
              }
            });
          }
        }
      }
    }

    // 12. Create Sample Bookings
    console.log('📅 Creating sample bookings...');
    const ads = await prisma.ad.findMany({ take: 10 });

    if (ads.length === 0) {
      console.log('   ⚠️ No ads found, skipping booking creation');
    } else {
      for (let i = 0; i < Math.min(5, ads.length); i++) {
        await prisma.booking.create({
          data: {
            adId: ads[i].id,
            userId: users[(i + 1) % users.length].id,
            startDate: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)),
            endDate: new Date(Date.now() + ((i + 1) * 24 * 60 * 60 * 1000)),
            status: [BookingStatus.SUBMITTED, BookingStatus.CONFIRMED, BookingStatus.COMPLETED][Math.floor(Math.random() * 3)] as BookingStatus,
            notes: `Booking note for ${ads[i].title}`,
          }
        });
      }
      console.log(`   ✓ Created ${Math.min(5, ads.length)} bookings`);
    }

    // 13. Create Sample Subscriptions
    console.log('💳 Creating sample subscriptions...');
    for (let i = 0; i < 8; i++) {
      await prisma.subscription.create({
        data: {
          userId: users[i].id,
          adId: ads[i].id,
          startDate: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)),
          endDate: new Date(Date.now() + ((7 - i) * 24 * 60 * 60 * 1000)),
          isRenewed: Math.random() > 0.7,
          isActive: true,
        }
      });
    }

    // 14. Create Sample Transactions
    console.log('💰 Creating sample transactions...');
    const subscriptions = await prisma.subscription.findMany({ take: 5 });
    
    for (let i = 0; i < subscriptions.length; i++) {
      await prisma.transaction.create({
        data: {
          userId: subscriptions[i].userId,
          subscriptionId: subscriptions[i].id,
          amount: 99,
          currency: 'INR',
          status: [TransactionStatus.COMPLETED, TransactionStatus.PENDING][Math.floor(Math.random() * 2)] as TransactionStatus,
          paymentProvider: PaymentProvider.RAZORPAY,
          paymentIntentId: `razorpay_${generateUuid()}`,
          description: `Subscription for ad promotion`,
        }
      });
    }

    // 15. Create Sample Notifications
    console.log('🔔 Creating sample notifications...');
    for (let i = 0; i < users.length; i++) {
      await prisma.notification.createMany({
        data: [
          {
            userId: users[i].id,
            title: 'Welcome to PinNPost!',
            message: 'Thank you for joining our community. Start exploring amazing deals around you!',
            type: NotificationType.GENERAL,
            data: { action: 'explore' },
          },
          {
            userId: users[i].id,
            title: 'Your ad is getting views',
            message: 'Your recent ad has been viewed by multiple interested buyers. Check your messages!',
            type: NotificationType.AD_APPROVED,
            data: { adId: ads[i]?.id },
            isRead: Math.random() > 0.5,
          },
        ]
      });
    }

    // 16. Create Sample Wishlists
    console.log('❤️  Creating sample wishlists...');
    for (let i = 0; i < users.length; i++) {
      for (let j = 0; j < 3; j++) {
        await prisma.wishlist.create({
          data: {
            userId: users[i].id,
            adId: ads[(i + j) % ads.length].id,
          }
        });
      }
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('\n📊 Seeding Summary:');
    console.log(`- States: ${locationStats.states}`);
    console.log(`- Cities: ${locationStats.cities}`);
    console.log(`- Postal Codes: ${locationStats.postalCodes}`);
    console.log(`- Locations: ${locationStats.locations}`);
    console.log(`- Super Admin: 1`);
    console.log(`- Regular Users: ${users.length}`);
    console.log(`- Categories: ${createdCategories.length}`);
    console.log(`- Subcategories: ${await prisma.subcategory.count()}`);
    console.log(`- Attributes: 6`);
    console.log(`- Locations: ${createdLocations.length}`);
    console.log(`- Blog Categories: 3`);
    console.log(`- Blog Articles: 3`);
    console.log(`- FAQ Categories: 4`);
    console.log(`- FAQs: 8`);
    console.log(`- Landing Page Sections: 4`);
    console.log(`- Ads: ${TOTAL_ADS}`);
    console.log(`- Bookings: 5`);
    console.log(`- Subscriptions: 8`);
    console.log(`- Transactions: 5`);
    console.log(`- Notifications: ${users.length * 2}`);
    console.log(`- Wishlists: ${users.length * 3}`);
    console.log(`- Settings: 8`);

    console.log('\n🔐 Login Credentials:');
    console.log(`Super Admin: admin@pinnpost.com / admin123`);
    console.log(`Test Users: user1@example.com / password123 (user1-10)`);

    // Import legal document content from docs directory
    const privacyContent = fs.readFileSync(path.join(__dirname, '../prisma/docs/privacy.html'), 'utf8');
    const termsContent = fs.readFileSync(path.join(__dirname, '../prisma/docs/terms.html'), 'utf8');

    // 17. Create Legal Documents
    console.log('📝 Creating legal documents...');

    // Create or update Privacy Policy
    await prisma.legalDocument.upsert({
      where: { slug: 'privacy-policy' },
      update: {
        title: 'Privacy Policy',
        content: privacyContent,
        isActive: true,
      },
      create: {
        title: 'Privacy Policy',
        slug: 'privacy-policy',
        content: privacyContent,
        isActive: true,
      },
    });

    // Create or update Terms of Service
    await prisma.legalDocument.upsert({
      where: { slug: 'terms-of-service' },
      update: {
        title: 'Terms of Service',
        content: termsContent,
        isActive: true,
      },
      create: {
        title: 'Terms of Service',
        slug: 'terms-of-service',
        content: termsContent,
        isActive: true,
      },
    });

    // Create or update Account Deletion Policy
    await prisma.legalDocument.upsert({
      where: { slug: 'account-deletion' },
      update: {
        title: 'Account Deletion Policy',
        content: '<h1>Account Deletion Policy</h1><p>Last updated: December 31, 2025</p><h2>Your Right to Delete</h2><p>You have the right to delete your Pin N Post account at any time. When you delete your account, the following will occur:</p><h2>What Gets Deleted</h2><ul><li>Your profile information (name, email, phone number)</li><li>Your account credentials</li><li>Your notification preferences</li><li>Your saved locations</li><li>Your wishlist items</li></ul><h2>What Happens to Your Content</h2><ul><li><strong>Active Ads:</strong> All your active ads will be permanently removed from the platform</li><li><strong>Bookings:</strong> Pending bookings will be cancelled. Completed booking records may be retained for legal and accounting purposes</li><li><strong>Transactions:</strong> Transaction records will be retained as required by law for tax and financial reporting</li></ul><h2>Data Retention</h2><p>Some data may be retained for:</p><ul><li>Legal compliance (tax records, transaction history)</li><li>Fraud prevention and security</li><li>Backup systems (automatically purged within 90 days)</li></ul><h2>How to Delete Your Account</h2><ol><li>Log in to your account</li><li>Go to Settings</li><li>Select Delete Account</li><li>Confirm your decision</li></ol><p><strong>Note:</strong> Account deletion is permanent and cannot be undone. You will need to create a new account if you wish to use our services again.</p><h2>Contact Us</h2><p>If you have questions about account deletion, contact us at: support@pinnpost.com</p>',
        isActive: true,
      },
      create: {
        title: 'Account Deletion Policy',
        slug: 'account-deletion',
        content: '<h1>Account Deletion Policy</h1><p>Last updated: December 31, 2025</p><h2>Your Right to Delete</h2><p>You have the right to delete your Pin N Post account at any time. When you delete your account, the following will occur:</p><h2>What Gets Deleted</h2><ul><li>Your profile information (name, email, phone number)</li><li>Your account credentials</li><li>Your notification preferences</li><li>Your saved locations</li><li>Your wishlist items</li></ul><h2>What Happens to Your Content</h2><ul><li><strong>Active Ads:</strong> All your active ads will be permanently removed from the platform</li><li><strong>Bookings:</strong> Pending bookings will be cancelled. Completed booking records may be retained for legal and accounting purposes</li><li><strong>Transactions:</strong> Transaction records will be retained as required by law for tax and financial reporting</li></ul><h2>Data Retention</h2><p>Some data may be retained for:</p><ul><li>Legal compliance (tax records, transaction history)</li><li>Fraud prevention and security</li><li>Backup systems (automatically purged within 90 days)</li></ul><h2>How to Delete Your Account</h2><ol><li>Log in to your account</li><li>Go to Settings</li><li>Select Delete Account</li><li>Confirm your decision</li></ol><p><strong>Note:</strong> Account deletion is permanent and cannot be undone. You will need to create a new account if you wish to use our services again.</p><h2>Contact Us</h2><p>If you have questions about account deletion, contact us at: support@pinnpost.com</p>',
        isActive: true,
      },
    });

    console.log('✅ Legal documents created/updated successfully');
    console.log(`- Legal Documents: 3`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeder
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });