import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Path to location data files
const DATA_DIR = path.join(__dirname, '../scripts/data/locations');

// Read JSON data
function readJsonFile(filename: string) {
  const filePath = path.join(DATA_DIR, filename);
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

export async function seedLocations() {
  console.log('🌍 Seeding location data...');
  
  try {
    // Read location data
    const states = readJsonFile('states.json');
    const cities = readJsonFile('cities.json');
    const postalCodes = readJsonFile('postal-codes.json');
    
    console.log(`📊 Location data to seed:`);
    console.log(`   • States: ${states.length}`);
    console.log(`   • Cities: ${cities.length}`);
    console.log(`   • Postal Codes: ${postalCodes.length}`);
    
    // Clear existing location data
    console.log('\n🗑️  Clearing existing location data...');
    await prisma.postalCode.deleteMany();
    await prisma.city.deleteMany();
    await prisma.state.deleteMany();
    console.log('   ✓ Cleared existing data');
    
    // Seed states
    console.log('\n🏛️  Seeding states...');
    const createdStates: Array<{ id: string; code: string; name: string }> = [];
    
    for (const state of states) {
      const createdState = await prisma.state.create({
        data: {
          name: state.name,
          code: state.code || '', // Handle null case
          isActive: state.isActive,
        }
      });
      createdStates.push({
        id: createdState.id,
        code: createdState.code || '',
        name: createdState.name
      });
    }
    console.log(`   ✓ Seeded ${states.length} states`);
    
    // Create state mapping for reference
    const stateMap = new Map(createdStates.map(s => [s.code || s.name, s.id]));
    
    // Seed cities
    console.log('\n🏙️  Seeding cities...');
    const createdCities: Array<{ id: string; stateId: string; name: string }> = [];
    const cityMap = new Map<string, string>(); // Maps "cityName_stateCode" to cityId

    for (const city of cities) {
      // Find matching state code (clean up first 2 characters)
      const stateCode = city.state.substring(0, 2).toUpperCase().replace(/\s+/g, '');
      const stateId = stateMap.get(stateCode);

      if (stateId) {
        const createdCity = await prisma.city.create({
          data: {
            name: city.name,
            code: city.code || '', // Handle null case
            stateId: stateId,
            isActive: city.isActive,
          }
        });
        createdCities.push({ id: createdCity.id, stateId, name: city.name });
        // Create a map entry for quick lookup: "cityName_stateCode" -> cityId
        const key = `${city.name.toLowerCase()}_${stateCode}`;
        cityMap.set(key, createdCity.id);
      }
    }
    console.log(`   ✓ Seeded ${createdCities.length} cities`);
    
    // Seed postal codes with upsert to handle duplicates
    console.log('\n📮 Seeding postal codes...');
    let postalCodeCount = 0;
    
    for (const postalCode of postalCodes) {
      const stateCode = postalCode.state.substring(0, 2).toUpperCase().replace(/\s+/g, '');
      const stateId = stateMap.get(stateCode);
      
      if (stateId) {
        // Find a matching city using the city map
        let cityId: string | null = null;
        if (postalCode.city) {
          const cityName = postalCode.city.toLowerCase();
          const stateCodeFromPostal = postalCode.state.substring(0, 2).toUpperCase().replace(/\s+/g, '');
          const cityKey = `${cityName}_${stateCodeFromPostal}`;
          
          // Look up the city ID using the map
          cityId = cityMap.get(cityKey) || null;
        }
        
        // Use upsert to avoid duplicate constraint errors
        await prisma.postalCode.upsert({
          where: {
            code_cityId: {
              code: postalCode.code,
              cityId: cityId || createdCities[0]?.id || stateId // Fallback
            }
          },
          update: {
            isActive: postalCode.isActive,
          },
          create: {
            code: postalCode.code,
            cityId: cityId || createdCities[0]?.id || stateId, // Fallback
            isActive: postalCode.isActive,
          }
        });
        postalCodeCount++;
      }
    }
    console.log(`   ✓ Seeded ${postalCodeCount} postal codes`);
    
    // Create some sample locations for ads
    console.log('\n📍 Creating sample locations...');

    // Create sample locations with postal codes by using a broader selection of states
    const majorStates = ['MH', 'DL', 'KA', 'TN', 'WB', 'GU', 'UP', 'RA', 'TE', 'KE']; // Top 10 states by population
    const sampleLocationNames = [
      'Gateway of India, Mumbai',
      'India Gate, New Delhi',
      'Bangalore Palace, Bangalore',
      'Marina Beach, Chennai',
      'Victoria Memorial, Kolkata',
      'Sabarmati Ashram, Ahmedabad',
      'Taj Mahal, Agra',
      'City Palace, Udaipur',
      'Charminar, Hyderabad',
      'Kerala Backwaters, Alleppey'
    ];

    const sampleLocations: any[] = [];
    for (let i = 0; i < majorStates.length; i++) {
      const stateCode = majorStates[i];
      let stateId = stateMap.get(stateCode);

      // If state code wasn't found, try to find by name
      if (!stateId) {
        const stateEntry = states.find((s: any) =>
          s.code?.substring(0, 2).toUpperCase().replace(/\s+/g, '') === stateCode ||
          s.name.substring(0, 2).toUpperCase().replace(/\s+/g, '') === stateCode ||
          s.name.toUpperCase().replace(/\s+/g, '') ===
            (stateCode === 'DL' ? 'DELHI' :
             stateCode === 'KA' ? 'KARNATAKA' :
             stateCode === 'TN' ? 'TAMILNADU' :
             stateCode === 'WB' ? 'WESTBENGAL' :
             stateCode === 'GU' ? 'GUJARAT' :
             stateCode === 'UP' ? 'UTTARPRADESH' :
             stateCode === 'RA' ? 'RAJASTHAN' :
             stateCode === 'TE' ? 'TELANGANA' :
             stateCode === 'KE' ? 'KERALA' :
             stateCode)
        );

        if (stateEntry) {
          stateId = stateMap.get(stateEntry.code) || stateMap.get(stateEntry.name);
        }
      }

      if (stateId) {
        // Find the first city in this state
        const matchingCity = createdCities.find((c: any) => c.stateId === stateId);

        if (matchingCity) {
          // Find a postal code for this state from the postalCodes data
          const stateName = states.find((s: any) =>
            stateMap.get(s.code) === stateId || stateMap.get(s.name) === stateId
          )?.name;

          if (stateName) {
            // Find the first postal code for this state
            const statePostalCodes = postalCodes.filter((pc: any) =>
              pc.state.toUpperCase().includes(stateName.toUpperCase())
            );

            if (statePostalCodes.length > 0) {
              const firstPostalCode = statePostalCodes[0];

              // Check if this postal code already exists for this city
              let existingPostalCode = await prisma.postalCode.findUnique({
                where: { code_cityId: { code: firstPostalCode.code, cityId: matchingCity.id } }
              });

              if (!existingPostalCode) {
                // Create the postal code if it doesn't exist for this city
                existingPostalCode = await prisma.postalCode.create({
                  data: {
                    code: firstPostalCode.code,
                    cityId: matchingCity.id,
                    isActive: firstPostalCode.isActive ?? true,
                  }
                });
              }

              // Create a sample location with coordinates and the postal code
              const sampleLocation = await prisma.location.create({
                data: {
                  name: sampleLocationNames[i],
                  address: `Sample address in ${stateName}`,
                  latitude: 18.9 + (i * 1.5), // Different latitudes for different locations
                  longitude: 72.8 + (i * 2.5), // Different longitudes for different locations
                  country: 'India',
                  stateId: stateId,
                  cityId: matchingCity.id,
                  postalCodeId: existingPostalCode.id,
                }
              });

              sampleLocations.push(sampleLocation);
            }
          }
        }
      }
    }
    
    const createdLocationIds = sampleLocations.map(location => location.id);
    console.log(`   ✓ Created ${createdLocationIds.length} sample locations`);

    // Update postal code count to reflect the total after adding sample locations
    const totalPostalCodeCount = await prisma.postalCode.count();

    console.log('\n✅ Location data seeding completed successfully!');
    console.log('\n📊 Final location counts:');
    console.log(`   • States: ${states.length}`);
    console.log(`   • Cities: ${createdCities.length}`);
    console.log(`   • Postal Codes: ${totalPostalCodeCount}`);
    console.log(`   • Sample Locations: ${createdLocationIds.length}`);

    // Return created locations for main seeder
    const allLocations = await prisma.location.findMany({
      select: {
        id: true,
        stateId: true,
        cityId: true,
        postalCodeId: true
      }
    });

    return allLocations;
    
  } catch (error) {
    console.error('❌ Error seeding locations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}