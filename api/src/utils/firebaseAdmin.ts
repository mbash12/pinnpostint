import admin, { ServiceAccount } from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import logger from './logger';

let messaging: admin.messaging.Messaging | null = null;
let isInitialized = false;

function normalizeWindowsPath(p: string): string {
  if (p.startsWith('/') && /^[A-Za-z]:/.test(p.slice(1))) return p.slice(1);
  return p;
}

/**
 * Initialize Firebase Admin SDK with service account credentials
 */
function initializeFirebaseAdmin(): boolean {
  if (isInitialized) return true;
  
  const servicePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!servicePath) {
    logger.warn('Firebase service account path not provided in environment variables');
    return false;
  }
  
  try {
    const normalized = normalizeWindowsPath(servicePath);
    const absolutePath = path.isAbsolute(normalized) ? normalized : path.resolve(normalized);
    
    // Try to read service account file
    if (!fs.existsSync(absolutePath)) {
      logger.error(`Firebase service account file not found at: ${absolutePath}`);
      return false;
    }
    
    const json = JSON.parse(fs.readFileSync(absolutePath, 'utf-8')) as ServiceAccount;
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(json),
        projectId: json.projectId,
      });
      logger.info('Firebase Admin SDK initialized successfully');
    }
    
    isInitialized = true;
    return true;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK:', error);
    return false;
  }
}

/**
 * Get Firebase Messaging instance
 */
export function getFirebaseMessaging(): admin.messaging.Messaging | null {
  if (messaging) return messaging;
  
  if (!initializeFirebaseAdmin()) {
    return null;
  }
  
  try {
    messaging = admin.messaging();
    return messaging;
  } catch (error) {
    logger.error('Failed to get Firebase Messaging instance:', error);
    return null;
  }
}

/**
 * Send push notification via Firebase Cloud Messaging
 */
export async function sendFCMNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  logger.info('FCM Send - Token:', token.substring(0, 50) + '...');
  logger.info('FCM Send - Title:', title);
  logger.info('FCM Send - Body:', body);
  logger.info('FCM Send - Data:', data);
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    logger.warn('FCM not available, cannot send notification');
    return false;
  }
  
  try {
    await messaging.send({
      token,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });
    
    logger.info(`FCM notification sent successfully to token: ${token.substring(0, 20)}...`);
    return true;
  } catch (error) {
    logger.error('Failed to send FCM notification:', error);
    
    // Check if token is invalid
    if (typeof error === 'object' && error && 'code' in error) {
      const errorCode = (error as any).code;
      if (errorCode === 'messaging/registration-token-not-registered') {
        logger.warn('FCM token is no longer valid, should be removed from database');
      }
    }
    
    return false;
  }
}

/**
 * Send multicast push notification to multiple tokens
 */
export async function sendMulticastNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return { success: 0, failure: tokens.length, invalidTokens: [] };
  }
  
  try {
    // Firebase Admin SDK v12+ uses sendEachForMulticast
    const messagePromises = tokens.map(async (token) => {
      try {
        await messaging.send({
          token,
          notification: {
            title,
            body,
          },
          data: data || {},
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
        });
        return { success: true, token, error: null };
      } catch (error) {
        logger.error(`Failed to send to token ${token.substring(0, 20)}...`, error);
        return { success: false, token, error };
      }
    });

    const results = await Promise.allSettled(messagePromises);
    
    let successCount = 0;
    let failureCount = 0;
    const invalidTokens: string[] = [];
    
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successCount++;
        } else {
          failureCount++;
          // Check if token is invalid
          if (result.value.error) {
            const errorCode = (result.value.error as any).code;
            if (errorCode === 'messaging/registration-token-not-registered') {
              invalidTokens.push(result.value.token);
            }
          }
        }
      } else {
        failureCount++;
      }
    });
    
    logger.info(`Multicast notification result: ${successCount} success, ${failureCount} failure`);
    
    return {
      success: successCount,
      failure: failureCount,
      invalidTokens
    };
  } catch (error) {
    logger.error('Failed to send multicast notification:', error);
    return { success: 0, failure: tokens.length, invalidTokens: [] };
  }
}
