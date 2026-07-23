import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { app } from '../firebase/config';

export async function requestPushToken(vapidKey: string): Promise<string | null> {
  const supported = await isSupported();
  if (!supported) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  return token || null;
}
