import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeSubscription } from '../useRealtimeSubscription';

// Types for captured mock handlers
type MockHandler = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}) => void;

type MockSubscribeCallback = (status: string, err?: Error) => void;

// Extend globalThis for test access to the mock internals
declare global {
  var __mockOnHandler: MockHandler | null;
  var __mockSubscribeCallback: MockSubscribeCallback | null;
}

// Mock supabase — handlers are stashed on globalThis so tests can fire events manually
vi.mock('../../lib/supabase', () => {
  const channel = {
    on: vi.fn((_event: string, _config: Record<string, unknown>, handler: MockHandler) => {
      globalThis.__mockOnHandler = handler;
      return channel;
    }),
    subscribe: vi.fn((callback?: MockSubscribeCallback) => {
      if (callback) {
        globalThis.__mockSubscribeCallback = callback;
        // Fire initial SUBSCRIBED status async, like a real channel
        setTimeout(() => callback('SUBSCRIBED'), 0);
      }
      return channel;
    }),
  };

  return {
    supabase: {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  };
});

describe('useRealtimeSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__mockOnHandler = null;
    globalThis.__mockSubscribeCallback = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call onInsert callback when INSERT event received', async () => {
    const onInsert = vi.fn();

    renderHook(() =>
      useRealtimeSubscription({
        table: 'test_table',
        onInsert,
      })
    );

    await waitFor(() => {
      expect(globalThis.__mockOnHandler).not.toBeNull();
    });

    const handler = globalThis.__mockOnHandler!;

    act(() => {
      handler({
        eventType: 'INSERT',
        new: { id: '123', name: 'Test' },
        old: null,
      });
    });

    expect(onInsert).toHaveBeenCalledWith({ id: '123', name: 'Test' });
  });

  it('should call onDelete callback when DELETE event received', async () => {
    const onDelete = vi.fn();

    renderHook(() =>
      useRealtimeSubscription({
        table: 'test_table',
        onDelete,
      })
    );

    await waitFor(() => {
      expect(globalThis.__mockOnHandler).not.toBeNull();
    });

    const handler = globalThis.__mockOnHandler!;

    act(() => {
      handler({
        eventType: 'DELETE',
        new: null,
        old: { id: '123' },
      });
    });

    expect(onDelete).toHaveBeenCalledWith({ id: '123' });
  });

  it('should use fresh callbacks when they change (no stale closure)', async () => {
    let callCount = 0;

    const { rerender } = renderHook(
      ({ onInsert }) =>
        useRealtimeSubscription({
          table: 'test_table',
          onInsert,
        }),
      {
        initialProps: {
          onInsert: () => {
            callCount = 1;
          },
        },
      }
    );

    await waitFor(() => {
      expect(globalThis.__mockOnHandler).not.toBeNull();
    });

    const handler = globalThis.__mockOnHandler!;

    rerender({
      onInsert: () => {
        callCount = 2;
      },
    });

    act(() => {
      handler({
        eventType: 'INSERT',
        new: { id: '123' },
        old: null,
      });
    });

    expect(callCount).toBe(2);
  });

  it('should fire onStatusChange on every status transition', async () => {
    const onStatusChange = vi.fn();

    renderHook(() =>
      useRealtimeSubscription({
        table: 'test_table',
        onStatusChange,
      })
    );

    await waitFor(() => {
      expect(globalThis.__mockSubscribeCallback).not.toBeNull();
    });

    const fireStatus = globalThis.__mockSubscribeCallback!;

    // The mock's initial setTimeout fires SUBSCRIBED async — wait for it
    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('SUBSCRIBED', undefined);
    });

    act(() => {
      fireStatus('CHANNEL_ERROR', new Error('network lost'));
    });
    expect(onStatusChange).toHaveBeenCalledWith('CHANNEL_ERROR', expect.any(Error));

    act(() => {
      fireStatus('SUBSCRIBED');
    });
    expect(onStatusChange).toHaveBeenLastCalledWith('SUBSCRIBED', undefined);
  });

  it('should fire onReconnect when SUBSCRIBED follows a disconnect', async () => {
    const onReconnect = vi.fn();

    renderHook(() =>
      useRealtimeSubscription({
        table: 'test_table',
        onReconnect,
      })
    );

    await waitFor(() => {
      expect(globalThis.__mockSubscribeCallback).not.toBeNull();
    });

    const fireStatus = globalThis.__mockSubscribeCallback!;

    // Wait for initial SUBSCRIBED to settle — should NOT have fired onReconnect yet
    // (previousStatus was null, not a disconnect state)
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onReconnect).not.toHaveBeenCalled();

    // Simulate a disconnect followed by a reconnect
    act(() => {
      fireStatus('CHANNEL_ERROR');
    });
    expect(onReconnect).not.toHaveBeenCalled();

    act(() => {
      fireStatus('SUBSCRIBED');
    });
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('should not fire onReconnect on the initial SUBSCRIBED', async () => {
    const onReconnect = vi.fn();

    renderHook(() =>
      useRealtimeSubscription({
        table: 'test_table',
        onReconnect,
      })
    );

    await waitFor(() => {
      expect(globalThis.__mockSubscribeCallback).not.toBeNull();
    });

    // Give initial SUBSCRIBED a moment to fire
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onReconnect).not.toHaveBeenCalled();
  });
});
