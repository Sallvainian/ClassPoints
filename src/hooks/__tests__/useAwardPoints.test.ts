import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useAwardPoints } from '../useTransactions';
import { queryKeys } from '../../lib/queryKeys';
import type { Behavior } from '../../types';
import type { PointTransaction as DbPointTransaction } from '../../types/database';
import type { ClassroomWithCount, StudentSummary, StudentWithPoints } from '../../types/transforms';

// Configurable supabase mock — each test sets the .insert().select().single() outcome
// via mockInsertResponse before triggering mutate. useAwardPoints does not subscribe
// to realtime, so channel/removeChannel only need stub coverage.
const mockInsertResponse =
  vi.fn<() => Promise<{ data: DbPointTransaction | null; error: Error | null }>>();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => mockInsertResponse()),
        })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

const STUDENT_ID = 'student-1';
const CLASSROOM_ID = 'classroom-1';
const TIMESTAMP = 1_711_000_000_000;

const behavior: Behavior = {
  id: 'beh-1',
  name: 'Good listener',
  points: 1,
  icon: '👂',
  category: 'positive',
  isCustom: false,
  createdAt: 0,
};

const input = {
  studentId: STUDENT_ID,
  classroomId: CLASSROOM_ID,
  behavior,
  timestamp: TIMESTAMP,
};

const expectedOptimisticId = `optimistic-${STUDENT_ID}-${behavior.id}-${TIMESTAMP}`;

function makeStudentSummary(overrides: Partial<StudentSummary> = {}): StudentSummary {
  return {
    id: STUDENT_ID,
    name: 'Aaliyah',
    avatar_color: null,
    point_total: 0,
    positive_total: 0,
    negative_total: 0,
    today_total: 0,
    this_week_total: 0,
    ...overrides,
  };
}

function makeClassroom(overrides: Partial<ClassroomWithCount> = {}): ClassroomWithCount {
  return {
    id: CLASSROOM_ID,
    name: 'Test classroom',
    created_at: '2026-04-28T00:00:00Z',
    updated_at: '2026-04-28T00:00:00Z',
    user_id: 'user-1',
    student_count: 1,
    point_total: 0,
    positive_total: 0,
    negative_total: 0,
    student_summaries: [makeStudentSummary()],
    ...overrides,
  };
}

function makeStudent(overrides: Partial<StudentWithPoints> = {}): StudentWithPoints {
  return {
    id: STUDENT_ID,
    name: 'Aaliyah',
    classroom_id: CLASSROOM_ID,
    created_at: '2026-04-28T00:00:00Z',
    avatar_color: null,
    point_total: 0,
    positive_total: 0,
    negative_total: 0,
    today_total: 0,
    this_week_total: 0,
    ...overrides,
  };
}

function makeRealTransaction(overrides: Partial<DbPointTransaction> = {}): DbPointTransaction {
  return {
    id: 'real-1',
    student_id: STUDENT_ID,
    classroom_id: CLASSROOM_ID,
    behavior_id: behavior.id,
    behavior_name: behavior.name,
    behavior_icon: behavior.icon,
    points: behavior.points,
    note: null,
    batch_id: null,
    created_at: '2026-04-28T00:00:00Z',
    ...overrides,
  };
}

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

