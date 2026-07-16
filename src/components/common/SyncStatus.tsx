import { useState, useEffect } from 'react';
import { networkStatus, type NetworkStatusValue } from '../../services/NetworkStatus';

export function SyncStatus() {
  const [status, setStatus] = useState<NetworkStatusValue>(() => networkStatus.getStatus());

  useEffect(() => {
    const unsubscribe = networkStatus.subscribe(setStatus);
    return unsubscribe;
  }, []);

  // Hide when online — realtime feed is live
  if (status.isOnline) {
    return null;
  }

  return (
    <div className="fixed z-50 right-4 top-[calc(env(safe-area-inset-top)+0.75rem)] md:top-auto md:bottom-4">
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm bg-gray-100 dark:bg-zinc-950 text-gray-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-800">
        <div className="w-2 h-2 rounded-full bg-gray-400" />
        <span>Offline</span>
      </div>
    </div>
  );
}
