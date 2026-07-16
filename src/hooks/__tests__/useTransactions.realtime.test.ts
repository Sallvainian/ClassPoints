import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useTransactions } from '../useTransactions';
import { queryKeys } from '../../lib/queryKeys';

type MockPostgresPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

type MockHandler = (payload: MockPostgresPayload) => void;
type MockConfig = {
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  table: string;
  filter?: string;
};

declare global {
  // Fresh names (not the useStudents globals) so the two realtime suites can't
  // clobber each other's captured handlers inside the same vitest process.
  var __useTransactionsRealtimeHandlers: Record<string, MockHandler | undefined>;
  var __useTransactionsRealtimeConfigs: Record<string, MockConfig | undefined>;
  // The subscribe-status callback for the active channel — lets a test drive the
  // CLOSED → SUBSCRIBED transition that useRealtimeSubscription gates onReconnect on.
  var __useTransactionsRealtimeStatusCb: ((status: string) => void) | undefined;
}

const mockTransactionsOrder = vi.hoisted(() =>
  vi.fn<() => Promise<{ data: Record<string, unknown>[]; error: null }>>(() =>
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
      // point_transactions read chain: from().select().eq().order() → resolved rows.
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: mockTransactionsOrder,
          })),
        })),
      })),
      // Not used by useTransactions, but kept for parity/safety with the template.
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
      channel: vi.fn(() => {
        const channel = {
          on: vi.fn((_event: string, config: MockConfig, handler: MockHandler): typeof channel => {
            globalThis.__useTransactionsRealtimeHandlers[config.table] = handler;
            globalThis.__useTransactionsRealtimeConfigs[config.table] = config;
            return channel;
          }),
          subscribe: vi.fn((callback?: (status: string) => void) => {
            globalThis.__useTransactionsRealtimeStatusCb = callback;
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

describe('useTransactions point_transactions realtime invalidate-not-merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__useTransactionsRealtimeHandlers = {};
    globalThis.__useTransactionsRealtimeConfigs = {};
    globalThis.__useTransactionsRealtimeStatusCb = undefined;
    mockTransactionsOrder.mockResolvedValue({ data: [], error: null });
  });

  it.each(['INSERT', 'UPDATE', 'DELETE'] as const)(
    '[P0][HIST.02-INT-01] invalidates transactions.list + classrooms.all and never setQueryData on %s',
    async (eventType) => {
      const qc = makeClient();
      const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
      const setQueryDataSpy = vi.spyOn(qc, 'setQueryData');

      renderHook(() => useTransactions(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

      await waitFor(() => {
        expect(globalThis.__useTransactionsRealtimeHandlers.point_transactions).toBeDefined();
      });

      invalidateSpy.mockClear();
      setQueryDataSpy.mockClear();

      act(() => {
        globalThis.__useTransactionsRealtimeHandlers.point_transactions?.({
          eventType,
          new: eventType === 'DELETE' ? null : { id: 'tx-1', classroom_id: CLASSROOM_ID },
          old: eventType === 'INSERT' ? null : { id: 'tx-1' },
        });
      });

      // The one rule: live-sync callbacks only invalidate — never hand-merge a payload.
      expect(setQueryDataSpy).not.toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.transactions.list(CLASSROOM_ID),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.classrooms.all,
      });
    }
  );

  it('[P0][HIST.02-INT-01] onReconnect runs the same refresh contract (invalidate, never setQueryData)', async () => {
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const setQueryDataSpy = vi.spyOn(qc, 'setQueryData');

    renderHook(() => useTransactions(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    await waitFor(() => {
      expect(globalThis.__useTransactionsRealtimeStatusCb).toBeDefined();
    });

    invalidateSpy.mockClear();
    setQueryDataSpy.mockClear();

    // useTransactions wires `onReconnect: refresh` (same reference as onChange), but
    // useRealtimeSubscription only fires onReconnect on SUBSCRIBED *after* a drop
    // (CHANNEL_ERROR / TIMED_OUT / CLOSED). Drive CLOSED → SUBSCRIBED to satisfy
    // that gate and prove the catch-up refetch follows the invalidate-not-merge rule.
    act(() => {
      globalThis.__useTransactionsRealtimeStatusCb?.('CLOSED');
      globalThis.__useTransactionsRealtimeStatusCb?.('SUBSCRIBED');
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.transactions.list(CLASSROOM_ID),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.classrooms.all,
    });
  });

  it('[P0][HIST.02-INT-01] subscribes with the classroom-scoped filter on the point_transactions table', async () => {
    renderHook(() => useTransactions(CLASSROOM_ID), { wrapper: makeWrapper(makeClient()) });

    await waitFor(() => {
      expect(globalThis.__useTransactionsRealtimeConfigs.point_transactions).toBeDefined();
    });

    // The filter is load-bearing: without it every classroom's transactions
    // stream into this channel. Invalidate-only callbacks would mask that in
    // the other tests (any event triggers the same invalidations), so the
    // subscription config itself is pinned here.
    expect(globalThis.__useTransactionsRealtimeConfigs.point_transactions).toMatchObject({
      event: '*',
      schema: 'public',
      table: 'point_transactions',
      filter: `classroom_id=eq.${CLASSROOM_ID}`,
    });
  });

  it('[P0][HIST.02-INT-01] disables the subscription when classroomId is null (no channel, no handler captured)', async () => {
    renderHook(() => useTransactions(null), { wrapper: makeWrapper(makeClient()) });

    // enabled:false → useRealtimeSubscription never creates a channel, so no
    // postgres_changes handler is ever registered for the null-classroom case.
    await waitFor(() => {
      expect(globalThis.__useTransactionsRealtimeStatusCb).toBeUndefined();
    });
    expect(globalThis.__useTransactionsRealtimeHandlers).toEqual({});
  });
});
