import { useState } from 'react';
import { useNotificationPermission } from './useNotificationPermission';

export function NotificationPermission({ uid, vapidKey }: { uid: string; vapidKey: string }) {
  const { status, error, enable } = useNotificationPermission(uid, vapidKey);
  const [dismissed, setDismissed] = useState(false);

  if (status === 'granted' || dismissed) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start justify-between gap-3">
      <div className="text-sm text-blue-900">
        {error ? (
          <p className="text-red-700">{error}</p>
        ) : status === 'denied' ? (
          <p>Notifications are blocked. Enable them in your browser settings to get reminders.</p>
        ) : (
          <p>Turn on push reminders for workouts, learning, and chores.</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {status !== 'denied' && !error && (
          <button type="button" onClick={enable} className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm">
            Enable
          </button>
        )}
        <button type="button" onClick={() => setDismissed(true)} className="text-blue-700 text-sm">
          Dismiss
        </button>
      </div>
    </div>
  );
}
