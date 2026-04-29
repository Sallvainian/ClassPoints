import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useStudents } from '../useStudents';
import { queryKeys } from '../../lib/queryKeys';
import type { StudentWithPoints } from '../../types/transforms';

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
const STUDENT_ID = 'student-1';

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

describe('useStudents point_transactions realtime fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__useStudentsRealtimeHandlers = {};
    globalThis.__useStudentsRealtimeConfigs = {};
    mockStudentsOrder.mockResolvedValue({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  it('[P0][HIST.01-INT-02] invalidates students when point_transactions DELETE payload.old is primary-key only', async () => {
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useStudents(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    await waitFor(() => {
      expect(globalThis.__useStudentsRealtimeHandlers.point_transactions).toBeDefined();
    });

    expect(globalThis.__useStudentsRealtimeConfigs.point_transactions?.event).toBe('DELETE');
    invalidateSpy.mockClear();

    act(() => {
      globalThis.__useStudentsRealtimeHandlers.point_transactions?.({
        eventType: 'DELETE',
        new: null,
        old: { id: 'transaction-1' },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.students.byClassroom(CLASSROOM_ID),
    });
  });

  it('[P0][HIST.01-INT-02] invalidates students when point_transactions DELETE payload.old lacks created_at', async () => {
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useStudents(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    await waitFor(() => {
      expect(globalThis.__useStudentsRealtimeHandlers.point_transactions).toBeDefined();
    });

    expect(globalThis.__useStudentsRealtimeConfigs.point_transactions?.event).toBe('DELETE');
    invalidateSpy.mockClear();

    act(() => {
      globalThis.__useStudentsRealtimeHandlers.point_transactions?.({
        eventType: 'DELETE',
        new: null,
        old: { id: 'transaction-1', student_id: 'student-1', points: 2 },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.students.byClassroom(CLASSROOM_ID),
    });
  });

  it('[P0][HIST.01-INT-02] locally decrements totals when point_transactions DELETE payload.old has required fields', async () => {
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useStudents(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    await waitFor(() => {
      expect(globalThis.__useStudentsRealtimeHandlers.point_transactions).toBeDefined();
    });

    const listKey = queryKeys.students.byClassroom(CLASSROOM_ID);
    qc.setQueryData<StudentWithPoints[]>(listKey, [
      {
        id: STUDENT_ID,
        classroom_id: CLASSROOM_ID,
        name: 'Aaliyah',
        avatar_color: null,
        created_at: '2026-04-29T00:00:00.000Z',
        point_total: 5,
        positive_total: 5,
        negative_total: 0,
        today_total: 5,
        this_week_total: 5,
      },
    ]);

    invalidateSpy.mockClear();

    act(() => {
      globalThis.__useStudentsRealtimeHandlers.point_transactions?.({
        eventType: 'DELETE',
        new: null,
        old: {
          id: 'transaction-1',
          student_id: STUDENT_ID,
          points: 2,
          created_at: new Date().toISOString(),
        },
      });
    });

    expect(qc.getQueryData<StudentWithPoints[]>(listKey)?.[0]).toMatchObject({
      point_total: 3,
      positive_total: 3,
      negative_total: 0,
      today_total: 3,
      this_week_total: 3,
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: listKey });
  });
});
