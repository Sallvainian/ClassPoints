import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useStudents, type TimeTotalsRow } from '../useStudents';
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
  vi.fn<() => Promise<{ data: Record<string, unknown>[]; error: null }>>(() =>
    Promise.resolve({ data: [], error: null })
  )
);
// Batched-RPC mock (deferred #8): the RPC returns rows for EVERY classroom the
// user owns in one call and the queryFn filters client-side. Row shape is the
// hook's own TimeTotalsRow (derived from the generated Functions entry) so the
// mock cannot drift from src/types/database.ts.
const mockRpc = vi.hoisted(() =>
  vi.fn<() => Promise<{ data: TimeTotalsRow[]; error: null }>>(() =>
    Promise.resolve({ data: [], error: null })
  )
);

// The hook unwraps results via unwrap() from this module, so the factory spreads
// the REAL exports and overrides only the client. Env is stubbed BEFORE
// importOriginal — src/lib/supabase.ts throws at eval without creds (CI's Unit
// Tests step runs credless).
vi.mock('../../lib/supabase', async (importOriginal) => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-test-anon-key');
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
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
  };
});

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

  it('[P0][BATCH8-UNIT-03] queryFn calls the batched totals RPC without a classroom arg and filters rows to its classroom', async () => {
    mockStudentsOrder.mockResolvedValue({
      data: [
        {
          id: 'student-1',
          classroom_id: CLASSROOM_ID,
          name: 'Ann',
          avatar_color: null,
          point_total: 5,
          positive_total: 5,
          negative_total: 0,
        },
      ],
      error: null,
    });
    // The shared payload carries OTHER classrooms' rows too (deferred #8). The
    // foreign row deliberately reuses student-1's id: an implementation that
    // skipped the classroom_id filter would last-write-wins to 99/99, so the
    // merged-value assertion below genuinely pins the client-side filter.
    mockRpc.mockResolvedValue({
      data: [
        {
          classroom_id: CLASSROOM_ID,
          student_id: 'student-1',
          today_total: 3,
          this_week_total: 7,
        },
        {
          classroom_id: 'classroom-other',
          student_id: 'student-1',
          today_total: 99,
          this_week_total: 99,
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useStudents(CLASSROOM_ID), {
      wrapper: makeWrapper(makeClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_student_time_totals_all_for_user', {
      p_start_of_today: expect.any(String),
      p_start_of_week: expect.any(String),
    });
    expect(result.current.data?.[0]).toMatchObject({
      id: 'student-1',
      today_total: 3,
      this_week_total: 7,
    });
  });
});
