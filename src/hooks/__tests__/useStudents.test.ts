import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useStudents } from '../useStudents';
import { queryKeys } from '../../lib/queryKeys';

type MockPostgresPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

type MockHandler = (payload: MockPostgresPayload) => void;
type MockConfig = {
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  table: string;
};

declare global {
  var __useStudentsRealtimeHandlers: Record<string, MockHandler | undefined>;
  var __useStudentsRealtimeConfigs: Record<string, MockConfig | undefined>;
  // The subscribe-status callback for the active channel — lets a test drive the
  // CLOSED → SUBSCRIBED transition that useRealtimeSubscription gates onReconnect on.
  var __useStudentsRealtimeStatusCb: ((status: string) => void) | undefined;
}

const mockStudentsOrder = vi.hoisted(() =>
  vi.fn<() => Promise<{ data: never[]; error: null }>>(() =>
    Promise.resolve({ data: [], error: null })
  )
);
const mockRpc = vi.hoisted(() =>
  vi.fn<() => Promise<{ data: never[]; error: null }>>(() =>
    Promise.resolve({ data: [], error: null })
  )
);

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: mockStudentsOrder,
        })),
      })),
    })),
    rpc: mockRpc,
    channel: vi.fn(() => {
      const channel = {
        on: vi.fn((_event: string, config: MockConfig, handler: MockHandler): typeof channel => {
          globalThis.__useStudentsRealtimeHandlers[config.table] = handler;
          globalThis.__useStudentsRealtimeConfigs[config.table] = config;
          return channel;
        }),
        subscribe: vi.fn((callback?: (status: string) => void) => {
          globalThis.__useStudentsRealtimeStatusCb = callback;
          setTimeout(() => callback?.('SUBSCRIBED'), 0);
          return channel;
        }),
      };
      return channel;
    }),
    removeChannel: vi.fn(),
  },
}));

const CLASSROOM_ID = 'classroom-1';

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('useStudents students-table realtime invalidate-not-merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__useStudentsRealtimeHandlers = {};
    globalThis.__useStudentsRealtimeConfigs = {};
    globalThis.__useStudentsRealtimeStatusCb = undefined;
    mockStudentsOrder.mockResolvedValue({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  it.each(['INSERT', 'UPDATE', 'DELETE'] as const)(
    '[P0][HIST.01-INT-02] invalidates students.byClassroom + classrooms.all and never setQueryData on %s',
    async (eventType) => {
      const qc = makeClient();
      const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
      const setQueryDataSpy = vi.spyOn(qc, 'setQueryData');

      renderHook(() => useStudents(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

      await waitFor(() => {
        expect(globalThis.__useStudentsRealtimeHandlers.students).toBeDefined();
      });

      invalidateSpy.mockClear();
      setQueryDataSpy.mockClear();

      act(() => {
        globalThis.__useStudentsRealtimeHandlers.students?.({
          eventType,
          new: eventType === 'DELETE' ? null : { id: 'student-1', classroom_id: CLASSROOM_ID },
          old: eventType === 'INSERT' ? null : { id: 'student-1' },
        });
      });

      // The one rule: live-sync callbacks only invalidate — never hand-merge a payload.
      expect(setQueryDataSpy).not.toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.students.byClassroom(CLASSROOM_ID),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.classrooms.all,
      });
    }
  );

  it('[P0][HIST.01-INT-02] onReconnect runs the same refresh contract (invalidate, never setQueryData)', async () => {
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const setQueryDataSpy = vi.spyOn(qc, 'setQueryData');

    renderHook(() => useStudents(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    await waitFor(() => {
      expect(globalThis.__useStudentsRealtimeStatusCb).toBeDefined();
    });

    invalidateSpy.mockClear();
    setQueryDataSpy.mockClear();

    // useStudents wires `onReconnect: refresh` (same reference as onChange), but
    // useRealtimeSubscription only fires onReconnect on SUBSCRIBED *after* a drop
    // (CHANNEL_ERROR / TIMED_OUT / CLOSED). Drive CLOSED → SUBSCRIBED to satisfy
    // that gate and prove the catch-up refetch follows the invalidate-not-merge rule.
    act(() => {
      globalThis.__useStudentsRealtimeStatusCb?.('CLOSED');
      globalThis.__useStudentsRealtimeStatusCb?.('SUBSCRIBED');
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.students.byClassroom(CLASSROOM_ID),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.classrooms.all,
    });
  });
});
