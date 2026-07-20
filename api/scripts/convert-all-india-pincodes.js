#!/usr/bin/env node

/**
 * All India Postal Code Data Converter
 * 
 * Converts all-india-pincode-json-array.json into 
 * smaller, optimized files for seeding application.
 * 
 * Usage: node scripts/convert-all-india-pincodes.js
 * 
 * Input:  ../all-india-pincode-json-array.json (53MB)
 * Output: data/locations/states.json
 *         data/locations/districts.json  
 *         data/locations/cities.json
 *         data/locations/postal-codes.json
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, 'data', 'locations');
const INPUT_FILE = path.join(__dirname, '..', 'prisma', 'all-india-pincode-json-array.json');

// Ensure data directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Stream read large JSON file efficiently
 */
async function readLargeJsonFile(filePath) {
  console.log('📖 Reading large JSON file...');
  console.log(`   File: ${filePath}`);
  
  // Read file size first
  const stats = fs.statSync(filePath);
  const fileSizeMB = Math.round(stats.size / (1024 * 1024));
  console.log(`   Size: ${fileSizeMB}MB`);
  
  // Read file
  const data = fs.readFileSync(filePath, 'utf8');
  console.log(`   ✓ Read ${stats.size.toLocaleString()} bytes`);
  
  try {
    const jsonData = JSON.parse(data);
    console.log(`   ✓ Parsed ${jsonData.length.toLocaleString()} postal records`);
    return jsonData;
  } catch (error) {
    console.error('   ✗ JSON parse failed, trying to fix...');
    
    // Try to fix common JSON issues
    let fixedData = data.trim();
    if (!fixedData.startsWith('[')) {
      fixedData = '[' + fixedData;
    }
    if (!fixedData.endsWith(']')) {
      fixedData = fixedData + ']';
    }
    
    // Remove trailing commas between objects
    fixedData = fixedData.replace(/},\s*{/g, '},{');
    
    try {
      const jsonData = JSON.parse(fixedData);
      console.log(`   ✓ Fixed and parsed ${jsonData.length.toLocaleString()} postal records`);
      return jsonData;
    } catch (e) {
      throw new Error(`JSON parse failed: ${e.message}`);
    }
  }
}

/**
 * Process postal data and extract unique entities
 */
function processPostalData(postalRecords) {
  console.log('\n🔄 Processing postal data...');
  
  const states = new Map();
  const districts = new Map();
  const cities = new Map();
  
  let processed = 0;
  const total = postalRecords.length;
  
  for (const record of postalRecords) {
    processed++;
    
    // Show progress every 10000 records
    if (processed % 10000 === 0) {
      const percent = ((processed / total) * 100).toFixed(1);
      console.log(`   📊 Processing... ${processed.toLocaleString()}/${total.toLocaleString()} (${percent}%)`);
    }
    
    // Extract state
    if (record.statename) {
      const stateName = record.statename.trim();
      const stateCode = record.statename.substring(0, 2).toUpperCase().replace(/\s+/g, '');
      
      if (!states.has(stateCode)) {
        states.set(stateCode, {
          name: stateName,
          code: stateCode,
          country: 'India',
          isActive: true
        });
      }
    }
    
    // Extract district  
    if (record.Districtname && record.statename) {
      const districtName = record.Districtname.trim();
      const stateName = record.statename.trim();
      const stateCode = record.statename.substring(0, 2).toUpperCase().replace(/\s+/g, '');
      const districtCode = districtName.substring(0, 3).toUpperCase().replace(/\s+/g, '');
      
      const key = `${stateCode}-${districtCode}`;
      if (!districts.has(key)) {
        districts.set(key, {
          name: districtName,
          stateId: stateCode,
          stateName: stateName,
          code: districtCode,
          isActive: true
        });
      }
    }
    
    // Extract city/taluk
    if (record.Taluk && record.Districtname && record.statename) {
      const cityName = record.Taluk.trim();
      const districtName = record.Districtname.trim();
      const stateName = record.statename.trim();
      const stateCode = record.statename.substring(0, 2).toUpperCase().replace(/\s+/g, '');
      const cityCode = cityName.substring(0, 3).toUpperCase().replace(/\s+/g, '');
      
      const key = `${stateCode}-${cityCode}`;
      if (!cities.has(key)) {
        cities.set(key, {
          name: cityName,
          state: stateName,
          district: districtName,
          code: cityCode,
          lat: 8 + Math.random() * 30, // Random coordinates in India (8-38N, 68-97E)
          lng: 68 + Math.random() * 29,
          isActive: true
        });
      }
    }
  }
  
  console.log(`   ✓ Processed ${processed.toLocaleString()} postal records`);
  
  // Convert maps to arrays and sort
  const statesArray = Array.from(states.values()).sort((a, b) => a.name.localeCompare(b.name));
  const districtsArray = Array.from(districts.values()).sort((a, b) => a.name.localeCompare(b.name));
  const citiesArray = Array.from(cities.values()).sort((a, b) => a.name.localeCompare(b.name));
  
  // Create a map to ensure we have at least one postal code per unique city
  const cityPostalCodes = new Map();
  
  // First, ensure we have at least one postal code for each unique city
  for (const record of postalRecords) {
    const cityName = record.Taluk || record.officename || 'Unknown';
    const stateName = record.statename || '';
    const key = `${cityName.toLowerCase()}_${stateName.toLowerCase()}`;
    
    // Only add if we don't already have a postal code for this city-state combination
    if (!cityPostalCodes.has(key)) {
      cityPostalCodes.set(key, {
        code: record.pincode.toString(),
        city: cityName,
        district: record.Districtname || '',
        state: stateName,
        isActive: true
      });
    }
  }
  
  // If we still have too many records, add more from the remaining records
  let postalCodesSample = Array.from(cityPostalCodes.values());
  
  if (postalCodesSample.length < 10000) {
    // Add additional records to diversify postal codes for cities that have many
    const additionalPostalCodes = [];
    const usedKeys = new Set();
    
    for (const record of postalRecords) {
      if (additionalPostalCodes.length >= 10000 - postalCodesSample.length) {
        break;
      }
      
      const cityName = record.Taluk || record.officename || 'Unknown';
      const stateName = record.statename || '';
      const key = `${cityName.toLowerCase()}_${stateName.toLowerCase()}_${record.pincode}`;
      
      if (!usedKeys.has(key)) {
        usedKeys.add(key);
        additionalPostalCodes.push({
          code: record.pincode.toString(),
          city: cityName,
          district: record.Districtname || '',
          state: stateName,
          isActive: true
        });
      }
    }
    
    postalCodesSample = [...postalCodesSample, ...additionalPostalCodes];
  } else if (postalCodesSample.length > 10000) {
    // If we have more than 10k, take the first 10k
    postalCodesSample = postalCodesSample.slice(0, 10000);
  }
  
  return {
    states: statesArray,
    districts: districtsArray,
    cities: citiesArray,
    postalCodes: postalCodesSample
  };
}

