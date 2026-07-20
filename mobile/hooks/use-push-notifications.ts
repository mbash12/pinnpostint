import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { userService } from '@/services/user.service';
import Constants from 'expo-constants';

// Type definitions for Notifications module
type NotificationsModule = typeof import('expo-notifications');

// Detect if running in Expo Go
// Constants.appOwnership is 'expo' in Expo Go, null in development/production builds
const isExpoGo = Constants.appOwnership === 'expo';


// Lazy-loaded module cache
let notificationsModule: NotificationsModule | null = null;
let moduleLoadAttempted = false;

// Import Firebase messaging for web
let requestPermission: any = null;
let onMessageListener: any = null;

if (Platform.OS === 'web') {
  try {
    const firebaseWeb = require('@/config/firebase.web');
    requestPermission = firebaseWeb.requestNotificationPermission;
    onMessageListener = firebaseWeb.onMessageListener;
  } catch (error) {
  }
}

// Lazy load expo-notifications - gracefully handles Expo Go
async function getNotificationsModule(): Promise<NotificationsModule | null> {
  // Return cached result if already attempted
  if (moduleLoadAttempted) {
    return notificationsModule;
  }
  
  moduleLoadAttempted = true;
  
  // Skip on web
  if (Platform.OS === 'web') {
    return null;
  }
  
  // In Expo Go, skip loading entirely (module will throw error)
  if (isExpoGo) {
    return null;
  }
  
  try {
    // This will only execute in development builds (not Expo Go)
    const mod = require('expo-notifications');
    notificationsModule = mod;
    
    // Set notification handler
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    
    return notificationsModule;
  } catch (error: any) {
    // Check if it's the Expo Go error
    if (error?.message?.includes('Expo Go') || error?.message?.includes('SDK 53')) {
      } else {
    }
    return null;
  }
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // For web platform, use Firebase Cloud Messaging
  if (Platform.OS === 'web' && requestPermission) {
    try {
      const token = await requestPermission();
      return token;
    } catch (error) {
      return null;
    }
  }

  // For native platforms, use Expo notifications
  const Notifications = await getNotificationsModule();
  
  if (!Notifications) {
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let token: string | null = null;
    if (Platform.OS === 'android') {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      token = deviceToken?.data ?? null;
    } else {
      const expoToken = await Notifications.getExpoPushTokenAsync();
      token = expoToken.data ?? null;
    }

    return token;
  } catch (error) {
    return null;
  }
}

/** FCM data is flat ({ type, adId, ... }); some callers may pass { type, data }. */
function normalizePushNavPayload(raw: any): { type: string; data: Record<string, any> } {
  if (!raw || typeof raw !== 'object') {
    return { type: '', data: {} };
  }
  if (raw.data != null && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
    return { type: String(raw.type ?? ''), data: raw.data as Record<string, any> };
  }
  const { type: t, ...rest } = raw;
  return { type: String(t ?? ''), data: rest as Record<string, any> };
}

async function openExternalUrlIfPossible(url: string): Promise<boolean> {
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return true;
    }
  } catch {
  }
  return false;
}

export function usePushNotifications() {
  const { isAuthenticated } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const router = useRouter();

  const handleNotificationClick = useCallback((notificationData: any) => {
    void (async () => {
      if (!notificationData) return;

      const { type, data } = normalizePushNavPayload(notificationData);

      switch (type) {
        case 'AD_APPROVED':
        case 'AD_REJECTED':
        case 'AD_REVIEW':
        case 'AD_EXTENDED':
        case 'AD_EXPIRED':
          if (data?.adId || data?.adSlug) {
            router.push(`/(pages)/ad-stats/${data.adSlug || data.adId}`);
          }
          break;

        case 'BOOKING':
        case 'BOOKING_UPDATE':
        case 'COMPLAINT':
          if (data?.bookingId) {
            const isOwner = data.isOwner === 'true' || data.isOwner === true;
            const page = isOwner ? 'ad-booking-detail' : 'booking-detail';
            router.push(`/(pages)/${page}?id=${data.bookingId}`);
          } else {
            router.push(`/(pages)/my-bookings`);
          }
          break;

        case 'PAYMENT':
          if (data?.type === 'subscription' && data?.adSlug) {
            router.push(`/(pages)/detail/${data.adSlug}`);
          } else if (data?.type === 'booking') {
            if (data?.bookingId) {
              router.push(`/(pages)/booking-detail?id=${data.bookingId}`);
            } else {
              router.push(`/(pages)/my-bookings`);
            }
          } else if (data?.deepLink) {
            router.push(data.deepLink);
          }
          break;

        case 'PROMOTION':
        case 'SYSTEM':
        case 'GENERAL': {
          const u = data?.url != null ? String(data.url).trim() : '';
          if (u && (await openExternalUrlIfPossible(u))) break;
          const d = data?.deepLink != null ? String(data.deepLink).trim() : '';
          if (d) {
            router.push(d);
            break;
          }
          router.push(`/(pages)/notifications`);
          break;
        }

        case 'SUBSCRIPTION_EXPIRY':
          if (data?.adId || data?.adSlug) {
            router.push(`/(pages)/detail/${data.adSlug || data.adId}`);
          } else {
            router.push(`/(pages)/settings`);
          }
          break;

        default:
          router.push(`/(pages)/notifications`);
          break;
      }
    })();
  }, [router]);

  useEffect(() => {
    // Skip on web (handled by useWebFcm)
    if (Platform.OS === 'web') {
      return;
    }
    
    // In Expo Go, don't even try to load
    if (isExpoGo) {
      return;
    }
    
    let mounted = true;
    
    // Register for push notifications
    (async () => {
      const t = await registerForPushNotificationsAsync();
      if (!mounted) return;
      setToken(t);
      
      if (t && isAuthenticated) {
        try {
          await userService.updateFcmToken(t);
        } catch (error) {
        }
      }
    })();

    return () => {
      mounted = false;
      if (notificationListener.current?.remove) {
        notificationListener.current.remove();
      }
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (Platform.OS === 'web' || isExpoGo) {
      return;
    }

    let cancelled = false;
    let subscription: { remove: () => void } | undefined;

    void (async () => {
      const Notifications = await getNotificationsModule();
      if (cancelled || !Notifications) return;
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const raw = response.notification.request.content.data;
        handleNotificationClick(raw);
      });
      responseListener.current = subscription;
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      responseListener.current = null;
    };
  }, [handleNotificationClick]);

  return { token };
}
