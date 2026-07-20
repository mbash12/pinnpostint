// Firebase configuration for Admin Panel
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAZatuNHiXfGjtt-zmXV6par7YFKnO2hWs",
  authDomain: "adposting-cef8e.firebaseapp.com",
  projectId: "adposting-cef8e",
  storageBucket: "adposting-cef8e.firebasestorage.app",
  messagingSenderId: "60856065114",
  appId: "1:60856065114:web:f9638cf99fd3f5a8f04c63",
  measurementId: "G-3141SQGXL3"
};

const VAPID_KEY = "BJWOPclQnjMtyh5U7xP5ROccb_HhAt4DjtEKUhuCKW7ngP1alFGWWk0y1P3AZwitYnzy_up5dG8WEfkif_G57tA";

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let messaging: Messaging | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

function isSupported(): boolean {
  const supported = (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    window.isSecureContext
  );

  return supported;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isSupported()) {
    return null;
  }
  if (swRegistration) {
    return swRegistration;
  }

  try {
    // Check for existing registrations
    const existingRegs = await navigator.serviceWorker.getRegistrations();

    // Unregister any old service workers
    for (const reg of existingRegs) {
      await reg.unregister();
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    swRegistration = registration;
    return registration;
  } catch (error) {
    return null;
  }
}

async function initializeMessaging(): Promise<{ messaging: Messaging | null; registration: ServiceWorkerRegistration | null }> {
  if (!isSupported()) {
    return { messaging: null, registration: null };
  }
  if (messaging && swRegistration) {
    return { messaging, registration: swRegistration };
  }

  try {
    const registration = await registerServiceWorker();
    if (!registration) {
      return { messaging: null, registration: null };
    }

    messaging = getMessaging(app);
    return { messaging, registration };
  } catch (error) {
    return { messaging: null, registration: null };
  }
}

export async function requestNotificationPermission(): Promise<string | null> {
  if (!isSupported()) {
    return null;
  }

  try {
    if (Notification.permission === 'denied') {
      return null;
    }

    const { messaging: msg, registration } = await initializeMessaging();

    if (!msg || !registration) {
      return null;
    }

    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return null;
      }
    }

    // Wait a bit for service worker to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get token with single attempt (no retry)
    try {
      const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
      console.log('FCM Token (Admin):', token);
      return token || null;
    } catch (err) {
      return null;
    }
  } catch (error) {
    return null;
  }
}

export function onMessageListener(
  callback: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void
): () => void {
  initializeMessaging().then(({ messaging: msg }) => {
    if (msg) {
      onMessage(msg, (payload) => {
        console.log('Push Received (Foreground - Admin):', payload);
        callback({
          notification: payload.notification,
          data: payload.data as Record<string, string> | undefined
        });
      });
    }
  });
  return () => {};
}

export function isPushNotificationSupported(): boolean {
  return isSupported();
}

export function getNotificationPermission(): NotificationPermission | null {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : null;
}

export { app, messaging, initializeMessaging, registerServiceWorker };
