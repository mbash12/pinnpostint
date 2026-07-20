#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

const ENV_FILES = [
  '.env',
  '.env.local',
  'api/.env',
  'api/.env.development',
  'api/.env.production',
  'api/pinnpost-firebase-service-account.json',
  'admin/.env.development',
  'admin/.env.production',
  'mobile/.env.development',
  'mobile/.env.production',
];

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha256');
}

function encrypt(text, password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]);
  const header = Buffer.from('ENV_ENC:', 'utf8');
  return Buffer.concat([header, combined]).toString('base64');
}

function decrypt(encryptedData, password) {
  const combined = Buffer.from(encryptedData.trim(), 'base64');
  const header = combined.slice(0, 8).toString('utf8');
  if (header !== 'ENV_ENC:') {
    throw new Error('File does not appear to be encrypted');
  }
  const data = combined.slice(8);
  const salt = data.slice(0, SALT_LENGTH);
  const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = data.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = data.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH).toString('hex');
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function isEncrypted(content) {
  try {
    const decoded = Buffer.from(content.trim(), 'base64');
    const header = decoded.slice(0, 8).toString('utf8');
    return header === 'ENV_ENC:';
  } catch {
    return false;
  }
}

function encryptFile(filePath, password) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipped: ${filePath} (not found)`);
    return false;
  }
  console.log(`🔒 ${filePath}`);
  const content = fs.readFileSync(fullPath, 'utf8');
  if (isEncrypted(content)) {
    console.log(`   Already encrypted`);
    return false;
  }
  const encrypted = encrypt(content, password);
  fs.writeFileSync(fullPath, encrypted, 'utf8');
  return true;
}

function decryptFile(filePath, password) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipped: ${filePath} (not found)`);
    return false;
  }
  console.log(`🔓 ${filePath}`);
  const content = fs.readFileSync(fullPath, 'utf8');
  if (!isEncrypted(content)) {
    console.log(`   Not encrypted`);
    return false;
  }
  const decrypted = decrypt(content, password);
  fs.writeFileSync(fullPath, decrypted, 'utf8');
  return true;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log(`
Usage:
  node scripts/env-crypto.js encrypt [password] [file]
  node scripts/env-crypto.js decrypt [password] [file]

Examples:
  node scripts/env-crypto.js encrypt mypassword
  node scripts/env-crypto.js decrypt mypassword
  node scripts/env-crypto.js encrypt mypassword .env
    `);
    process.exit(1);
  }

  const command = args[0];
  const password = args[1];
  const specificFile = args[2];

  if (!password || (command !== 'encrypt' && command !== 'decrypt')) {
    console.log('Invalid command');
    process.exit(1);
  }

  const filesToProcess = specificFile ? [specificFile] : ENV_FILES;
  let count = 0;

  console.log(`\n${command === 'encrypt' ? '🔒 Encrypting' : '🔓 Decrypting'}...\n`);

  for (const file of filesToProcess) {
    if (command === 'encrypt') {
      if (encryptFile(file, password)) count++;
    } else {
      if (decryptFile(file, password)) count++;
    }
  }

  console.log(`\n✅ Done: ${count} files\n`);
}

main();
