import { useState } from 'react';
import { requestPushToken } from './firebaseMessaging';
import { saveFcmToken } from './fcmTokensApi';

export type NotificationPermissionStatus = 'idle' | 'granted' | 'denied';

export function useNotificationPermission(uid: string, vapidKey: string) {
  const [status, setStatus] = useState<NotificationPermissionStatus>('idle');
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
