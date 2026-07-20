import * as fs from 'fs';
import * as path from 'path';

// Major states to extract
const MAJOR_STATES = [
  'MAHARASHTRA',
  'KARNATAKA',
  'DELHI',
  'TAMIL NADU',
  'GUJARAT',
  'WEST BENGAL',
  'UTTAR PRADESH',
  'RAJASTHAN',
  'TELANGANA',
  'KERALA',
  'MADHYA PRADESH',
  'HARYANA',
  'PUNJAB',
  'ANDHRA PRADESH',
  'BIHAR'
];

interface PincodeData {
  officename: string;
  pincode: number;
  officeType: string;
  Deliverystatus: string;
  divisionname: string;
  regionname: string;
  circlename: string;
  Taluk: string;
  Districtname: string;
  statename: string;
  Telephone: string;
  relatedSuboffice: string;
  relatedHeadoffice: string;
}

interface LocationData {
  state: string;
  district: string;
  city: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
}

async function extractMajorStatesData() {
  // Look for the file in the prisma directory (since you moved it there)
  const inputPath = path.join(__dirname, '../prisma/all-india-pincode-json-array.json');
  const outputPath = path.join(__dirname, '../prisma/major-states-locations.json');

  console.log('Reading pincode data...');
  const rawData = fs.readFileSync(inputPath, 'utf-8');
  const allData: PincodeData[] = JSON.parse(rawData);

  console.log(`Total records: ${allData.length}`);

  // Filter for major states
  const majorStatesData = allData.filter(item => 
    MAJOR_STATES.includes(item.statename.toUpperCase())
  );

  console.log(`Filtered records for major states: ${majorStatesData.length}`);

  // Transform and deduplicate
  const locationMap = new Map<string, LocationData>();

  majorStatesData.forEach(item => {
    const key = `${item.statename}-${item.Districtname}-${item.officename}-${item.pincode}`;
    
    if (!locationMap.has(key)) {
      locationMap.set(key, {
        state: item.statename,
        district: item.Districtname,
        city: item.officename.replace(/\s+(B\.O|S\.O|H\.O)$/i, '').trim(),
        pincode: item.pincode.toString()
      });
    }
  });

  const locations = Array.from(locationMap.values());

  console.log(`Unique locations: ${locations.length}`);

  // Group by state for statistics
  const stateStats = locations.reduce((acc, loc) => {
    acc[loc.state] = (acc[loc.state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nRecords per state:');
  Object.entries(stateStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([state, count]) => {
      console.log(`  ${state}: ${count}`);
    });

  // Write to file
  fs.writeFileSync(outputPath, JSON.stringify(locations, null, 2));
  console.log(`\nData written to: ${outputPath}`);
}

extractMajorStatesData().catch(console.error);
