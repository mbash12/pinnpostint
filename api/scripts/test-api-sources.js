#!/usr/bin/env node

/**
 * API Source Research and Testing Script
 * 
 * Tests various API sources for Indian location data
 * and ranks them by reliability and data quality.
 */

const https = require('https');
const http = require('http');

/**
 * Helper function to fetch data from URL with timeout
 */
function testUrl(url, timeout = 10000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const startTime = Date.now();
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        try {
          const parsed = JSON.parse(data);
          resolve({
            url,
            success: true,
            statusCode: res.statusCode,
            responseTime,
            dataSize: data.length,
            data: parsed,
            message: 'Success'
          });
        } catch (e) {
          resolve({
            url,
            success: false,
            statusCode: res.statusCode,
            responseTime: Date.now() - startTime,
            message: `JSON parse error: ${e.message}`
          });
        }
      });
    });
    
    req.on('error', (error) => {
      resolve({
        url,
        success: false,
        responseTime: Date.now() - startTime,
        message: `Network error: ${error.message}`
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        url,
        success: false,
        responseTime: timeout,
        message: 'Request timeout'
      });
    });
    
    req.setTimeout(timeout);
  });
}

async function testApiSources() {
  console.log('🔍 Testing API Sources for Indian Location Data\n');
  
  // API sources to test for different data types
  const sources = {
    states: [
      {
        name: 'REST Countries API',
        url: 'https://restcountries.com/v3.1/alpha/IN',
        testPath: 'subdivisions',
        expectedField: 'name'
      },
      {
        name: 'OpenDataSoft Countries',
        url: 'https://public.opendatasoft.com/api/records/1.0/search/?dataset=geonames-country-info&q=India&rows=50',
        testPath: 'records[0].fields.subdivisions',
        expectedField: null
      }
    ],
    cities: [
      {
        name: 'Geonames API (demo)',
        url: 'http://api.geonames.org/searchJSON?country=IN&featureClass=P&minPopulation=1000000&maxRows=10&username=demo',
        testPath: 'geonames',
        expectedField: 'name'
      },
      {
        name: 'Google Maps Geocoding',
        url: `https://maps.googleapis.com/maps/api/geocode/json?address=Mumbai,India&key=${process.env.GOOGLE_MAPS_API_KEY}`,
        testPath: null,
        expectedField: 'display_name'
      },
      {
        name: 'Geonames API (alt)',
        url: 'https://secure.geonames.org/searchJSON?country=IN&featureClass=P&minPopulation=1000000&maxRows=10&username=demo',
        testPath: 'geonames',
        expectedField: 'name'
      }
    ],
    postalCodes: [
      {
        name: 'IndiaPost API - City Search',
        url: 'https://api.postalpincode.in/postoffice/bycity/Mumbai',
        testPath: '[0].PostOffice',
        expectedField: 'Pincode'
      },
      {
        name: 'IndiaPost API - State Search',
        url: 'https://api.postalpincode.in/postoffice/pb/patiala',
        testPath: 'PostOffice',
        expectedField: 'Pincode'
      },
      {
        name: 'Data.gov.in API',
        url: 'https://api.data.gov.in/v2/catalog/records?limit=10&offset=0&format=json&filters[domain][in]=india.gov.in',
        testPath: 'records',
        expectedField: null
      }
    ]
  };
  
  const results = {};
  
  for (const [dataType, apiList] of Object.entries(sources)) {
    console.log(`\n📍 Testing ${dataType.toUpperCase()} APIs...\n`);
    results[dataType] = [];
    
    for (const api of apiList) {
      console.log(`🔗 Testing: ${api.name}`);
      console.log(`   URL: ${api.url}`);
      
      const result = await testUrl(api.url);
      
      // Add API info to result
      result.name = api.name;
      result.dataType = dataType;
      result.testPath = api.testPath;
      result.expectedField = api.expectedField;
      
      // Test data structure if success
      if (result.success && api.testPath) {
        try {
          const pathParts = api.testPath.split('.');
          let currentData = result.data;
          
          for (const part of pathParts) {
            const indexMatch = part.match(/\\[(\\d+)\\]/);
            if (indexMatch) {
              const index = parseInt(indexMatch[1]);
              const arrayPart = part.replace(indexMatch[0], '');
              currentData = currentData[arrayPart][index];
            } else {
              currentData = currentData[part];
            }
          }
          
          if (Array.isArray(currentData)) {
            result.dataCount = currentData.length;
            if (api.expectedField && currentData.length > 0) {
              result.hasExpectedField = currentData[0].hasOwnProperty(api.expectedField);
            }
            result.dataStructureValid = true;
          } else {
            result.dataStructureValid = false;
            result.message = `Expected array at ${api.testPath}`;
          }
        } catch (e) {
          result.dataStructureValid = false;
          result.message = `Path test failed: ${e.message}`;
        }
      } else if (result.success) {
        result.dataCount = Array.isArray(result.data) ? result.data.length : 1;
        result.dataStructureValid = true;
      }
      
      results[dataType].push(result);
      
      // Show result
      if (result.success) {
        console.log(`   ✅ Success (${result.responseTime}ms, ${result.statusCode})`);
        console.log(`      Data: ${result.dataCount} records`);
        if (result.dataStructureValid) {
          console.log(`      Structure: Valid ✓`);
        } else {
          console.log(`      Structure: Invalid ✗ (${result.message})`);
        }
      } else {
        console.log(`   ❌ Failed: ${result.message}`);
        if (result.statusCode) {
          console.log(`      Status: ${result.statusCode}`);
        }
      }
      console.log('');
    }
  }
  
  // Rank APIs for each data type
  console.log('🏆 API Rankings (by reliability and data quality):\n');
  
  for (const [dataType, apiResults] of Object.entries(results)) {
    console.log(`\n📍 ${dataType.toUpperCase()} Rankings:`);
    
    // Calculate scores
    const scored = apiResults.map(api => {
      let score = 0;
      let details = '';
      
      // Success score
      if (api.success) {
        score += 50;
        details += 'Success: +50; ';
      }
      
      // Data structure score
      if (api.dataStructureValid) {
        score += 30;
        details += 'Structure: +30; ';
      }
      
      // Response time score (faster is better)
      if (api.responseTime) {
        if (api.responseTime < 1000) {
          score += 20;
          details += 'Fast: +20; ';
        } else if (api.responseTime < 3000) {
          score += 10;
          details += 'Medium: +10; ';
        } else {
          details += 'Slow: +0; ';
        }
      }
      
      // Data amount score
      if (api.dataCount > 0) {
        if (api.dataCount > 100) {
          score += 10;
          details += 'Large: +10; ';
        } else if (api.dataCount > 10) {
          score += 5;
          details += 'Medium: +5; ';
        } else {
          details += 'Small: +0; ';
        }
      }
      
      return {
        ...api,
        score,
        scoreDetails: details.trim()
      };
    });
    
    // Sort by score
    scored.sort((a, b) => b.score - a.score);
    
    // Display rankings
    scored.forEach((api, index) => {
      console.log(`${index + 1}. ${api.name}`);
      if (api.success) {
        console.log(`   Score: ${api.score}/100`);
        console.log(`   Details: ${api.scoreDetails}`);
        console.log(`   Response: ${api.responseTime}ms`);
        console.log(`   Records: ${api.dataCount}`);
      } else {
        console.log(`   Status: FAILED - ${api.message}`);
      }
      console.log('');
    });
  }
  
  // Save results
  const outputPath = './api-source-test-results.json';
  require('fs').writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`💾 Test results saved to: ${outputPath}`);
  
  return results;
}

// Run the tests
testApiSources().catch(console.error);