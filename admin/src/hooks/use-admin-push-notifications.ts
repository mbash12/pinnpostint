/**
 * Admin Push Notifications Hook
 * Handles Firebase Cloud Messaging for the admin panel
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  requestNotificationPermission,
  onMessageListener,
  isPushNotificationSupported,
  getNotificationPermission,
  registerServiceWorker
} from '@/lib/firebase';

export interface PushNotificationPayload {
  notification?: {
    title?: string;
    body?: string;
  };
  data?: {
    type?: string;
    [key: string]: string | undefined;
  };
}

export interface UseAdminPushNotificationsResult {
  isSupported: boolean;
  permission: NotificationPermission | null;
  fcmToken: string | null;
  isRegistering: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  unregisterToken: () => Promise<boolean>;
  lastNotification: PushNotificationPayload | null;
  dismissNotification: () => void;
}

// Store FCM token in localStorage key
const FCM_TOKEN_STORAGE_KEY = 'admin_fcm_token';

// Module-level state to prevent duplicate registrations across multiple hook instances
let globalIsRegistering = false;
let globalHasInitialized = false;
let globalLastRegisteredToken: string | null = null;

export function useAdminPushNotifications(
  isAuthenticated: boolean
): UseAdminPushNotificationsResult {
  const router = useRouter();
  const pathname = usePathname();
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<PushNotificationPayload | null>(null);
  const unsubscribers = useRef<(() => void)[]>([]);

  // Check if push notifications are supported
  const isSupported = isPushNotificationSupported();

  // Register FCM token with the backend only if it's different from the stored token
  const registerTokenWithBackend = useCallback(async (token: string) => {
    // Prevent duplicate in-flight requests globally
    if (globalIsRegistering) {
      return true;
    }

    // Skip if we've already registered this token in this session globally
    if (globalLastRegisteredToken === token) {
      return true;
    }

    // Get the currently stored token to compare
    const storedToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);

    // Only update if the token has changed
    if (storedToken === token) {
      globalLastRegisteredToken = token;
      return true;
    }

    globalIsRegistering = true;
    setIsRegistering(true);

    try {
      const response = await apiClient.put('/users/me/fcm-token', { fcmToken: token }, { skipLoading: true });

      if (response.success) {
        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
        globalLastRegisteredToken = token;
        return true;
      }
      return false;
    } catch (err) {
      return false;
    } finally {
      globalIsRegistering = false;
      setIsRegistering(false);
    }
  }, []);

  // Unregister FCM token from the backend
  const unregisterTokenFromBackend = useCallback(async (token: string) => {
    try {
      const response = await apiClient.delete('/users/me/fcm-token');
      return response.success;
    } catch (err) {
      return false;
    }
  }, []);

  // Request notification permission and register token
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Push notifications are not supported in this browser');
      return false;
    }

    setIsRegistering(true);
    setError(null);

    try {
      const token = await requestNotificationPermission();

      if (!token) {
        const perm = getNotificationPermission();
        setPermission(perm);
        if (perm === 'denied') {
          setError('Notification permission was denied. Please enable it in your browser settings.');
        } else {
          setError('Failed to get notification token. Please try again.');
        }
        setIsRegistering(false);
        return false;
      }

      setFcmToken(token);
      setPermission('granted');

      // Register with backend if authenticated
      if (isAuthenticated) {
        await registerTokenWithBackend(token);
      } else {
        // Skip backend registration if not authenticated
      }

      setIsRegistering(false);
      return true;
    } catch (err) {
      setError('Failed to enable push notifications');
      setIsRegistering(false);
      return false;
    }
  }, [isSupported, isAuthenticated, registerTokenWithBackend]);

  // Unregister token
  const unregisterToken = useCallback(async (): Promise<boolean> => {
    if (fcmToken) {
      await unregisterTokenFromBackend(fcmToken);
      localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
      setFcmToken(null);
    }
    return true;
  }, [fcmToken, unregisterTokenFromBackend]);

  // Initialize push notifications - runs only once on mount
  useEffect(() => {
    if (!isSupported) {
      return;
    }

    // Prevent duplicate initialization
    if (globalHasInitialized) {
      return;
    }
    globalHasInitialized = true;

    // Register service worker first (required for FCM)
    registerServiceWorker().then((registration) => {
      if (!registration) {
        return;
      }

      // Wait for service worker to be ready
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(() => {
          // Check current permission
          const currentPermission = getNotificationPermission();
          setPermission(currentPermission);

          // Request permission immediately if not yet determined
          if (currentPermission === 'default') {
            requestPermission();
          }

          // If permission is already granted, get token
          if (currentPermission === 'granted') {
            requestNotificationPermission().then((token) => {
              if (token) {
                setFcmToken(token);
                if (isAuthenticated) {
                  registerTokenWithBackend(token);
                }
              }
            });
          }
        });
      }
    });

    // Listen for foreground messages
    const unsubscribe = onMessageListener((payload) => {
      console.log('Push Received (Foreground - Admin Hook):', payload);
      setLastNotification(payload);

      // Show browser notification if not on the notifications page
      if (pathname !== '/dashboard/admin-notifications') {
        if (Notification.permission === 'granted') {
          const notification = new Notification(
            payload.notification?.title || 'New Notification',
            {
              body: payload.notification?.body || '',
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: 'admin-notification',
              requireInteraction: true,
              data: payload.data
            }
          );

          notification.onclick = () => {
            notification.close();
            window.focus();

            // Navigate based on notification type
            const type = payload.data?.type;
            const action = payload.data?.action;

            if (type === 'ADMIN_ALERT') {
              switch (action) {
                case 'review_ad':
                case 'review_flagged_ad':
                  router.push(`/dashboard/ad-moderation/${payload.data?.adId}`);
                  break;
                case 'view_booking':
                  router.push(`/dashboard/booking-management/${payload.data?.bookingId}`);
                  break;
                case 'view_payment':
                  router.push('/dashboard/payments');
                  break;
                case 'view_subscription':
                  router.push(`/dashboard/ad-management/ads/${payload.data?.adId}`);
                  break;
                default:
                  router.push('/dashboard/admin-notifications');
              }
            } else if (type === 'BOOKING' || type === 'BOOKING_UPDATE') {
              router.push(`/dashboard/booking-management/${payload.data?.bookingId}`);
            } else if (type === 'COMPLAINT') {
              if (payload.data?.bookingId) {
                router.push(`/dashboard/booking-management/${payload.data.bookingId}`);
              } else {
                router.push('/dashboard/admin-notifications');
              }
            } else {
              router.push('/dashboard/admin-notifications');
            }
          };
        }
      }
    });

    unsubscribers.current.push(unsubscribe);

    return () => {
      unsubscribers.current.forEach((unsub) => unsub());
      unsubscribers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Re-register token when authentication state changes from false to true
  const prevAuthRef = useRef(isAuthenticated);
  useEffect(() => {
    // Only register when auth state changes from false to true
    if (isAuthenticated && !prevAuthRef.current && fcmToken) {
      registerTokenWithBackend(fcmToken);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, fcmToken, registerTokenWithBackend]);

  // Listen for messages from service worker
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        const { url, data } = event.data;
        if (url) {
          router.push(url);
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [router]);

  // Dismiss the last notification
  const dismissNotification = useCallback(() => {
    setLastNotification(null);
  }, []);

  return {
    isSupported,
    permission,
    fcmToken,
    isRegistering,
    error,
    requestPermission,
    unregisterToken,
    lastNotification,
    dismissNotification
  };
}

export default useAdminPushNotifications;
