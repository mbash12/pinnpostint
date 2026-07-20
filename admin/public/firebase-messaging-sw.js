// Firebase Cloud Messaging Service Worker for Admin Panel
// This file must be in the public directory to work as a service worker

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration (same as in firebase.ts)
const firebaseConfig = {
  apiKey: "AIzaSyAZatuNHiXfGjtt-zmXV6par7YFKnO2hWs",
  authDomain: "adposting-cef8e.firebaseapp.com",
  projectId: "adposting-cef8e",
  storageBucket: "adposting-cef8e.firebasestorage.app",
  messagingSenderId: "60856065114",
  appId: "1:60856065114:web:f9638cf99fd3f5a8f04c63",
  measurementId: "G-3141SQGXL3"
};

// Initialize Firebase
let messaging;
try {
  firebase.initializeApp(firebaseConfig);

  // Get messaging instance
  messaging = firebase.messaging();
} catch (error) {
  // [firebase-messaging-sw.js] Firebase initialization error: error
}

// Handle background messages
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('Push Received (Background - Admin):', payload);
    const notificationTitle = payload.notification?.title || 'New Notification';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'admin-notification',
      requireInteraction: true,
      data: payload.data || {}
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Push Clicked (Admin Background):', event);
  event.notification.close();

  const notificationData = event.notification.data || {};
  const type = notificationData.type || 'GENERAL';

  // Determine which URL to open based on notification type
  let urlToOpen = '/dashboard';

  switch (type) {
    case 'ADMIN_ALERT':
      // Route based on action field in notification data
      switch (notificationData.action) {
        case 'review_ad':
        case 'review_flagged_ad':
          urlToOpen = notificationData.adId ? `/dashboard/ad-moderation/${notificationData.adId}` : '/dashboard/ad-moderation';
          break;
        case 'view_booking':
          urlToOpen = notificationData.bookingId ? `/dashboard/booking-management/${notificationData.bookingId}` : '/dashboard/booking-management';
          break;
        case 'view_payment':
          urlToOpen = '/dashboard/payments';
          break;
        case 'view_subscription':
          urlToOpen = notificationData.adId ? `/dashboard/ad-management/ads/${notificationData.adId}` : '/dashboard/ad-management/ads';
          break;
        default:
          urlToOpen = '/dashboard/admin-notifications';
      }
      break;

    case 'BOOKING':
    case 'BOOKING_UPDATE':
      urlToOpen = notificationData.bookingId ? `/dashboard/booking-management/${notificationData.bookingId}` : '/dashboard/booking-management';
      break;

    case 'COMPLAINT':
      urlToOpen = notificationData.bookingId ? `/dashboard/booking-management/${notificationData.bookingId}` : '/dashboard/admin-notifications';
      break;

    case 'SYSTEM':
    default:
      urlToOpen = '/dashboard/admin-notifications';
      break;
  }

  // Open or focus the relevant page
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: notificationData,
            url: urlToOpen
          });
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle service worker install
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Handle service worker activate
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
