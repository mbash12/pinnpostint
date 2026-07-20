importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAZatuNHiXfGjtt-zmXV6par7YFKnO2hWs",
  authDomain: "adposting-cef8e.firebaseapp.com",
  projectId: "adposting-cef8e",
  storageBucket: "adposting-cef8e.firebasestorage.app",
  messagingSenderId: "60856065114",
  appId: "1:60856065114:web:f9638cf99fd3f5a8f04c63",
  measurementId: "G-3141SQGXL3"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const type = notificationData.type || 'GENERAL';

  // Determine which URL to open based on notification type
  let urlToOpen = '/notifications';

  switch (type) {
    case 'AD_APPROVED':
    case 'AD_REJECTED':
    case 'AD_REVIEW':
    case 'AD_EXTENDED':
    case 'AD_EXPIRED':
      if (notificationData.adId) {
        urlToOpen = `/ad-stats/${notificationData.adSlug || notificationData.adId}`;
      } else {
        urlToOpen = '/notifications';
      }
      break;

    case 'BOOKING':
    case 'BOOKING_UPDATE':
      if (notificationData.bookingId) {
        const isOwner = notificationData.isOwner === 'true' || notificationData.isOwner === true;
        const page = isOwner ? 'ad-booking-detail' : 'booking-detail';
        urlToOpen = `/${page}?id=${notificationData.bookingId}`;
      } else {
        urlToOpen = '/my-bookings';
      }
      break;

    case 'PROMOTION':
      // Handle promotions - navigate to notifications or specific page
      urlToOpen = '/notifications';
      break;

    case 'SUBSCRIPTION_EXPIRY':
      urlToOpen = '/settings';
      break;

    case 'SYSTEM':
    case 'ADMIN_ALERT':
    case 'GENERAL':
    default:
      urlToOpen = '/notifications';
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
