import { useEffect } from 'react';
import { Platform } from 'react-native';
import { userService } from '@/services/user.service';

let app: any = null;
let getMessaging: any = null;
let getToken: any = null;

if (Platform.OS === 'web') {
  try {
    const firebaseWeb = require('@/config/firebase.web');
    app = firebaseWeb.app;
    const firebase = require('firebase/messaging');
    getMessaging = firebase.getMessaging;
    getToken = firebase.getToken;
  } catch (error) {
  }
}

export function useWebFcm() {
  useEffect(() => {
    if (Platform.OS !== 'web' || !app || !getMessaging || !getToken) return;
    if (typeof window === 'undefined' || !window.isSecureContext) return;

    let mounted = true;
    (async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
        
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;

        const messaging = getMessaging(app);
        const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
        
        if (!vapidKey) return;

        const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });

        if (mounted && token) {
          await userService.updateFcmToken(token);
        }
      } catch {}
    })();
    
    return () => { mounted = false; };
  }, []);
}