/**
 * Save data to JSON files
 */
function saveData(data) {
  console.log('\n💾 Saving converted data...');
  
  const files = [
    { name: 'states.json', data: data.states },
    { name: 'districts.json', data: data.districts },
    { name: 'cities.json', data: data.cities },
    { name: 'postal-codes.json', data: data.postalCodes }
  ];
  
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file.name);
    const jsonString = JSON.stringify(file.data, null, 2);
    
    fs.writeFileSync(filePath, jsonString, 'utf8');
    const sizeKB = Math.round(jsonString.length / 1024);
    console.log(`   ✓ ${file.name} (${file.data.length.toLocaleString()} records, ${sizeKB}KB)`);
  }
  
  // Create summary file
  const summary = {
    generated: new Date().toISOString(),
    source: '../all-india-pincode-json-array.json',
    sourceRecords: fs.statSync(INPUT_FILE).size,
    stats: {
      states: data.states.length,
      districts: data.districts.length,
      cities: data.cities.length,
      postalCodes: data.postalCodes.length
    }
  };
  
  const summaryPath = path.join(DATA_DIR, 'conversion-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`   ✓ conversion-summary.json`);
}

/**
 * Main function
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   All India Postal Code Data Converter               ║');
  console.log('║   Converts 53MB postal data to app-ready format     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  
  try {
    // Ensure directories exist
    ensureDir(DATA_DIR);
    
    // Check if input file exists
    if (!fs.existsSync(INPUT_FILE)) {
      throw new Error(`Input file not found: ${INPUT_FILE}`);
    }
    
    // Read and process data
    const postalRecords = await readLargeJsonFile(INPUT_FILE);
    
    // Process and extract entities
    const processedData = processPostalData(postalRecords);
    
    // Save processed data
    saveData(processedData);
    
    // Display summary
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║   Conversion Summary                                 ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(`\n📊 Converted from all-india-pincode-json-array.json:`);
    console.log(`   • Source Postal Records: ${postalRecords.length.toLocaleString()}`);
    console.log(`   • States:               ${processedData.states.length}`);
    console.log(`   • Districts:            ${processedData.districts.length}`);
    console.log(`   • Cities/Taluks:         ${processedData.cities.length}`);
    console.log(`   • Exported Postal Codes: ${processedData.postalCodes.length.toLocaleString()}`);
    console.log(`\n📁 Output directory: ${DATA_DIR}`);
    console.log('\n✅ Conversion completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Review generated JSON files');
    console.log('   2. Run seed script: npx prisma db seed');
    console.log('   3. For performance, you can limit postal codes by editing script');
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ Error converting postal data:', error.message);
    process.exit(1);
  }
}

// Run main function
main();