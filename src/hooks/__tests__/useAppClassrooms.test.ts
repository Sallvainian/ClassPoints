import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useActiveClassroom, useAppClassrooms } from '../useAppClassrooms';
import type { TimeTotalsRow } from '../../types/database';

// Closes IO-6 (the no-active-classroom no-hang guard dropped in the dissolve)
// and pins the deferred-#8 fan-out collapse (one batched totals RPC).
// `useActiveClassroom(null)` must leave the classroom-scoped student query
// disabled and resolve loading:false — never block boot on a classroom that
// doesn't exist. useStudents(null) is `enabled: false`, so no realtime channel
// is opened; that absence is what proves the scoped query stays disabled.
const mockChannel = vi.hoisted(() => vi.fn());

// Captured rpc handle + two-classroom fixture rows. ≥2 classrooms is what makes
// the called-once pin BITE: the legacy per-classroom get_student_time_totals
// fan-out called the rpc once per classroom (twice with this fixture), so
// toHaveBeenCalledTimes(1) genuinely pins the deferred-#8 collapse.
const fixtures = vi.hoisted(() => {
  const CLASSROOM_A = 'classroom-a';
  const CLASSROOM_B = 'classroom-b';
  const timestamps = {
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
  return {
    CLASSROOM_A,
    CLASSROOM_B,
    // Shape of `.select('*, students(count)')`: row columns + embed array.
    classroomRows: [
      {
        id: CLASSROOM_A,
        name: 'Class A',
        user_id: 'user-1',
        ...timestamps,
        students: [{ count: 1 }],
      },
      {
        id: CLASSROOM_B,
        name: 'Class B',
        user_id: 'user-1',
        ...timestamps,
        students: [{ count: 1 }],
      },
    ],
    studentRows: [
      {
        id: 'student-a1',
        classroom_id: CLASSROOM_A,
        name: 'Ann',
        avatar_color: '#ff0000',
        point_total: 5,
        positive_total: 5,
        negative_total: 0,
      },
      {
        id: 'student-b1',
        classroom_id: CLASSROOM_B,
        name: 'Ben',
        avatar_color: '#00ff00',
        point_total: 3,
        positive_total: 4,
        negative_total: -1,
      },
    ],
  };
});

// postgrest resolves {data, error} and never rejects — the signature models the
// error path explicitly so failure-mode tests need no type smuggling. Row shape
// is the hook's own TimeTotalsRow (derived from the generated Functions entry).
type MockRpcResult = {
  data: TimeTotalsRow[] | null;
  error: { message: string } | null;
};
const mockRpc = vi.hoisted(() =>
  vi.fn<() => Promise<MockRpcResult>>(() =>
    Promise.resolve({
      // Batched shape: (classroom_id, student_id, today_total, this_week_total)
      // for BOTH classrooms in one payload.
      data: [
        {
          classroom_id: 'classroom-a',
          student_id: 'student-a1',
          today_total: 2,
          this_week_total: 5,
        },
        {
          classroom_id: 'classroom-b',
          student_id: 'student-b1',
          today_total: 7,
          this_week_total: 9,
        },
      ],
      error: null,
    })
  )
);

// The wrapped hooks unwrap results via unwrap() from this module, so the factory
// spreads the REAL exports and overrides only the client. Env is stubbed BEFORE
// importOriginal — src/lib/supabase.ts throws at eval without creds (CI's Unit
// Tests step runs credless).
vi.mock('../../lib/supabase', async (importOriginal) => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-test-anon-key');
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  // Table-branching thenable chain: from('classrooms') resolves the two-row
  // fixture (with the students(count) embed shape), from('students') resolves
  // the aggregate roster, anything else resolves empty.
  const makeChain = (rows: unknown[]) => {
    const chain: Record<string, unknown> = {};
    const ret = () => chain;
    Object.assign(chain, {
      select: ret,
      eq: ret,
      order: ret,
      then: (onFulfilled: (v: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(onFulfilled),
    });
    return chain;
  };
  return {
    ...actual,
    supabase: {
      from: vi.fn((table: string) =>
        makeChain(
          table === 'classrooms'
            ? fixtures.classroomRows
            : table === 'students'
              ? fixtures.studentRows
              : []
        )
      ),
      rpc: mockRpc,
      channel: mockChannel,
      removeChannel: vi.fn(),
    },
  };
});

function makeClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('useActiveClassroom(null) — no active classroom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P2][IO-6] resolves loading:false with a null classroom (no boot hang)', async () => {
    const { result } = renderHook(() => useActiveClassroom(null), {
      wrapper: makeWrapper(makeClient()),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeClassroom).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('[P2][IO-6] never opens a realtime subscription when there is no active classroom', async () => {
    const { result } = renderHook(() => useActiveClassroom(null), {
      wrapper: makeWrapper(makeClient()),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // useStudents(null) is disabled; a regression that drops the `enabled` guard
    // would subscribe here.
    expect(mockChannel).not.toHaveBeenCalled();
  });
});

describe('useAppClassrooms — batched time-totals RPC (deferred #8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P0][BATCH8-UNIT-01] issues exactly ONE totals RPC for two classrooms and attributes per-classroom totals', async () => {
    const { result } = renderHook(() => useAppClassrooms(), {
      wrapper: makeWrapper(makeClient()),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();

    // THE pin: two classrooms, ONE batched call. The legacy per-classroom
    // fan-out calls the rpc once per classroom — twice with this fixture —
    // so this assertion fails against the old code.
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_student_time_totals_all_for_user', {
      p_start_of_today: expect.any(String),
      p_start_of_week: expect.any(String),
    });

    // Per-classroom attribution: each classroom's student summary carries the
    // totals keyed to ITS classroom_id from the single shared payload.
    const classA = result.current.classrooms.find((c) => c.id === fixtures.CLASSROOM_A);
    const classB = result.current.classrooms.find((c) => c.id === fixtures.CLASSROOM_B);
    expect(classA?.students[0]).toMatchObject({
      id: 'student-a1',
      todayTotal: 2,
      thisWeekTotal: 5,
    });
    expect(classB?.students[0]).toMatchObject({
      id: 'student-b1',
      todayTotal: 7,
      thisWeekTotal: 9,
    });
  });

  it('[P1][BATCH8-UNIT-02] warns and zero-fills totals when the batched RPC errors (non-fatal)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockRpc.mockResolvedValueOnce({
      // postgrest resolves {error}, never rejects.
      data: null,
      error: { message: 'function unavailable' },
    });

    const { result } = renderHook(() => useAppClassrooms(), {
      wrapper: makeWrapper(makeClient()),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Non-fatal warn-and-zero: classrooms render with lifetime totals intact,
    // time totals degrade to 0, one console.warn.
    expect(result.current.error).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to fetch time-based totals:',
      'function unavailable'
    );
    const classA = result.current.classrooms.find((c) => c.id === fixtures.CLASSROOM_A);
    expect(classA?.students[0]).toMatchObject({ pointTotal: 5, todayTotal: 0, thisWeekTotal: 0 });

    warnSpy.mockRestore();
  });
});
