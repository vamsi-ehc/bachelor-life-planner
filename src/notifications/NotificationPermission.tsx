import { useState } from 'react';
import { useNotificationPermission } from './useNotificationPermission';

function dismissedKey(uid: string): string {
  return `notif-banner-dismissed:${uid}`;
}

export function NotificationPermission({ uid }: { uid: string }) {
  const { status, error, enable } = useNotificationPermission(uid);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissedKey(uid)) === '1');

  function dismiss() {
    localStorage.setItem(dismissedKey(uid), '1');
    setDismissed(true);
  }

  if (status === 'granted' || status === 'denied' || dismissed) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start justify-between gap-3">
      <div className="text-sm text-blue-900">
        {error ? (
          <p className="text-red-700">{error}</p>
        ) : (
          <p>Turn on push reminders for workouts, learning, and chores.</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!error && (
          <button type="button" onClick={enable} className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm">
            Enable
          </button>
        )}
        <button type="button" onClick={dismiss} className="text-blue-700 text-sm">
          Dismiss
        </button>
      </div>
    </div>
  );
}
