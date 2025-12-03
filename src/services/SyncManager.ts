/**
 * SyncManager - Handles offline/online synchronization
 *
 * Provides:
 * - Online/offline status detection
 * - Operation queue for offline mode
 * - Automatic sync when back online
 * - Conflict resolution (last-write-wins)
 */

import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

// Table names from our database schema
type TableName = keyof Database['public']['Tables'];

// Types for queued operations
type OperationType = 'INSERT' | 'UPDATE' | 'DELETE';

interface QueuedOperation {
  id: string;
  table: TableName;
  type: OperationType;
  data: Record<string, unknown>;
  timestamp: number;
}

interface SyncStatus {
  isOnline: boolean;
  pendingOperations: number;
  lastSyncAt: number | null;
  syncError: string | null;
}

type SyncStatusListener = (status: SyncStatus) => void;

const STORAGE_KEY = 'classpoints_sync_queue';
const LAST_SYNC_KEY = 'classpoints_last_sync';

class SyncManager {
  private static instance: SyncManager;
  private isOnline: boolean = navigator.onLine;
  private queue: QueuedOperation[] = [];
  private listeners: Set<SyncStatusListener> = new Set();
  private syncError: string | null = null;
  private lastSyncAt: number | null = null;
  private isSyncing: boolean = false;

  private constructor() {
    this.loadQueue();
    this.loadLastSync();
    this.setupListeners();
  }

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  private setupListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners();
      this.syncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners();
    });
  }

  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.queue = [];
    }
  }

  private saveQueue(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  private loadLastSync(): void {
    try {
      const stored = localStorage.getItem(LAST_SYNC_KEY);
      if (stored) {
        this.lastSyncAt = parseInt(stored, 10);
      }
    } catch (error) {
      console.error('Failed to load last sync time:', error);
    }
  }

  private saveLastSync(): void {
    try {
      this.lastSyncAt = Date.now();
      localStorage.setItem(LAST_SYNC_KEY, String(this.lastSyncAt));
    } catch (error) {
      console.error('Failed to save last sync time:', error);
    }
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current status
    listener(this.getStatus());

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      pendingOperations: this.queue.length,
      lastSyncAt: this.lastSyncAt,
      syncError: this.syncError,
    };
  }

  /**
   * Queue an operation for sync
   */
  queueOperation(
    table: TableName,
    type: OperationType,
    data: Record<string, unknown>
  ): void {
    const operation: QueuedOperation = {
      id: crypto.randomUUID(),
      table,
      type,
      data,
      timestamp: Date.now(),
    };

    this.queue.push(operation);
    this.saveQueue();
    this.notifyListeners();

    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncQueue();
    }
  }

  /**
   * Process the sync queue
   */
  async syncQueue(): Promise<void> {
    if (!this.isOnline || this.isSyncing || this.queue.length === 0) {
      return;
    }

    this.isSyncing = true;
    this.syncError = null;
    this.notifyListeners();

    const failedOperations: QueuedOperation[] = [];

    for (const operation of this.queue) {
      try {
        await this.processOperation(operation);
      } catch (error) {
        console.error('Failed to sync operation:', error);
        failedOperations.push(operation);
        this.syncError = error instanceof Error ? error.message : 'Sync failed';
      }
    }

    this.queue = failedOperations;
    this.saveQueue();

    if (failedOperations.length === 0) {
      this.saveLastSync();
    }

    this.isSyncing = false;
    this.notifyListeners();
  }

  /**
   * Process a single operation
   */
  private async processOperation(operation: QueuedOperation): Promise<void> {
    const { table, type, data } = operation;

    switch (type) {
      case 'INSERT': {
        // Type assertion needed for dynamic table operations
        const { error } = await (supabase.from(table) as ReturnType<typeof supabase.from>)
          .insert(data as Database['public']['Tables'][typeof table]['Insert']);
        if (error) throw error;
        break;
      }
      case 'UPDATE': {
        const { id, ...updates } = data;
        // Type assertion needed for dynamic table operations
        const { error } = await (supabase.from(table) as ReturnType<typeof supabase.from>)
          .update(updates as Database['public']['Tables'][typeof table]['Update'])
          .eq('id', id as string);
        if (error) throw error;
        break;
      }
      case 'DELETE': {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', data.id as string);
        if (error) throw error;
        break;
      }
    }
  }

  /**
   * Clear the queue (use with caution)
   */
  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
    this.syncError = null;
    this.notifyListeners();
  }

  /**
   * Force a sync attempt
   */
  async forceSync(): Promise<boolean> {
    if (!this.isOnline) {
      return false;
    }

    await this.syncQueue();
    return this.queue.length === 0;
  }

  /**
   * Check if we're currently online
   */
  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Get pending operations count
   */
  getPendingCount(): number {
    return this.queue.length;
  }
}

// Export singleton instance
export const syncManager = SyncManager.getInstance();

// Export hook for React usage
export function useSyncStatus(): SyncStatus {
  // This will be used in the HybridAppContext
  return syncManager.getStatus();
}
