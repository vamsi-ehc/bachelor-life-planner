import { usePwaUpdate } from './usePwaUpdate';

export function UpdateToast() {
  const { needRefresh, offlineReady, updateServiceWorker } = usePwaUpdate();

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-80 bg-gray-900 text-white rounded-lg shadow-lg p-4 flex flex-col gap-2 z-50">
      {needRefresh ? (
        <>
          <p className="text-sm">A new version of Punch In is available.</p>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="bg-blue-600 text-white rounded px-3 py-2 text-sm self-start"
          >
            Reload to update
          </button>
        </>
      ) : (
        <p className="text-sm">Punch In is ready to work offline.</p>
      )}
    </div>
  );
}
