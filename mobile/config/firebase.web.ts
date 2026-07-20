import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAZatuNHiXfGjtt-zmXV6par7YFKnO2hWs",
  authDomain: "adposting-cef8e.firebaseapp.com",
  projectId: "adposting-cef8e",
  storageBucket: "adposting-cef8e.firebasestorage.app",
  messagingSenderId: "60856065114",
  appId: "1:60856065114:web:f9638cf99fd3f5a8f04c63",
  measurementId: "G-3141SQGXL3"
};

export const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;

// Initialize Firebase Cloud Messaging for web
let messaging: ReturnType<typeof getMessaging> | null = null;

try {
  if (typeof window !== "undefined") {
    messaging = getMessaging(app);
  }
} catch (error) {
}

export { messaging };

// Export FCM functions for web platform
export const requestNotificationPermission = async (): Promise<string | null> => {
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: "BJWOPclQnjMtyh5U7xP5ROccb_HhAt4DjtEKUhuCKW7ngP1alFGWWk0y1P3AZwitYnzy_up5dG8WEfkif_G57tA"
      });
      return token;
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const onMessageListener = () => {
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    // Handle foreground messages
    if (payload.notification) {
      const { title, body } = payload.notification;
      const data = payload.data || {};
      const type = data.type || 'GENERAL';
      
      // Determine the URL to open when notification is clicked
      let pathname = '/notifications';
      
      switch (type) {
        case 'AD_APPROVED':
        case 'AD_REJECTED':
          if (data.adId) {
            pathname = `/detail/${data.adSlug || data.adId}`;
          }
          break;
        
        case 'BOOKING':
        case 'BOOKING_UPDATE':
          if (data.bookingId) {
            // Navigate to the appropriate booking detail page based on user role
            const isOwner = data.isOwner === 'true' || data.isOwner === true;
            pathname = isOwner ? `/ad-booking-detail?id=${data.bookingId}` : `/booking-detail?id=${data.bookingId}`;
          } else {
            pathname = '/my-bookings';
          }
          break;
        
        case 'SUBSCRIPTION_EXPIRY':
          pathname = '/settings';
          break;
        
        case 'SYSTEM':
        case 'GENERAL':
        default:
          pathname = '/notifications';
          break;
      }
      
      // Create the notification
      const notification = new Notification(title || "New Notification", {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: {
          ...data,
          url: pathname
        },
        requireInteraction: true,
        tag: 'pinnpost-notification'
      });

      // Handle click on the notification
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();

        // Post message to the app for client-side navigation
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: pathname,
            data: data
          });
        } else {
          // Fallback to window location if service worker not ready
          window.location.href = pathname;
        }

        notification.close();
      };
    }
  });
};
