import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useUndoableAction } from '../useUndoableAction';
import { queryKeys } from '../../lib/queryKeys';
import * as batchKindStore from '../../lib/batchKindStore';
import type { StudentWithPoints } from '../../types/transforms';
import type { PointTransaction as DbPointTransaction } from '../../types/database';

// useUndoableAction calls useTransactions + useStudents, both of which open
// realtime channels and a query. Stub the supabase client so neither hits the
// network; seeded cache data (with staleTime: Infinity) is what the hook reads.
// The underlying query hooks unwrap results via unwrap() from this module, so the
// factory spreads the REAL exports and overrides only the client. Env is stubbed
// BEFORE importOriginal — src/lib/supabase.ts throws at eval without creds (CI's
// Unit Tests step runs credless).
vi.mock('../../lib/supabase', async (importOriginal) => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-test-anon-key');
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
        })),
      })),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
      channel: vi.fn(() => {
        const channel = {
          on: vi.fn(() => channel),
          subscribe: vi.fn(() => channel),
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
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function txn(over: Partial<DbPointTransaction> = {}): DbPointTransaction {
  return {
    id: 't1',
    student_id: 's1',
    classroom_id: CLASSROOM_ID,
    behavior_id: 'b1',
    behavior_name: 'On Task',
    behavior_icon: '📚',
    points: 1,
    note: null,
    batch_id: null,
    created_at: new Date().toISOString(),
    ...over,
  } as DbPointTransaction;
}

function student(over: Partial<StudentWithPoints> = {}): StudentWithPoints {
  return {
    id: 's1',
    classroom_id: CLASSROOM_ID,
    name: 'Ada',
    avatar_color: null,
    point_total: 1,
    positive_total: 1,
    negative_total: 0,
    today_total: 1,
    this_week_total: 1,
    created_at: new Date().toISOString(),
    ...over,
  } as StudentWithPoints;
}

function seed(qc: QueryClient, transactions: DbPointTransaction[], students: StudentWithPoints[]) {
  qc.setQueryData(queryKeys.transactions.list(CLASSROOM_ID), transactions);
  qc.setQueryData(queryKeys.students.byClassroom(CLASSROOM_ID), students);
}

describe('useUndoableAction.getRecentUndoableAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchKindStore.clear();
  });

  afterEach(() => {
    batchKindStore.clear();
  });

  it('returns null when there are no transactions', () => {
    const qc = makeClient();
    seed(qc, [], []);
    const { result } = renderHook(() => useUndoableAction(CLASSROOM_ID), {
      wrapper: makeWrapper(qc),
    });
    expect(result.current.getRecentUndoableAction()).toBeNull();
  });

  it('returns the single-student action within the 10s window with the student name', () => {
    const qc = makeClient();
    seed(
      qc,
      [txn({ id: 't1', student_id: 's1', points: 2 })],
      [student({ id: 's1', name: 'Ada' })]
    );
    const { result } = renderHook(() => useUndoableAction(CLASSROOM_ID), {
      wrapper: makeWrapper(qc),
    });
    const action = result.current.getRecentUndoableAction();
    expect(action).toMatchObject({
      transactionId: 't1',
      studentName: 'Ada',
      behaviorName: 'On Task',
      points: 2,
      isBatch: false,
    });
  });

  it('falls back to "Unknown" when the student is not in cache', () => {
    const qc = makeClient();
    seed(qc, [txn({ id: 't1', student_id: 'ghost' })], []);
    const { result } = renderHook(() => useUndoableAction(CLASSROOM_ID), {
      wrapper: makeWrapper(qc),
    });
    expect(result.current.getRecentUndoableAction()?.studentName).toBe('Unknown');
  });

  it('returns null once the most recent transaction is older than the 10s window', () => {
    const qc = makeClient();
    const old = new Date(Date.now() - 11_000).toISOString();
    seed(qc, [txn({ id: 't1', created_at: old })], [student()]);
    const { result } = renderHook(() => useUndoableAction(CLASSROOM_ID), {
      wrapper: makeWrapper(qc),
    });
    expect(result.current.getRecentUndoableAction()).toBeNull();
  });

  it('labels a class batch "Entire Class" (default when untagged) and sums points', () => {
    const qc = makeClient();
    const batchId = 'batch-class';
    seed(
      qc,
      [
        txn({ id: 't1', student_id: 's1', batch_id: batchId, points: 1 }),
        txn({ id: 't2', student_id: 's2', batch_id: batchId, points: 1 }),
      ],
      [student({ id: 's1' }), student({ id: 's2', name: 'Bo' })]
    );
    batchKindStore.tag(batchId, 'class');
    const { result } = renderHook(() => useUndoableAction(CLASSROOM_ID), {
      wrapper: makeWrapper(qc),
    });
    expect(result.current.getRecentUndoableAction()).toMatchObject({
      batchId,
      studentName: 'Entire Class',
      points: 2,
      isBatch: true,
      isClassWide: true,
      studentCount: 2,
    });
  });

  it('labels a subset batch "N students" when tagged subset', () => {
    const qc = makeClient();
    const batchId = 'batch-subset';
    seed(
      qc,
      [
        txn({ id: 't1', student_id: 's1', batch_id: batchId, points: 2 }),
        txn({ id: 't2', student_id: 's2', batch_id: batchId, points: 2 }),
      ],
      [student({ id: 's1' }), student({ id: 's2', name: 'Bo' })]
    );
    batchKindStore.tag(batchId, 'subset');
    const { result } = renderHook(() => useUndoableAction(CLASSROOM_ID), {
      wrapper: makeWrapper(qc),
    });
    expect(result.current.getRecentUndoableAction()).toMatchObject({
      batchId,
      studentName: '2 students',
      points: 4,
      isBatch: true,
      isClassWide: false,
      studentCount: 2,
    });
  });

  it('falls back to "Entire Class" for an untagged batch (cross-device limitation)', () => {
    const qc = makeClient();
    const batchId = 'batch-untagged';
    seed(
      qc,
      [txn({ id: 't1', student_id: 's1', batch_id: batchId, points: 1 })],
      [student({ id: 's1' })]
    );
    // No batchKindStore.tag — simulates undo on a different device / after reload.
    const { result } = renderHook(() => useUndoableAction(CLASSROOM_ID), {
      wrapper: makeWrapper(qc),
    });
    expect(result.current.getRecentUndoableAction()).toMatchObject({
      studentName: 'Entire Class',
      isClassWide: true,
    });
  });
});
