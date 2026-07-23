import { useState } from 'react';
import { requestPushToken } from './firebaseMessaging';
import { saveFcmToken } from './fcmTokensApi';

export type NotificationPermissionStatus = 'idle' | 'granted' | 'denied';

export function useNotificationPermission(uid: string, vapidKey: string) {
  const [status, setStatus] = useState<NotificationPermissionStatus>('idle');

  async function enable(): Promise<void> {
    const token = await requestPushToken(vapidKey);
    if (!token) {
      setStatus('denied');
      return;
    }
    await saveFcmToken(uid, token);
    setStatus('granted');
  }

  return { status, enable };
}
