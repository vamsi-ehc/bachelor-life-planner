import { useEffect, useState } from 'react';
import { loadGoogleAnalytics } from '../analytics/ga';

const STORAGE_KEY = 'punch-in-consent';

export function ConsentBanner() {
  const [choice, setChoice] = useState<string | null>(() => window.localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (choice === 'accepted') {
      loadGoogleAnalytics();
    }
  }, [choice]);

  if (choice) {
    return null;
  }

  function decide(value: 'accepted' | 'declined') {
    window.localStorage.setItem(STORAGE_KEY, value);
    setChoice(value);
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-line bg-card px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
      <p className="text-sm text-muted leading-relaxed">
        We use cookies for analytics only if you accept. See our{' '}
        <a href="/privacy" className="text-primary underline">
          Privacy Policy
        </a>
        .
      </p>
      <div className="flex gap-2 flex-none">
        <button
          type="button"
          onClick={() => decide('declined')}
          className="px-4 py-2 rounded-lg text-sm font-mono text-muted border border-line hover:text-ink"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => decide('accepted')}
          className="px-4 py-2 rounded-lg text-sm font-mono text-white bg-primary hover:bg-primary-dark"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
