#!/usr/bin/env node

import { seedAttributes } from './prisma/seed-attributes.js';

console.log('Starting attribute seeder...');

seedAttributes()
  .then(() => {
    console.log('Attribute seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during attribute seeding:', error);
    process.exit(1);
  });