import { useState } from 'react';

// Reminders are delivered on-device by useLocalReminderScheduler using the
// browser Notification API. All this hook does is ask the user for the
// notification permission that scheduler needs. There is no push server.
export type NotificationPermissionStatus = 'idle' | 'granted' | 'denied';

function initialStatus(): NotificationPermissionStatus {
  if (typeof Notification === 'undefined') return 'idle';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'idle';
}

export function useNotificationPermission(_uid: string) {
  const [status, setStatus] = useState<NotificationPermissionStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);

  async function enable(): Promise<void> {
    setError(null);
    try {
      if (typeof Notification === 'undefined') {
        setStatus('denied');
        return;
      }
      const permission = await Notification.requestPermission();
      setStatus(permission === 'granted' ? 'granted' : 'denied');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications');
    }
  }

  return { status, error, enable };
}
