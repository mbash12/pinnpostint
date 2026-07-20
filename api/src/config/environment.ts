import dotenv from 'dotenv';
import Joi from 'joi';
import path from 'path';

// Per-app: only api/.env + api/.env.local (synced from root via ./pinn env:sync).
// Docker injects root .env into the container — skip files in production.
if (process.env.NODE_ENV !== 'production') {
  const apiDir = path.join(__dirname, '../..');
  dotenv.config({ path: path.join(apiDir, '.env') });
  dotenv.config({ path: path.join(apiDir, '.env.local'), override: true });
}

// Environment validation schema
const envSchema = Joi.object({
  // Server Configuration
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3001),
  API_VERSION: Joi.string().default('v1'),
  DEV_MODE: Joi.boolean().default(false),
  EXPIRED_NOTIFICATION_DEBUG: Joi.boolean().default(false),
  // Database Configuration
  DATABASE_URL: Joi.string().required(),
  DATABASE_URL_TEST: Joi.string().when('NODE_ENV', {
    is: 'test',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),

  // Authentication & Security
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // Redis Configuration
  REDIS_URL: Joi.string().uri().optional(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(null),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),

  // Background Job System Configuration
  JOB_QUEUE_ENABLED: Joi.boolean().default(true),
  JOB_CONCURRENCY: Joi.number().integer().min(1).default(5),
  JOB_MAX_ATTEMPTS: Joi.number().integer().min(1).default(3),


  // Payment Gateway (Razorpay)
  RAZORPAY_KEY_ID: Joi.string().optional(),
  RAZORPAY_KEY_SECRET: Joi.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().optional(),

  // SMS Provider (TechBeeHive HTTP API)
  SMS_BRAND: Joi.string().valid('pinnpost', 'inaipro').default('pinnpost'),
  SMS_PROVIDER: Joi.string().valid('techbeeshive').default('techbeeshive'),
  SMS_API_KEY: Joi.string().optional(),
  SMS_SENDER_ID: Joi.string().default('PNPOST'),
  SMS_BASE_URL: Joi.string().uri().default('http://sms.techbeeshive.com/vb/apikey.php'),
  SMS_FORMAT: Joi.string().valid('json', 'php').default('json'),
  SMS_UNICODE: Joi.boolean().default(false),
  SMS_USE_TEMPLATE_ID: Joi.boolean().default(true),
  SMS_DLT_TEMPLATE_ID: Joi.string().optional(),
  SMS_OTP_TEMPLATE_ID: Joi.string().optional(),
  SMS_AD_APPROVED_TEMPLATE_ID: Joi.string().optional(),
  SMS_AD_REJECTED_TEMPLATE_ID: Joi.string().optional(),
  SMS_AD_REVIEW_TEMPLATE_ID: Joi.string().optional(),
  SMS_AD_EXPIRED_TEMPLATE_ID: Joi.string().optional(),
  SMS_AD_EXTENDED_TEMPLATE_ID: Joi.string().optional(),
  SMS_AD_WILL_EXPIRE_TEMPLATE_ID: Joi.string().optional(),

  // Firebase Configuration
  FIREBASE_PROJECT_ID: Joi.string().optional(),
  FIREBASE_API_KEY: Joi.string().optional(),
  FIREBASE_AUTH_DOMAIN: Joi.string().optional(),
  FIREBASE_STORAGE_BUCKET: Joi.string().optional(),
  FIREBASE_MESSAGING_SENDER_ID: Joi.string().optional(),
  FIREBASE_APP_ID: Joi.string().optional(),
  FIREBASE_MEASUREMENT_ID: Joi.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: Joi.string().optional(),

  // File Upload Configuration
  UPLOAD_DIR: Joi.string().default('uploads'),
  MAX_FILE_SIZE: Joi.number().positive().default(5242880), // 5MB
  ALLOWED_IMAGE_TYPES: Joi.string().default('image/jpeg,image/png,image/webp,image/gif'),
  ALLOWED_DOCUMENT_TYPES: Joi.string().default('application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  MAX_IMAGES_PER_AD: Joi.number().positive().default(10),

  // API Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().positive().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().positive().default(100),

  // Testing Configuration
  TEST_OTP: Joi.string().optional(),
  TEST_JWT_SECRET: Joi.string().when('NODE_ENV', {
    is: 'test',
    then: Joi.string().default('test-jwt-secret-for-testing-only'),
    otherwise: Joi.forbidden()
  }),

  // Logging Configuration
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FILE: Joi.string().default('logs/app.log'),

  // CORS Configuration
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3001,http://localhost:3002,http://localhost:8081'),
  CORS_CREDENTIALS: Joi.boolean().default(false),

  // API Base URL for generating file URLs
  API_BASE_URL: Joi.string().uri().optional(),

  // Email Configuration (optional)
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().port().optional(),
  SMTP_USER: Joi.string().email().optional(),
  SMTP_PASS: Joi.string().optional(),
  FROM_EMAIL: Joi.string().email().optional(),
  FROM_NAME: Joi.string().optional(),
  GOOGLE_MAPS_API_KEY: Joi.string().optional(),
}).unknown(true);

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

// Export validated configuration
export const config = {
  // Server Configuration
  server: {
    nodeEnv: envVars.NODE_ENV,
    port: envVars.PORT,
    apiVersion: envVars.API_VERSION,
    devMode: envVars.DEV_MODE,
    expiredNotificationDebug: envVars.EXPIRED_NOTIFICATION_DEBUG,
  },

  // Database Configuration
  database: {
    url: envVars.DATABASE_URL,
    testUrl: envVars.DATABASE_URL_TEST,
  },

  // Authentication & Security
  auth: {
    jwtSecret: envVars.JWT_SECRET,
    jwtExpiresIn: envVars.JWT_EXPIRES_IN,
  },

  // Redis Configuration
  redis: {
    url: envVars.REDIS_URL,
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
    db: envVars.REDIS_DB,
  },

  // Background Job System Configuration
  jobs: {
    enabled: envVars.JOB_QUEUE_ENABLED,
    concurrency: envVars.JOB_CONCURRENCY,
    maxAttempts: envVars.JOB_MAX_ATTEMPTS,
  },

  // Payment Gateway

  // Razorpay
  razorpay: {
    keyId: envVars.RAZORPAY_KEY_ID,
    keySecret: envVars.RAZORPAY_KEY_SECRET,
    webhookSecret: envVars.RAZORPAY_WEBHOOK_SECRET,
  },

  // SMS/OTP Service
  sms: {
    brand: envVars.SMS_BRAND,
    provider: envVars.SMS_PROVIDER,
    apiKey: envVars.SMS_API_KEY,
    senderId: envVars.SMS_SENDER_ID,
    baseUrl: envVars.SMS_BASE_URL,
    format: envVars.SMS_FORMAT,
    unicode: envVars.SMS_UNICODE,
    useTemplateId: envVars.SMS_USE_TEMPLATE_ID,
    dltTemplateId: envVars.SMS_DLT_TEMPLATE_ID,
    otpTemplateId: envVars.SMS_OTP_TEMPLATE_ID,
    adApprovedTemplateId: envVars.SMS_AD_APPROVED_TEMPLATE_ID,
    adRejectedTemplateId: envVars.SMS_AD_REJECTED_TEMPLATE_ID,
    adReviewTemplateId: envVars.SMS_AD_REVIEW_TEMPLATE_ID,
    adExpiredTemplateId: envVars.SMS_AD_EXPIRED_TEMPLATE_ID,
    adExtendedTemplateId: envVars.SMS_AD_EXTENDED_TEMPLATE_ID,
    adWillExpireTemplateId: envVars.SMS_AD_WILL_EXPIRE_TEMPLATE_ID,
  },

  // Firebase Configuration
  firebase: {
    projectId: envVars.FIREBASE_PROJECT_ID,
    apiKey: envVars.FIREBASE_API_KEY,
    authDomain: envVars.FIREBASE_AUTH_DOMAIN,
    storageBucket: envVars.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: envVars.FIREBASE_MESSAGING_SENDER_ID,
    appId: envVars.FIREBASE_APP_ID,
    measurementId: envVars.FIREBASE_MEASUREMENT_ID,
    serviceAccountPath: envVars.FIREBASE_SERVICE_ACCOUNT_PATH,
  },

  // File Upload Configuration
  upload: {
    dir: envVars.UPLOAD_DIR,
    maxFileSize: envVars.MAX_FILE_SIZE,
    allowedImageTypes: envVars.ALLOWED_IMAGE_TYPES.split(','),
    allowedDocumentTypes: envVars.ALLOWED_DOCUMENT_TYPES.split(','),
    maxImagesPerAd: envVars.MAX_IMAGES_PER_AD,
  },

  // API Rate Limiting
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
  },

  // Testing Configuration
  testing: {
    testOtp: envVars.TEST_OTP,
    testJwtSecret: envVars.TEST_JWT_SECRET,
  },

  // Logging Configuration
  logging: {
    level: envVars.LOG_LEVEL,
    file: envVars.LOG_FILE,
  },

  // CORS Configuration
  cors: {
    allowedOrigins: envVars.ALLOWED_ORIGINS.split(','),
    credentials: envVars.CORS_CREDENTIALS,
  },

  // API Base URL for generating file URLs
  apiBaseUrl: envVars.API_BASE_URL,

  // Email Configuration
  email: {
    smtpHost: envVars.SMTP_HOST,
    smtpPort: envVars.SMTP_PORT,
    smtpUser: envVars.SMTP_USER,
    smtpPass: envVars.SMTP_PASS,
    fromEmail: envVars.FROM_EMAIL,
    fromName: envVars.FROM_NAME,
  },

  // Google Maps Configuration
  googleMaps: {
    apiKey: envVars.GOOGLE_MAPS_API_KEY,
  },
};

// Helper function to check if we're in development
export const isDevelopment = () => config.server.nodeEnv === 'development';

// Helper function to check if we're in production
export const isProduction = () => config.server.nodeEnv === 'production';

// Helper function to check if we're in test
export const isTest = () => config.server.nodeEnv === 'test';

// Helper function to get database URL based on environment
export const getDatabaseUrl = () => {
  return isTest() ? config.database.testUrl : config.database.url;
};

// Helper function to get JWT secret based on environment
export const getJwtSecret = () => {
  return isTest() ? config.testing.testJwtSecret : config.auth.jwtSecret;
};

// Helper function to check if DEV_MODE is enabled
export const isDevMode = () => config.server.devMode;

export default config;
