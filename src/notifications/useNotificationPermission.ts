import { useState } from 'react';
import { requestPushToken } from './firebaseMessaging';
import { saveFcmToken } from './fcmTokensApi';

export type NotificationPermissionStatus = 'idle' | 'granted' | 'denied';

function initialStatus(): NotificationPermissionStatus {
  if (typeof Notification === 'undefined') return 'idle';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'idle';
}

export function useNotificationPermission(uid: string, vapidKey: string) {
  const [status, setStatus] = useState<NotificationPermissionStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);

  async function enable(): Promise<void> {
    setError(null);
    try {
      const token = await requestPushToken(vapidKey);
      if (!token) {
        setStatus('denied');
        return;
      }
      await saveFcmToken(uid, token);
      setStatus('granted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications');
    }
  }

  return { status, error, enable };
}
