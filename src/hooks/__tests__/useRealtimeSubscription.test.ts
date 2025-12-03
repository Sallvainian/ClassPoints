import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeSubscription } from '../useRealtimeSubscription';

// Mock supabase - handler is stored in globalThis for test access
vi.mock('../../lib/supabase', () => {
  const channel = {
    on: vi.fn((_event: any, _config: any, handler: any) => {
      // Store handler for test access
      (globalThis as any).__mockOnHandler = handler;
      return channel;
    }),
    subscribe: vi.fn((callback?: (status: string) => void) => {
      if (callback) setTimeout(() => callback('SUBSCRIBED'), 0);
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
    (globalThis as any).__mockOnHandler = null;
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

    // Wait for handler to be registered
    await waitFor(() => {
      expect((globalThis as any).__mockOnHandler).not.toBeNull();
    });

    const handler = (globalThis as any).__mockOnHandler;

    // Simulate an INSERT event
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
      expect((globalThis as any).__mockOnHandler).not.toBeNull();
    });

    const handler = (globalThis as any).__mockOnHandler;

    // Simulate a DELETE event
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
      expect((globalThis as any).__mockOnHandler).not.toBeNull();
    });

    const handler = (globalThis as any).__mockOnHandler;

    // Update the callback
    rerender({
      onInsert: () => {
        callCount = 2;
      },
    });

    // Simulate an INSERT event - should use the NEW callback
    act(() => {
      handler({
        eventType: 'INSERT',
        new: { id: '123' },
        old: null,
      });
    });

    // If refs work correctly, callCount should be 2 (new callback)
    // If stale closure, callCount would be 1 (old callback)
    expect(callCount).toBe(2);
  });
});
