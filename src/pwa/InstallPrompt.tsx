import { useState } from 'react';
import { useInstallPrompt } from './useInstallPrompt';

export function InstallPrompt() {
  const { canInstall, installed, isIOS, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (installed || dismissed) return null;
  if (!canInstall && !isIOS) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start justify-between gap-3">
      <div className="text-sm text-blue-900">
        {canInstall ? (
          <p>Install Punch In on your device for quick access and offline use.</p>
        ) : (
          <p>Add Punch In to your Home Screen: tap the Share icon, then "Add to Home Screen".</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {canInstall && (
          <button
            type="button"
            onClick={promptInstall}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm"
          >
            Install
          </button>
        )}
        <button type="button" onClick={() => setDismissed(true)} className="text-blue-700 text-sm">
          Dismiss
        </button>
      </div>
    </div>
  );
}
