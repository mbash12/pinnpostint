import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface LocationData {
  state: string;
  district: string;
  city: string;
  pincode: string;
}

async function seedIndianLocations() {
  const dataPath = path.join(__dirname, 'major-states-locations.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error('Location data file not found. Run extract script first.');
    process.exit(1);
  }

  console.log('Loading location data...');
  const locations: LocationData[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
  console.log(`Total locations to seed: ${locations.length}`);

  // Group by state
  const stateGroups = locations.reduce((acc, loc) => {
    if (!acc[loc.state]) acc[loc.state] = [];
    acc[loc.state].push(loc);
    return acc;
  }, {} as Record<string, LocationData[]>);

  let statesCreated = 0;
  let citiesCreated = 0;
  let postalCodesCreated = 0;

  for (const [stateName, stateLocs] of Object.entries(stateGroups)) {
    console.log(`\nProcessing ${stateName} (${stateLocs.length} locations)...`);

    // Create or get state
    const state = await prisma.state.upsert({
      where: { name: stateName },
      update: {},
      create: { name: stateName }
    });
    statesCreated++;

    // Group by district (this is the actual city)
    const districtGroups = stateLocs.reduce((acc, loc) => {
      if (!acc[loc.district]) acc[loc.district] = [];
      acc[loc.district].push(loc);
      return acc;
    }, {} as Record<string, LocationData[]>);

    for (const [districtName, districtLocs] of Object.entries(districtGroups)) {
      // Create or get city (using district as city name)
      const city = await prisma.city.upsert({
        where: { 
          name_stateId: { 
            name: districtName, 
            stateId: state.id 
          } 
        },
        update: {},
        create: { 
          name: districtName, 
          stateId: state.id 
        }
      });
      citiesCreated++;

      // Get unique postal codes for this district
      const uniquePincodes = [...new Set(districtLocs.map(loc => loc.pincode))];
      
      for (const pincode of uniquePincodes) {
        try {
          await prisma.postalCode.upsert({
            where: {
              code_cityId: {
                code: pincode,
                cityId: city.id
              }
            },
            update: {},
            create: {
              code: pincode,
              cityId: city.id
            }
          });
          postalCodesCreated++;
        } catch {
          // Skip duplicates
        }
      }
    }

    console.log(`  ✓ ${stateName} completed`);
  }

  console.log(`\n✅ Seeding complete!`);
  console.log(`   States: ${statesCreated}`);
  console.log(`   Cities (Districts): ${citiesCreated}`);
  console.log(`   Postal Codes: ${postalCodesCreated}`);
}

seedIndianLocations()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
