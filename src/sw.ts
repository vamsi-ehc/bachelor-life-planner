/// <reference lib="webworker" />
export {};
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute } from 'workbox-precaching';

// The app is fully offline: the precache (app shell + sql.js wasm) is all
// the service worker needs. Reminders are scheduled on-device by
// src/notifications/useLocalReminderScheduler.ts — there is no push server.
precacheAndRoute(self.__WB_MANIFEST);
