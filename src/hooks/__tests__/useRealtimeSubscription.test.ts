import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeSubscription } from '../useRealtimeSubscription';
import { supabase } from '../../lib/supabase';

// Types for captured mock handlers. Real RealtimePostgresChangesPayload never
// carries null: `old` is Partial<T> ({} on INSERT) and `new` is {} on DELETE —
// mirror that here so tests can't cement a payload shape production won't send.
type MockHandler = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
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

  it('should call onChange with the full payload when INSERT event received', async () => {
    const onChange = vi.fn();

    renderHook(() =>
      useRealtimeSubscription({
        table: 'test_table',
        onChange,
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
        old: {},
      });
    });

    expect(onChange).toHaveBeenCalledWith({
      eventType: 'INSERT',
      new: { id: '123', name: 'Test' },
      old: {},
    });
  });

  it('should call onChange with the full payload when DELETE event received', async () => {
    const onChange = vi.fn();

    renderHook(() =>
      useRealtimeSubscription({
        table: 'test_table',
        onChange,
      })
    );

    await waitFor(() => {
      expect(globalThis.__mockOnHandler).not.toBeNull();
    });

    const handler = globalThis.__mockOnHandler!;

    act(() => {
      handler({
        eventType: 'DELETE',
        new: {},
        old: { id: '123' },
      });
    });

    expect(onChange).toHaveBeenCalledWith({
      eventType: 'DELETE',
      new: {},
      old: { id: '123' },
    });
  });

  it('should use fresh callbacks when they change (no stale closure)', async () => {
    let callCount = 0;

    const { rerender } = renderHook(
      ({ onChange }) =>
        useRealtimeSubscription({
          table: 'test_table',
          onChange,
        }),
      {
        initialProps: {
          onChange: () => {
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
      onChange: () => {
        callCount = 2;
      },
    });

    act(() => {
      handler({
        eventType: 'INSERT',
        new: { id: '123' },
        old: {},
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

  // NFR6: no subscription outlives its component tree.
  it('should removeChannel on unmount with the same channel instance', async () => {
    const { unmount } = renderHook(() =>
      useRealtimeSubscription({
        table: 'test_table',
        onChange: () => {},
      })
    );

    await waitFor(() => {
      expect(globalThis.__mockOnHandler).not.toBeNull();
    });

    const channelMock = (supabase.channel as unknown as { mock: { results: { value: unknown }[] } })
      .mock.results[0].value;

    expect(supabase.removeChannel).not.toHaveBeenCalled();

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    expect(supabase.removeChannel).toHaveBeenCalledWith(channelMock);
  });

  // CAP-3: INSERT, UPDATE, and DELETE all route through the single `onChange` path.
  it('should route INSERT, UPDATE, and DELETE events through onChange', async () => {
    const onChange = vi.fn();

    renderHook(() =>
      useRealtimeSubscription({
        table: 'test_table',
        onChange,
      })
    );

    await waitFor(() => {
      expect(globalThis.__mockOnHandler).not.toBeNull();
    });

    const handler = globalThis.__mockOnHandler!;

    act(() => {
      handler({ eventType: 'INSERT', new: { id: '1' }, old: {} });
      handler({ eventType: 'UPDATE', new: { id: '1', name: 'x' }, old: { id: '1' } });
      handler({ eventType: 'DELETE', new: {}, old: { id: '1' } });
    });

    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenNthCalledWith(1, {
      eventType: 'INSERT',
      new: { id: '1' },
      old: {},
    });
    expect(onChange).toHaveBeenNthCalledWith(2, {
      eventType: 'UPDATE',
      new: { id: '1', name: 'x' },
      old: { id: '1' },
    });
    expect(onChange).toHaveBeenNthCalledWith(3, {
      eventType: 'DELETE',
      new: {},
      old: { id: '1' },
    });
  });
});