describe('useAwardPoints — ADR-005 §4 compliance regression guards', () => {
  beforeEach(() => {
    mockInsertResponse.mockReset();
  });

  // AWARD.01-UNIT-01 — ADR-005 §4(b): onMutate is pure + idempotent. Two mutate()
  // invocations with identical input must apply the optimistic patch exactly once;
  // the dedup guard at useTransactions.ts:138 detects the prior optimistic row and
  // short-circuits all three setQueryData patches on the second pass.
  describe('onMutate is idempotent (StrictMode-safe)', () => {
    it('[P0][AWARD.01-UNIT-01] applies the optimistic increment exactly once when mutate() runs twice with identical input', async () => {
      mockInsertResponse.mockResolvedValue({ data: makeRealTransaction(), error: null });
      const qc = makeClient();
      qc.setQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID), []);
      qc.setQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all, [makeClassroom()]);
      qc.setQueryData<StudentWithPoints[]>(queryKeys.students.byClassroom(CLASSROOM_ID), [
        makeStudent(),
      ]);

      const { result } = renderHook(() => useAwardPoints(), { wrapper: makeWrapper(qc) });

      await act(async () => {
        await result.current.mutateAsync(input);
        await result.current.mutateAsync(input);
      });

      const classrooms = qc.getQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all);
      expect(classrooms?.[0].point_total).toBe(behavior.points);
      expect(classrooms?.[0].positive_total).toBe(behavior.points);
      expect(classrooms?.[0].student_summaries[0].point_total).toBe(behavior.points);
      expect(classrooms?.[0].student_summaries[0].today_total).toBe(behavior.points);

      const students = qc.getQueryData<StudentWithPoints[]>(
        queryKeys.students.byClassroom(CLASSROOM_ID)
      );
      expect(students?.[0].point_total).toBe(behavior.points);

      const txs = qc.getQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID));
      const optimisticEntries = txs?.filter((t) => t.id === expectedOptimisticId) ?? [];
      expect(optimisticEntries).toHaveLength(1);
    });
  });

  // AWARD.01-UNIT-02 — ADR-005 §4(a) / R-05 score-9: `onError` rollback null-guards
  // `context?.previousX !== undefined`. When previous cache state was undefined,
  // the guard MUST skip the rollback rather than calling setQueryData(key, undefined),
  // which would wipe a key that just happened to be empty (worse than no rollback).
  describe('onError rollback null-guards context.previous*', () => {
    it('[P0][AWARD.01-UNIT-02] does NOT issue setQueryData(key, undefined) for keys whose previous state was undefined', async () => {
      mockInsertResponse.mockResolvedValue({ data: null, error: new Error('forced 4xx') });
      const qc = makeClient();
      // Seed transactions only. classroomsKey + studentsKey are deliberately
      // unseeded, so onMutate's getQueryData returns undefined for them.
      qc.setQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID), []);

      const setSpy = vi.spyOn(qc, 'setQueryData');

      const { result } = renderHook(() => useAwardPoints(), { wrapper: makeWrapper(qc) });

      await act(async () => {
        await expect(result.current.mutateAsync(input)).rejects.toThrow('forced 4xx');
      });

      const classroomRollbackCalls = setSpy.mock.calls.filter(
        ([key, value]) =>
          Array.isArray(key) && key[0] === 'classrooms' && key.length === 1 && value === undefined
      );
      expect(classroomRollbackCalls).toHaveLength(0);

      const studentRollbackCalls = setSpy.mock.calls.filter(
        ([key, value]) =>
          Array.isArray(key) &&
          key[0] === 'students' &&
          key[1] === CLASSROOM_ID &&
          value === undefined
      );
      expect(studentRollbackCalls).toHaveLength(0);

      // Sanity: the transactions key DID have a previous state (empty array), so the
      // rollback should have restored it. Confirms the guard is selective, not blanket-off.
      const txRollbackCalls = setSpy.mock.calls.filter(
        ([key, value]) =>
          Array.isArray(key) &&
          key[0] === 'transactions' &&
          key[1] === 'list' &&
          key[2] === CLASSROOM_ID &&
          Array.isArray(value) &&
          value.length === 0
      );
      expect(txRollbackCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // AWARD.01-UNIT-03 — ADR-005 §4(c) / R-11: deterministic optimistic id, NOT
  // crypto.randomUUID(). Format is `optimistic-{studentId}-{behaviorId}-{timestamp}`
  // so the dedup guard in §4(b) can match a duplicate invocation by id.
  describe('deterministic temp-row id format', () => {
    it('[P0][AWARD.01-UNIT-03] writes the optimistic transaction with id `optimistic-{studentId}-{behaviorId}-{timestamp}`', async () => {
      // Block the insert forever so the optimistic state stays observable; we only
      // need onMutate to have run, not the full mutation lifecycle.
      mockInsertResponse.mockImplementation(() => new Promise(() => {}));
      const qc = makeClient();
      qc.setQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID), []);

      const { result } = renderHook(() => useAwardPoints(), { wrapper: makeWrapper(qc) });

      void result.current.mutate(input);

      await waitFor(() => {
        const txs = qc.getQueryData<DbPointTransaction[]>(
          queryKeys.transactions.list(CLASSROOM_ID)
        );
        expect(txs?.length ?? 0).toBeGreaterThan(0);
      });

      const txs = qc.getQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID));
      expect(txs?.[0].id).toBe(expectedOptimisticId);
    });
  });

  // AWARD.01-UNIT-04 — ADR-005 §4(e): onMutate reads previous cache state via
  // qc.getQueryData(...), NOT a closure captured at hook-render time. A stale
  // closure would roll back to a state that no longer reflects what the user sees.
  describe('onMutate reads via qc.getQueryData, not closure', () => {
    it('[P0][AWARD.01-UNIT-04] rolls back to cache state captured at mutate-time, not at hook-render-time', async () => {
      mockInsertResponse.mockResolvedValue({ data: null, error: new Error('forced 4xx') });
      const qc = makeClient();
      // Hook-render-time state: empty list.
      qc.setQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID), []);

      const { result } = renderHook(() => useAwardPoints(), { wrapper: makeWrapper(qc) });

      // Mutate-time state: one pre-existing transaction (e.g., another tab pushed it
      // via realtime between render and tap). If onMutate captured the empty list at
      // render via closure, the rollback would wipe preExistingTx. The hook reads
      // from cache each invocation, so the rollback restores the new state.
      const preExistingTx = makeRealTransaction({ id: 'pre-existing-1' });
      qc.setQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID), [
        preExistingTx,
      ]);

      await act(async () => {
        await expect(result.current.mutateAsync(input)).rejects.toThrow('forced 4xx');
      });

      const txs = qc.getQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID));
      expect(txs).toEqual([preExistingTx]);
    });
  });
});
