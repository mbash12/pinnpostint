import express, { Application, Request, Response, NextFunction } from 'express';
import v8 from 'v8';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './utils/swagger';
import { config } from './config/environment';
import { initializeSocket } from './socket/socket';
import { checkDatabaseHealth } from './utils/database';
import {
  getRedisConnection,
  getSchedulerHeartbeatAgeMs,
  isSchedulerHeartbeatHealthy,
} from './background/utils/redis-connection';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { requestTimeout, requestTiming } from './middleware/timeout';

// Import routes
import adminSettingsRoutes from './routes/adminSettings';
import adminPlatformAdsRoutes from './routes/adminPlatformAds';
import adminLocationsRoutes from './routes/adminLocations';
import adminGranularLocationsRoutes from './routes/adminGranularLocations';
import adminCategoriesRoutes from './routes/adminCategories';
import adminAttributesRoutes from './routes/adminAttributes';
import adminAdRoutes from './routes/adminAds';
import adminUsersRoutes from './routes/adminUsers';
import adminAnalyticsRoutes from './routes/adminAnalytics';
import authRoutes from './routes/auth';
import adminAuthRoutes from './routes/adminAuth';
import otpRoutes from './routes/otp';
import userRoutes from './routes/user';
import adRoutes from './routes/ads';
import publicRoutes from './routes/public';
import paymentRoutes from './routes/payments';
import bookingRoutes from './routes/bookings';
import notificationRoutes from './routes/notifications';
import adminNotificationsRoutes from './routes/adminNotifications';
import adminSmsOutboxRoutes from './routes/adminSmsOutbox';
import blogRoutes from './routes/blog';
import blogCategoryRoutes from './routes/blogCategories';
import faqRoutes from './routes/faqs';
import adminFaqCategoriesRoutes from './routes/adminFaqCategories';
import landingPagesRoutes from './routes/landingPages';
import publicLandingPagesRoutes from './routes/publicLandingPages';
import bulkOperationsRoutes from './routes/bulkOperations';
import uploadRoutes from './routes/upload';
import monitoringRoutes from './routes/monitoring';
import jobManagementRoutes from './routes/jobManagement';
import legalDocumentsRoutes from './routes/legalDocuments';
import userRecentLocationsRoutes from './routes/userRecentLocations';
import pushTokenRoutes from './routes/pushTokens';
import complaintRoutes from './routes/complaints';
import transferRoutes from './routes/transfers';
import chatRoutes from './routes/chat';

// Import background system
import { initializeJobQueue, initializeScheduler, shutdownJobQueue } from './background/utils/initialization';

// Import middleware
import { adminAuth } from './middleware/auth';

