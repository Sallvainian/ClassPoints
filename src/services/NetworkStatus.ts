/**
 * NetworkStatus — tracks online/offline state for UI feedback.
 *
 * Realtime-only app: we don't queue offline mutations. This service
 * just detects network transitions so the UI can indicate when the
 * Supabase realtime feed is likely stale.
 */

interface NetworkStatusValue {
  isOnline: boolean;
}

type NetworkStatusListener = (status: NetworkStatusValue) => void;

class NetworkStatus {
  private static instance: NetworkStatus;
  private isOnline: boolean = navigator.onLine;
  private listeners: Set<NetworkStatusListener> = new Set();

  private constructor() {
    this.setupListeners();
  }

  static getInstance(): NetworkStatus {
    if (!NetworkStatus.instance) {
      NetworkStatus.instance = new NetworkStatus();
    }
    return NetworkStatus.instance;
  }

  private setupListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners();
    });
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): NetworkStatusValue {
    return { isOnline: this.isOnline };
  }

  isNetworkOnline(): boolean {
    return this.isOnline;
  }
}

export const networkStatus = NetworkStatus.getInstance();
export type { NetworkStatusValue };
