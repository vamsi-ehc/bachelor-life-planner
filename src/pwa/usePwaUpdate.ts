import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePwaUpdate() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW();

  return { needRefresh, offlineReady, updateServiceWorker };
}
