const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create a temporary TypeScript file to generate the swagger spec
const tempTsFile = path.join(__dirname, 'temp-swagger-gen.ts');
const tempJsFile = path.join(__dirname, 'temp-swagger-gen.js');

const tsContent = `
import { swaggerSpec } from '../src/utils/swagger';
import * as fs from 'fs';
import * as path from 'path';

const outputPath = path.join(__dirname, '..', 'swagger.json');
fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));

console.log('✅ swagger.json has been generated successfully!');
console.log(\`📍 File saved to: \${outputPath}\`);
`;

fs.writeFileSync(tempTsFile, tsContent);

try {
  // Compile and run the TypeScript file
  execSync(`npx ts-node ${tempTsFile}`, { stdio: 'inherit' });
} catch (error) {
  console.error('Error generating swagger.json:', error.message);
  process.exit(1);
} finally {
  // Clean up temporary files
  if (fs.existsSync(tempTsFile)) {
    fs.unlinkSync(tempTsFile);
  }
  if (fs.existsSync(tempJsFile)) {
    fs.unlinkSync(tempJsFile);
  }
}