import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { config } from '../config/environment';
import { prisma } from '../utils/database';

// Extend Socket type to include user data
declare module 'socket.io' {
  interface Socket {
    userId?: string;
    conversationRooms?: Set<string>;
  }
}

let io: SocketIOServer | null = null;

// Cache for conversation permissions to avoid repeated database queries
const conversationPermissionCache = new Map<string, { users: Set<string>, expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiting for typing events
const typingRateLimiter = new Map<string, number>();
const TYPING_COOLDOWN = 500; // 500ms between typing events

/**
 * Check if cached conversation permissions are valid
 */
function isCacheValid(conversationId: string): boolean {
  const cached = conversationPermissionCache.get(conversationId);
  if (!cached) return false;
  return Date.now() < cached.expiresAt;
}

/**
 * Get conversation users from cache or database
 */
async function getConversationUsers(conversationId: string): Promise<Set<string> | null> {
  // Check cache first
  if (isCacheValid(conversationId)) {
    return conversationPermissionCache.get(conversationId)!.users;
  }

  // Query database
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userAId: true, userBId: true }
  });

  if (!conversation) return null;

  const users = new Set([conversation.userAId, conversation.userBId]);

  // Cache with expiration
  conversationPermissionCache.set(conversationId, {
    users,
    expiresAt: Date.now() + CACHE_TTL
  });

  // Clean up expired cache entries periodically
  if (conversationPermissionCache.size > 1000) {
    const now = Date.now();
    for (const [id, data] of conversationPermissionCache.entries()) {
      if (now >= data.expiresAt) {
        conversationPermissionCache.delete(id);
      }
    }
  }

  return users;
}

/**
 * Clean up expired cache entries
 */
function cleanupExpiredCache(): void {
  const now = Date.now();
  for (const [id, data] of conversationPermissionCache.entries()) {
    if (now >= data.expiresAt) {
      conversationPermissionCache.delete(id);
    }
  }
}

/**
 * Initialize Socket.IO server
 */
