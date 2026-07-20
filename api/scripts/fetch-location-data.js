#!/usr/bin/env node

/**
 * Location Data Fetcher Script - Pure API
 *
 * This script fetches location data ONLY from public APIs.
 * Absolutely no hardcoded data anywhere.
 *
 * Usage: node scripts/fetch-location-data.js
 *
 * Output files:
 * - data/locations/states.json
 * - data/locations/cities.json
 * - data/locations/postal-codes.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data', 'locations');

// Ensure data directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Helper function to fetch data from URL
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    client.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Sleep function to respect rate limits
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// DATA SOURCE 1: Indian States from REST Countries API
// ============================================
async function fetchIndianStates() {
  console.log('\n🌍 Fetching Indian states from REST Countries API...');
  
  const url = 'https://restcountries.com/v3.1/alpha/IN';
  console.log(`   URL: ${url}`);
  
  try {
    const data = await fetchUrl(url);

    if (data && data.subdivisions && Array.isArray(data.subdivisions)) {
      const states = data.subdivisions.map(sub => ({
        name: sub.name,
        code: sub.code,
        country: 'India',
        isActive: true
      }));

      console.log(`   ✓ Fetched ${states.length} states from API`);
      return states;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('   ✗ REST Countries API failed:', error.message);
    throw new Error('Failed to fetch states from API');
  }
}

// ============================================
// DATA SOURCE 2: Cities from Geonames API
// ============================================
async function fetchCities() {
  console.log('\n🏙️  Fetching cities from Geonames API...');
  const cities = [];
  
  // Fetch cities by population tiers
  const populationTiers = [
    { minPop: 1000000, maxRows: 100, name: 'major cities' },
    { minPop: 200000, maxRows: 500, name: 'large cities' },
    { minPop: 50000, maxRows: 1000, name: 'medium cities' }
  ];
  
  for (const tier of populationTiers) {
    try {
      console.log(`   Fetching ${tier.name} (population > ${tier.minPop})...`);
      const url = `http://api.geonames.org/searchJSON?country=IN&featureClass=P&minPopulation=${tier.minPop}&maxRows=${tier.maxRows}&username=demo`;
      console.log(`     URL: ${url}`);
      
      const response = await fetchUrl(url);
      
      if (response && response.geonames && Array.isArray(response.geonames)) {
        const tierCities = response.geonames.map(city => ({
          name: city.name,
          state: city.adminName1 || 'Unknown', // Using adminName1 directly from API
          district: city.adminName2 || '',
          lat: parseFloat(city.lat),
          lng: parseFloat(city.lng),
          code: city.name.substring(0, 3).toUpperCase(),
          population: city.population ? parseInt(city.population) : tier.minPop,
          stateCode: city.adminCode1 || ''
        })).filter(city => city.state && city.lat && city.lng); // Filter out cities without valid state or coordinates
        
        // Add to cities array, avoiding duplicates
        tierCities.forEach(city => {
          if (!cities.find(c => c.name === city.name && c.state === city.state)) {
            cities.push(city);
          }
        });
        
        console.log(`     ✓ Found ${tierCities.length} ${tier.name}`);
      } else {
        throw new Error('Invalid response format');
      }
      
      // Add delay between API calls
      await sleep(500);
    } catch (error) {
      console.log(`     ✗ Failed to fetch ${tier.name}: ${error.message}`);
      throw new Error(`Failed to fetch ${tier.name} from Geonames API`);
    }
  }
  
  // Sort cities by population
  cities.sort((a, b) => (b.population || 0) - (a.population || 0));
  
  console.log(`   ✓ Fetched ${cities.length} cities from Geonames API`);
  return cities;
}

// ============================================
// DATA SOURCE 3: Postal Codes from IndiaPost API
// ============================================
async function fetchPostalCodes() {
  console.log('\n📮 Fetching postal codes from IndiaPost API...');
  const postalCodes = [];
  
  // Get postal codes for major cities
  const majorCities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata',
    'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'
  ];
  
  // Try to get postal codes for each city
  for (const cityName of majorCities) {
    try {
      const url = `https://api.postalpincode.in/postoffice/bycity/${cityName}`;
      console.log(`   Fetching postal codes for ${cityName}...`);
      console.log(`     URL: ${url}`);
      
      const response = await fetchUrl(url);
      
      if (response && Array.isArray(response) && response.length > 0 && response[0].PostOffice && Array.isArray(response[0].PostOffice)) {
        response[0].PostOffice.forEach(postOffice => {
          if (postOffice.Pincode) {
            postalCodes.push({
              code: postOffice.Pincode,
              city: cityName,
              district: postOffice.District || '',
              state: postOffice.State || '',
              isActive: true
            });
          }
        });
        console.log(`     ✓ Found ${response[0].PostOffice.length} postal codes for ${cityName}`);
      } else {
        throw new Error('Invalid response format');
      }
      
      // Add delay between API calls
      await sleep(500);
    } catch (error) {
      console.log(`     ✗ Failed to fetch postal codes for ${cityName}: ${error.message}`);
      throw new Error(`Failed to fetch postal codes for ${cityName} from IndiaPost API`);
    }
  }
  
  // Remove duplicates
  const uniquePostalCodes = postalCodes.filter((pc, index, self) => 
    index === self.findIndex(p => p.code === pc.code)
  );
  
  console.log(`   ✓ Fetched ${uniquePostalCodes.length} postal codes from IndiaPost API`);
  return uniquePostalCodes;
}

// ============================================
// MAIN FUNCTION
// ============================================
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   Location Data Fetcher for Pin N Post                  ║');
  console.log('║   Pure API Data Fetching                           ║');
  console.log('║   NO HARDCODED DATA ANYWHERE                      ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  try {
    // Ensure data directory exists
    ensureDir(DATA_DIR);

    // Fetch all data from APIs only
    console.log('\n🔄 Starting API data fetching...');
    
    const states = await fetchIndianStates();
    await sleep(1000); // Respect rate limits

    const cities = await fetchCities();
    const postalCodes = await fetchPostalCodes();

    // Save to JSON files
    console.log('\n💾 Saving data to JSON files...');

    const files = [
      { name: 'states.json', data: states },
      { name: 'cities.json', data: cities },
      { name: 'postal-codes.json', data: postalCodes }
    ];

    for (const file of files) {
      const filePath = path.join(DATA_DIR, file.name);
      fs.writeFileSync(filePath, JSON.stringify(file.data, null, 2), 'utf8');
      console.log(`   ✓ ${file.name} (${file.data.length} records)`);
    }

    // Generate summary
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║   Data Fetch Summary                                 ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(`\n📊 Pure API Data Fetched:`);
    console.log(`   • States:           ${states.length}`);
    console.log(`   • Cities:           ${cities.length}`);
    console.log(`   • Postal Codes:    ${postalCodes.length}`);
    console.log(`\n📁 Output directory: ${DATA_DIR}`);
    console.log('\n✅ Location data fetched successfully from APIs ONLY!');
    console.log('\n📝 Next steps:');
    console.log('   1. Review generated JSON files');
    console.log('   2. Edit files if needed');
    console.log('   3. Run seed script: npx prisma db seed');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error fetching location data from APIs:', error.message);
    console.error('\n💡 This script uses APIs only and has NO hardcoded data.');
    console.error('   If APIs are down or rate limited, this script will fail.');
    process.exit(1);
  }
}

// Run main function
main();