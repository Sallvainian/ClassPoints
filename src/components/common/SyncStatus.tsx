import { useState, useEffect } from 'react';
import { syncManager } from '../../services/SyncManager';

interface SyncStatusState {
  isOnline: boolean;
  pendingOperations: number;
  lastSyncAt: number | null;
  syncError: string | null;
}

export function SyncStatus() {
  const [status, setStatus] = useState<SyncStatusState>(() => syncManager.getStatus());

  useEffect(() => {
    const unsubscribe = syncManager.subscribe(setStatus);
    return unsubscribe;
  }, []);

  const handleRetrySync = async () => {
    await syncManager.forceSync();
  };

  // Don't show anything if online with no pending operations
  if (status.isOnline && status.pendingOperations === 0 && !status.syncError) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm ${
          status.isOnline
            ? status.syncError
              ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
              : 'bg-blue-100 text-blue-800 border border-blue-200'
            : 'bg-gray-100 text-gray-800 border border-gray-200'
        }`}
      >
        {/* Status indicator */}
        <div
          className={`w-2 h-2 rounded-full ${
            status.isOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />

        {/* Status text */}
        <span>
          {!status.isOnline && 'Offline'}
          {status.isOnline && status.pendingOperations > 0 && (
            <>Syncing {status.pendingOperations} changes...</>
          )}
          {status.isOnline && status.syncError && (
            <>Sync error: {status.syncError}</>
          )}
        </span>

        {/* Retry button for errors */}
        {status.isOnline && status.syncError && (
          <button
            onClick={handleRetrySync}
            className="ml-2 px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded text-xs font-medium transition-colors"
          >
            Retry
          </button>
        )}

        {/* Pending count badge */}
        {status.pendingOperations > 0 && !status.isOnline && (
          <span className="ml-1 px-1.5 py-0.5 bg-gray-200 rounded-full text-xs">
            {status.pendingOperations}
          </span>
        )}
      </div>
    </div>
  );
}