export const initializeSocket = (httpServer: HTTPServer) => {
  if (io) {
    console.log('⚠️  Socket.IO already initialized');
    return io;
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // Allow all origins in development
      methods: ['GET', 'POST'],
      credentials: false,
    },
    pingTimeout: 20000,        // Reduced from 60000 to clean up dead connections faster
    pingInterval: 15000,       // Reduced from 25000
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e6,    // Limit message size to 1MB
    connectTimeout: 10000,     // Timeout connection attempts
    perMessageDeflate: {       // Enable compression to reduce bandwidth
      threshold: 1024,         // Only compress messages larger than 1KB
    },
  });

  // Authentication middleware
  io.use(async (socket: any, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Remove 'Bearer ' prefix if present
      const jwtToken = token.startsWith('Bearer ') ? token.slice(7) : token;

      // Verify JWT token
      const decoded = verify(jwtToken, config.auth.jwtSecret) as any;

      if (!decoded) {
        return next(new Error('Authentication error: Invalid token'));
      }

      // Handle different JWT payload structures
      const userId = decoded.id || decoded.userId || decoded.user_id;

      if (!userId) {
        return next(new Error('Authentication error: Invalid token'));
      }

      // Attach user ID to socket
      socket.userId = userId;
      socket.conversationRooms = new Set();

      next();
    } catch (error: any) {
      console.error('Socket authentication failed:', error.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket: any) => {
    console.log(`🔌 User connected: ${socket.userId}, Socket ID: ${socket.id}`);

    // Join a per-user room so server-side code can target a user's sockets
    // (e.g. conversation_updated events for the inbox list).
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Join conversation room
    socket.on('join_conversation', async (conversationId: string) => {
      try {
        // Check cache or database for conversation access
        const allowedUsers = await getConversationUsers(conversationId);

        if (!allowedUsers) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        if (allowedUsers.has(socket.userId)) {
          const roomName = `conversation:${conversationId}`;
          socket.join(roomName);
          socket.conversationRooms?.add(roomName);
          console.log(`📱 User ${socket.userId} joined conversation ${conversationId}`);
        } else {
          socket.emit('error', { message: 'Access denied to this conversation' });
        }
      } catch (error: any) {
        console.error('Error in join_conversation handler:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    // Leave conversation room
    socket.on('leave_conversation', (conversationId: string) => {
      try {
        const roomName = `conversation:${conversationId}`;
        socket.leave(roomName);
        socket.conversationRooms?.delete(roomName);
        console.log(`📤 User ${socket.userId} left conversation ${conversationId}`);
      } catch (error) {
        console.error('Error in leave_conversation handler:', error);
      }
    });

    // Handle typing indicator with rate limiting
    socket.on('typing_start', (data: { conversationId: string }) => {
      const key = `${socket.userId}_${data.conversationId}`;
      const now = Date.now();

      // Check rate limit
      if (typingRateLimiter.has(key)) {
        const lastTime = typingRateLimiter.get(key)!;
        if (now - lastTime < TYPING_COOLDOWN) {
          return; // Silently ignore rapid typing events
        }
      }

      typingRateLimiter.set(key, now);

      const roomName = `conversation:${data.conversationId}`;
      socket.to(roomName).emit('user_typing', {
        userId: socket.userId,
        conversationId: data.conversationId,
      });
    });

    socket.on('typing_stop', (data: { conversationId: string }) => {
      const roomName = `conversation:${data.conversationId}`;
      socket.to(roomName).emit('user_stopped_typing', {
        userId: socket.userId,
        conversationId: data.conversationId,
      });

      // Clean up rate limiter entry when typing stops
      const key = `${socket.userId}_${data.conversationId}`;
      typingRateLimiter.delete(key);
    });

    // Handle disconnect with proper cleanup
    socket.on('disconnect', (reason: string) => {
      // Clean up all rooms the user was in
      if (socket.conversationRooms && socket.conversationRooms.size > 0) {
        socket.conversationRooms.forEach(room => {
          socket.leave(room);
        });
        socket.conversationRooms.clear();
      }

      // Clean up any rate limiter entries for this user
      for (const key of typingRateLimiter.keys()) {
        if (key.startsWith(socket.userId + '_')) {
          typingRateLimiter.delete(key);
        }
      }

      console.log(`🔌 User disconnected: ${socket.userId}, Socket ID: ${socket.id}, Reason: ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  // Start monitoring and cleanup intervals
  startMonitoringAndCleanup();

  console.log('✅ Socket.IO server initialized');
  return io;
};

/**
 * Start monitoring and periodic cleanup
 */
function startMonitoringAndCleanup() {
  // Monitor connection count and memory usage every 5 minutes (was 1 min - too frequent)
  setInterval(() => {
    if (!io) return;

    const socketCount = io.sockets.sockets.size;
    const memory = process.memoryUsage();
    const heapUsedPercent = ((memory.heapUsed / memory.heapTotal) * 100).toFixed(2);

    // Only log if there are active connections or resource concerns
    if (socketCount > 0 || parseFloat(heapUsedPercent) > 70) {
      console.log(`📊 Socket Stats: connections=${socketCount}, heap=${heapUsedPercent}%, rss=${(memory.rss / 1024 / 1024).toFixed(0)}MB, cache=${conversationPermissionCache.size}`);
    }

    // Warn if resources are getting high
    if (socketCount > 500) {
      console.warn(`⚠️  High socket count: ${socketCount}`);
    }

    if (parseFloat(heapUsedPercent) > 80) {
      console.warn(`⚠️  High memory usage: ${heapUsedPercent}%`);
    }
  }, 300000); // Every 5 minutes

  // Clean up expired cache entries every 10 minutes (was 5 min)
  setInterval(() => {
    cleanupExpiredCache();
  }, 10 * 60 * 1000);
}

/**
 * Get Socket.IO instance
 */
export const getIO = (): SocketIOServer | null => {
  return io;
};

/**
 * Emit new message to conversation room
 */
export const emitNewMessage = (conversationId: string, message: any) => {
  if (!io) {
    console.warn('⚠️  Socket.IO not initialized');
    return;
  }

  const roomName = `conversation:${conversationId}`;
  io.to(roomName).emit('new_message', message);
  console.log(`📨 Message emitted to room ${roomName}`);
};

/**
 * Emit message read receipt
 */
export const emitMessageRead = (conversationId: string, messageIds: string[], userId: string) => {
  if (!io) {
    console.warn('⚠️  Socket.IO not initialized');
    return;
  }

  const roomName = `conversation:${conversationId}`;
  io.to(roomName).emit('messages_read', {
    conversationId,
    messageIds,
    userId,
    timestamp: new Date().toISOString(),
  });
  console.log(`✅ Read receipt emitted to room ${roomName}`);
};

/**
 * Emit conversation update (e.g., last message changed)
 */
export const emitConversationUpdate = (userId: string, conversation: any) => {
  if (!io) {
    console.warn('⚠️  Socket.IO not initialized');
    return;
  }

  // Target the per-user room joined on connect.
  io.to(`user:${userId}`).emit('conversation_updated', conversation);
  console.log(`🔄 Conversation update emitted to user ${userId}`);
};
