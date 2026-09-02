/// <reference lib="webworker" />
export {};
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute } from 'workbox-precaching';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

precacheAndRoute(self.__WB_MANIFEST);

// The offline (no-internet) build has no Firebase project configured, so
// there is nothing to initialize here — background push notifications are
// a Firebase Cloud Messaging feature and simply aren't available offline.
if (import.meta.env.VITE_FIREBASE_API_KEY) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const firebaseApp = initializeApp(firebaseConfig);
  const messaging = getMessaging(firebaseApp);

  onBackgroundMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'Punch In';
    const body = payload.notification?.body ?? '';
    const tag = payload.data?.tag;
    self.registration.showNotification(title, { body, icon: '/icons/icon-192.png', ...(tag ? { tag } : {}) });
  });
}
