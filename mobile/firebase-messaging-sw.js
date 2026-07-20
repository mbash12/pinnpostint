// Firebase service worker for handling background notifications
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

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Push Received (Background - Web):', payload);
  // Customize notification here
  const notificationTitle = payload.notification?.title || 'Pin N Post Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data,
    // Make notification clickable and open the app
    requireInteraction: true,
    tag: 'pinnpost-notification'
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Push Clicked (Web Background):', event);
  event.notification.close();
  
  // This gets the data from the notification
  const data = event.notification.data || {};
  const type = data.type || 'GENERAL';
  
  // Open your app to specific page based on notification type and data
  let pathname = '/';
  
  switch (type) {
    case 'AD_APPROVED':
    case 'AD_REJECTED':
    case 'AD_REVIEW':
    case 'AD_EXTENDED':
    case 'AD_EXPIRED':
      if (data.adId) {
        pathname = `/ad-stats/${data.adSlug || data.adId}`;
      } else {
        pathname = '/notifications';
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
  
  const urlToOpen = new URL(pathname, self.location.origin);
  
  event.waitUntil(
    clients.matchAll({type: 'window'}).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(urlToOpen.pathname) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen.href);
      }
    })
  );
});