class App {
  public app: Application;
  private server: any;
  private backgroundSystemInitialized: boolean = false;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.initializeMiddlewares();
    this.initializeSwagger();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware - but allow CORS for public API
    this.app.use(helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false // Disable CSP to allow any origin
    }));

    // CORS configuration - allow access from anywhere
    this.app.use(cors({
      origin: '*', // Allow all origins
      credentials: false, // No credentials needed for public API
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Include OPTIONS
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Platform'],
      exposedHeaders: ['Content-Length', 'X-Total-Count'],
      maxAge: 86400 // Cache preflight requests for 24 hours
    }));

    // Additional CORS headers as fallback
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Platform');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Total-Count');
      res.setHeader('Access-Control-Max-Age', '86400');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request timing middleware - only in development (morgan handles production logging)
    if (config.server.nodeEnv === 'development') {
      this.app.use(requestTiming);
    }
    this.app.use(requestTimeout(config.server.nodeEnv === 'production' ? 60000 : 120000));

    // Body parsing middleware with improved error handling
    this.app.use(express.json({
      limit: '10mb',
      strict: true,
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static file serving for uploads
    this.app.use('/uploads', express.static('uploads'));

    // Static file serving for public assets
    this.app.use('/public', express.static('public'));

    // Also serve public assets at /api/v1/public for API consistency
    this.app.use('/api/v1/public', express.static('public'));

    // Also serve uploads at /api/v1/uploads for API consistency
    this.app.use('/api/v1/uploads', express.static('uploads'));

    // Logging middleware
    if (!config.server.nodeEnv || config.server.nodeEnv !== 'test') {
      this.app.use(morgan(config.server.nodeEnv === 'production' ? 'short' : 'combined', {
        skip: (req: Request, res: Response) => req.path === '/health' || req.path === '/health/ready'
      }));
    }

    // Health check endpoint with detailed system status
    this.app.get('/health', async (req: Request, res: Response) => {
      const memoryUsage = process.memoryUsage();
      const heapStats = v8.getHeapStatistics();
      const healthStatus = {
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: config.server.nodeEnv,
        version: config.server.apiVersion,
        uptime: process.uptime(),
        memory: {
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(heapStats.heap_size_limit / 1024 / 1024).toFixed(2)} MB`,
          usage: `${((memoryUsage.heapUsed / heapStats.heap_size_limit) * 100).toFixed(2)}%`,
        },
      };
      res.status(200).json(healthStatus);
    });

    // Readiness: used by Docker healthcheck. Must fail when DB is unreachable
    // so a "zombie" API (process up, DB dead) becomes unhealthy and can be healed.
    this.app.get('/health/ready', async (req: Request, res: Response) => {
      const memoryUsage = process.memoryUsage();
      const heapStats = v8.getHeapStatistics();
      const heapUsageRatio = memoryUsage.heapUsed / heapStats.heap_size_limit;

      const isMemoryOk = heapUsageRatio < 0.9;
      const isDbOk = await checkDatabaseHealth({ silent: true });

      let isRedisOk = false;
      try {
        const redis = getRedisConnection();
        if (redis && redis.isOpen) {
          await Promise.race([
            redis.ping(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Redis ping timeout')), 2000)
            ),
          ]);
          isRedisOk = true;
        }
      } catch {
        isRedisOk = false;
      }

      // Scheduler liveness: the sms-outbox-drain cron writes a heartbeat every
      // minute. If it has gone stale for longer than the configured threshold
      // the Bull scheduler is wedged (e.g. a Redis READONLY blip that the
      // process never recovered from). We fail readiness so the watchdog
      // recreates the container instead of serving traffic with dead crons.
      // We apply a 5-minute warmup grace so a fresh boot isn't marked unhealthy
      // before the first drain tick lands.
      let isSchedulerOk = true;
      let schedulerHeartbeatAgeMs: number | null = null;
      // process.uptime() returns SECONDS. Warmup grace = 5 minutes.
      if (process.uptime() > 5 * 60) {
        try {
          schedulerHeartbeatAgeMs = await getSchedulerHeartbeatAgeMs();
          isSchedulerOk = isSchedulerHeartbeatHealthy(
            schedulerHeartbeatAgeMs,
            process.uptime(),
          );
        } catch {
          isSchedulerOk = false;
        }
      }

      // Redis is a hard dependency for Bull. Docker already requires three
      // consecutive failures before declaring the API unhealthy, so making it
      // a readiness gate catches a broken queue without reacting to one ping.
      const success = isMemoryOk && isDbOk && isRedisOk && isSchedulerOk;

      const healthStatus = {
        success,
        timestamp: new Date().toISOString(),
        environment: config.server.nodeEnv,
        version: config.server.apiVersion,
        uptime: process.uptime(),
        checks: {
          memory: {
            ok: isMemoryOk,
            usage: `${(heapUsageRatio * 100).toFixed(2)}%`,
          },
          database: { ok: isDbOk },
          redis: { ok: isRedisOk },
          scheduler: {
            ok: isSchedulerOk,
            heartbeatAgeMs: schedulerHeartbeatAgeMs,
          },
        },
        memory: {
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(heapStats.heap_size_limit / 1024 / 1024).toFixed(2)} MB`,
        },
      };

      res.status(success ? 200 : 503).json(healthStatus);
    });
  }

  private initializeSwagger(): void {
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Pin N Post API Documentation'
    }));

    // Add endpoint to export Swagger JSON
    this.app.get('/api-docs.json', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });
  }

  private initializeRoutes(): void {
    // Authentication routes (no auth required)
    this.app.use('/api/v1/auth', authRoutes);
    this.app.use('/api/v1/auth', adminAuthRoutes);
    this.app.use('/api/v1', adminAuthRoutes);

    // OTP routes (public)
    this.app.use('/api/v1/otp', otpRoutes);

    // Admin routes
    this.app.use('/api/v1/admin/settings', adminAuth, adminSettingsRoutes);
    this.app.use('/api/v1/admin/platform-ads', adminAuth, adminPlatformAdsRoutes);
    this.app.use('/api/v1/admin/locations', adminAuth, adminLocationsRoutes);
    this.app.use('/api/v1/admin/granular-locations', adminAuth, adminGranularLocationsRoutes);
    this.app.use('/api/v1/admin/categories', adminAuth, adminCategoriesRoutes);
    this.app.use('/api/v1/admin', adminAuth, adminAttributesRoutes);
    this.app.use('/api/v1/admin/analytics', adminAuth, adminAnalyticsRoutes);
    this.app.use('/api/v1/admin/bulk-operations', bulkOperationsRoutes);
    this.app.use('/api/v1/admin', adminAdRoutes);
    this.app.use('/api/v1/admin', adminUsersRoutes);

    // Background job monitoring and management routes
    this.app.use('/api/v1/admin/monitoring', adminAuth, monitoringRoutes);
    this.app.use('/api/v1/admin', adminAuth, jobManagementRoutes);

    // User routes (authentication required)
    this.app.use('/api/v1/users', userRoutes);
    this.app.use('/api/v1/users', adRoutes);
    this.app.use('/api/v1/user', userRecentLocationsRoutes);
    this.app.use('/api/v1/push-tokens', pushTokenRoutes);

    // Payment and subscription routes
    this.app.use('/api/v1', paymentRoutes);

    // Booking routes
    this.app.use('/api/v1', bookingRoutes);

    // Complaint routes
    this.app.use('/api/v1', complaintRoutes);

    // Chat routes
    this.app.use('/api/v1/chat', chatRoutes);

    // Transfer routes
    this.app.use('/api/v1', transferRoutes);

    // Notification routes
    this.app.use('/api/v1/notifications', notificationRoutes);
    this.app.use('/api/v1/admin/notifications', adminAuth, adminNotificationsRoutes);

    // SMS outbox monitor (admin) — gated by ADMIN_SMS_OUTBOX_MONITORING_ENABLED
    this.app.use('/api/v1/admin/sms-outbox', adminAuth, adminSmsOutboxRoutes);

    // Blog routes
    this.app.use('/api/v1', blogRoutes);
    this.app.use('/api/v1', blogCategoryRoutes);

    // FAQ routes
    this.app.use('/api/v1', faqRoutes);
    this.app.use('/api/v1/admin/faq-categories', adminAuth, adminFaqCategoriesRoutes);

    // Landing pages routes
    this.app.use('/api/v1', landingPagesRoutes);
    this.app.use('/api/v1', publicLandingPagesRoutes);

    // Upload routes (authentication required)
    this.app.use('/api/v1/upload', uploadRoutes);

    // Public routes (no authentication required)
    this.app.use('/api/v1/public', publicRoutes);
    this.app.use('/api/v1/legal-documents', legalDocumentsRoutes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        message: 'Welcome to Pin N Post API',
        version: '1.0.0',
        documentation: '/api-docs'
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFound);

    // Global error handler
    this.app.use(errorHandler);
  }

  public async listen(): Promise<void> {
    const port = config.server.port;

    // Initialize background system before starting server
    await this.initializeBackgroundSystem();

    // Initialize Socket.IO
    initializeSocket(this.server);

    this.server.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`📚 API Documentation available at http://localhost:${port}/api-docs`);
      console.log(`🏥 Health check available at http://localhost:${port}/health`);
      console.log(`🌍 Environment: ${config.server.nodeEnv}`);
      console.log(`📦 API Version: ${config.server.apiVersion}`);
      console.log(`🔌 Socket.IO initialized`);
      if (this.backgroundSystemInitialized) {
        console.log(`⚙️  Background job system initialized`);
      }
    });
  }

  private async initializeBackgroundSystem(): Promise<void> {
    try {
      // Skip background system initialization in test environment
      if (config.server.nodeEnv === 'test') {
        console.log('⏭️  Skipping background system initialization in test environment');
        return;
      }

      // Check if background job system is enabled
      if (!config.jobs.enabled) {
        console.log('⏭️  Background job system is disabled');
        return;
      }

      console.log('🔄 Initializing background job system...');

      // Initialize job queue and scheduler
      await initializeJobQueue();
      await initializeScheduler();

      this.backgroundSystemInitialized = true;
      console.log('✅ Background job system initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize background system:', error);
      // Don't throw error to prevent server startup failure
      // Background system can be initialized later if needed
    }
  }

  public async shutdown(): Promise<void> {
    try {
      if (this.backgroundSystemInitialized) {
        console.log('🔄 Shutting down background job system...');
        await shutdownJobQueue();
        console.log('✅ Background job system shut down successfully');
      }
    } catch (error) {
      console.error('❌ Error shutting down background system:', error);
    }
  }
}

export default App;
