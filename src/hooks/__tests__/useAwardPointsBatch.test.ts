import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useAwardPointsBatch } from '../useTransactions';
import { queryKeys } from '../../lib/queryKeys';
import type { Behavior } from '../../types';
import type { PointTransaction as DbPointTransaction } from '../../types/database';
import type { ClassroomWithCount, StudentSummary, StudentWithPoints } from '../../types/transforms';

// Configurable supabase mock — each test sets the .insert(rows).select() outcome via
// mockInsertResponse before triggering mutate. KEY DIFFERENCE from useAwardPoints:
// the batch mutationFn calls `.insert(rows).select()` WITHOUT `.single()` (SPEC §2 /
// constraint: ".select() WITHOUT .single() — N rows expected"), so .select() resolves
// the thenable DIRECTLY (an ARRAY of rows). No `.single` exists on the chain; if a
// future tidy-up re-adds `.select().single()`, calling .single() on this Promise
// throws and case 2 (array resolve) goes red — the mock shape itself pins the contract.
// data is an ARRAY; error carries an optional `.code` (PostgREST SQLSTATE) so case 1
// can assert the RAW error passes through with its code intact.
const mockInsertResponse =
  vi.fn<
    () => Promise<{ data: DbPointTransaction[] | null; error: (Error & { code?: string }) | null }>
  >();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => mockInsertResponse()),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

const CLASSROOM_ID = 'classroom-1';
const BATCH_ID = 'batch-abc';
const TIMESTAMP = 1_711_000_000_000;

const STUDENT_A = 'student-1';
const STUDENT_B = 'student-2';
const STUDENT_IDS = [STUDENT_A, STUDENT_B];
const N = STUDENT_IDS.length;

// P ≠ 0 and N ≥ 2 so the aggregate delta (P*N on classrooms.all.point_total) is
// distinguishable from the per-student delta (P on each summary / students.byClassroom row).
const behavior: Behavior = {
  id: 'beh-1',
  name: 'Good listener',
  points: 2,
  icon: '👂',
  category: 'positive',
  isCustom: false,
  createdAt: 0,
};
const P = behavior.points;

// BatchAwardInput shape (useTransactions.ts:42-53): { classroomId, batchId, timestamp,
// behavior, note?, studentIds[] } — batchId is REQUIRED (string), unlike the nullable
// single-award batchId. Built fresh; not reusing the single-student award input.
const input = {
  classroomId: CLASSROOM_ID,
  batchId: BATCH_ID,
  timestamp: TIMESTAMP,
  behavior,
  studentIds: STUDENT_IDS,
};

// (c) deterministic batch optimistic id: `optimistic-${batchId}-${studentId}`
// (useTransactions.ts:313) — NOT the single-award `optimistic-${studentId}-${behaviorId}-${timestamp}`.
const optimisticId = (studentId: string) => `optimistic-${BATCH_ID}-${studentId}`;

function makeStudentSummary(id: string, name: string): StudentSummary {
  return {
    id,
    name,
    avatar_color: null,
    point_total: 0,
    positive_total: 0,
    negative_total: 0,
    today_total: 0,
    this_week_total: 0,
  };
}

function makeClassroom(): ClassroomWithCount {
  return {
    id: CLASSROOM_ID,
    name: 'Test classroom',
    created_at: '2026-04-28T00:00:00Z',
    updated_at: '2026-04-28T00:00:00Z',
    user_id: 'user-1',
    student_count: N,
    point_total: 0,
    positive_total: 0,
    negative_total: 0,
    student_summaries: [
      makeStudentSummary(STUDENT_A, 'Aaliyah'),
      makeStudentSummary(STUDENT_B, 'Beatriz'),
    ],
  };
}

function makeStudent(id: string, name: string): StudentWithPoints {
  return {
    id,
    name,
    classroom_id: CLASSROOM_ID,
    created_at: '2026-04-28T00:00:00Z',
    avatar_color: null,
    point_total: 0,
    positive_total: 0,
    negative_total: 0,
    today_total: 0,
    this_week_total: 0,
  };
}

function makeStudents(): StudentWithPoints[] {
  return [makeStudent(STUDENT_A, 'Aaliyah'), makeStudent(STUDENT_B, 'Beatriz')];
}

function makeRealRow(studentId: string, id: string): DbPointTransaction {
  return {
    id,
    student_id: studentId,
    classroom_id: CLASSROOM_ID,
    behavior_id: behavior.id,
    behavior_name: behavior.name,
    behavior_icon: behavior.icon,
    points: behavior.points,
    note: null,
    batch_id: BATCH_ID,
    created_at: '2026-04-28T00:00:00Z',
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

describe('useAwardPointsBatch — CAP-1 / ADR-005 §4 atomic-batch contract guards', () => {
  beforeEach(() => {
    mockInsertResponse.mockReset();
  });

  // BATCH.01-UNIT-01 — CAP-1 / SPEC §2 / failure-handling §1: the mutationFn does
  // `if (error) throw error` (useTransactions.ts:282), throwing the RAW PostgREST error
  // rather than `new Error(error.message)`. The SQLSTATE `.code` (e.g. 23503 FK violation
  // from a concurrent student delete) MUST survive so useBatchAward's §3 failure
  // classification can discriminate per-row vs ambient causes. A "tidy-up" to
  // `new Error(error.message)` would strip `.code` and silently break that classification.
  describe('raw-error passthrough preserves SQLSTATE code', () => {
    it('[P0][BATCH.01-UNIT-01] rejects with the RAW error, preserving .code (SQLSTATE 23503)', async () => {
      const rawError = Object.assign(new Error('fk violation'), { code: '23503' });
      mockInsertResponse.mockResolvedValue({ data: null, error: rawError });
      const qc = makeClient();

      const { result } = renderHook(() => useAwardPointsBatch(), { wrapper: makeWrapper(qc) });

      // toMatchObject is unreliable against Error subclasses; catch-to-value and assert
      // the fields directly. `.code` is the load-bearing pin; `.message` proves it is the
      // original error object, not a re-wrapped `new Error(error.message)`.
      let caught: unknown;
      await act(async () => {
        caught = await result.current.mutateAsync(input).catch((e) => e);
      });

      expect((caught as Error & { code?: string }).code).toBe('23503');
      expect((caught as Error).message).toBe('fk violation');
    });
  });

  // BATCH.01-UNIT-02 — CAP-1 / SPEC §2 constraint: the bulk insert uses `.select()`
  // WITHOUT `.single()` (useTransactions.ts:281); N rows are expected and `.single()`
  // would manufacture a false-positive throw on count ≠ 1. On success the awaited
  // thenable resolves an ARRAY, and mutationFn maps each via dbToPointTransaction
  // (identity-spread) returning N rows. The mock chain has no `.single` at all, so if a
  // tidy-up re-adds `.select().single()` this test goes red on the missing method.
  describe('.select() without .single() resolves an array of N mapped rows', () => {
    it('[P0][BATCH.01-UNIT-02] resolves to N mapped DbPointTransaction objects from the array thenable', async () => {
      const rowA = makeRealRow(STUDENT_A, 'real-1');
      const rowB = makeRealRow(STUDENT_B, 'real-2');
      mockInsertResponse.mockResolvedValue({ data: [rowA, rowB], error: null });
      const qc = makeClient();

      const { result } = renderHook(() => useAwardPointsBatch(), { wrapper: makeWrapper(qc) });

      let resolved: DbPointTransaction[] | undefined;
      await act(async () => {
        resolved = await result.current.mutateAsync(input);
      });

      expect(resolved).toHaveLength(N);
      expect(resolved?.[0]).toEqual(rowA);
      expect(resolved?.[1]).toEqual(rowB);
    });
  });

  // BATCH.01-UNIT-03 — ADR-005 §4(c) / SPEC §5: ONE batch-level onMutate prepends N
  // optimistic rows (one per targeted student) with deterministic ids
  // `optimistic-${batchId}-${studentId}`, bumps classrooms.all by the aggregate P*N (and
  // each targeted student_summary by P), and bumps students.byClassroom per-student by P.
  // The insert is blocked on a never-resolving promise so the optimistic state stays
  // observable (mirrors useAwardPoints UNIT-03); awaiting a resolution would race onSettled.
  describe('optimistic onMutate: N rows + aggregate P*N + per-student P', () => {
    it('[P0][BATCH.01-UNIT-03] prepends N deterministic optimistic rows and applies aggregate (P*N) and per-student (P) deltas', async () => {
      mockInsertResponse.mockImplementation(() => new Promise(() => {}));
      const qc = makeClient();
      qc.setQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID), []);
      qc.setQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all, [makeClassroom()]);
      qc.setQueryData<StudentWithPoints[]>(
        queryKeys.students.byClassroom(CLASSROOM_ID),
        makeStudents()
      );

      const { result } = renderHook(() => useAwardPointsBatch(), { wrapper: makeWrapper(qc) });

      void result.current.mutate(input);

      await waitFor(() => {
        const txs = qc.getQueryData<DbPointTransaction[]>(
          queryKeys.transactions.list(CLASSROOM_ID)
        );
        expect(txs?.length ?? 0).toBe(N);
      });

      // (4c) N optimistic rows prepended, each id = optimistic-<batchId>-<studentId>.
      const txs = qc.getQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID));
      expect(txs?.map((t) => t.id)).toEqual([optimisticId(STUDENT_A), optimisticId(STUDENT_B)]);

      // classrooms.all: aggregate moved by P*N; each targeted student_summary by P.
      const classrooms = qc.getQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all);
      expect(classrooms?.[0].point_total).toBe(P * N);
      expect(classrooms?.[0].positive_total).toBe(P * N);
      expect(classrooms?.[0].student_summaries[0].point_total).toBe(P);
      expect(classrooms?.[0].student_summaries[1].point_total).toBe(P);
      expect(classrooms?.[0].student_summaries[0].today_total).toBe(P);

      // students.byClassroom: per-student totals moved by P.
      const students = qc.getQueryData<StudentWithPoints[]>(
        queryKeys.students.byClassroom(CLASSROOM_ID)
      );
      expect(students?.[0].point_total).toBe(P);
      expect(students?.[1].point_total).toBe(P);
    });
  });

  // BATCH.01-UNIT-04 — ADR-005 §4(b) / SPEC §5: the StrictMode idempotency guard moved
  // to batch level. `alreadyPatched` keys on optimistic-<batchId>-<firstStudentId>
  // (useTransactions.ts:303-306); two mutateAsync calls with the SAME batchId apply the
  // patch exactly ONCE. Without the guard, the aggregate P*N arithmetic would double-apply.
  describe('onMutate is idempotent at batch level (StrictMode-safe)', () => {
    it('[P0][BATCH.01-UNIT-04] applies the optimistic patch exactly once when mutate() runs twice with the same batchId', async () => {
      mockInsertResponse.mockResolvedValue({
        data: [makeRealRow(STUDENT_A, 'real-1'), makeRealRow(STUDENT_B, 'real-2')],
        error: null,
      });
      const qc = makeClient();
      qc.setQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID), []);
      qc.setQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all, [makeClassroom()]);
      qc.setQueryData<StudentWithPoints[]>(
        queryKeys.students.byClassroom(CLASSROOM_ID),
        makeStudents()
      );

      const { result } = renderHook(() => useAwardPointsBatch(), { wrapper: makeWrapper(qc) });

      await act(async () => {
        await result.current.mutateAsync(input);
        await result.current.mutateAsync(input);
      });

      // Aggregate moved by P*N once, NOT 2*P*N.
      const classrooms = qc.getQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all);
      expect(classrooms?.[0].point_total).toBe(P * N);
      expect(classrooms?.[0].student_summaries[0].point_total).toBe(P);
      expect(classrooms?.[0].student_summaries[1].point_total).toBe(P);

      const students = qc.getQueryData<StudentWithPoints[]>(
        queryKeys.students.byClassroom(CLASSROOM_ID)
      );
      expect(students?.[0].point_total).toBe(P);

      // Exactly N optimistic rows present, NOT 2N.
      const txs = qc.getQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID));
      const optimisticEntries =
        txs?.filter((t) => t.id.startsWith(`optimistic-${BATCH_ID}-`)) ?? [];
      expect(optimisticEntries).toHaveLength(N);
    });
  });

  // BATCH.01-UNIT-05 — ADR-005 §4(a) / SPEC §5: ONE null-guarded whole-batch rollback.
  // `onError` only restores keys whose `context.previous*` is defined
  // (useTransactions.ts:377-391); when classrooms.all + students.byClassroom were
  // unseeded, getQueryData returned undefined, and calling setQueryData(key, undefined)
  // would wipe a key that just happened to be empty (worse than no rollback). Only the
  // seeded transactions key must be restored. Mirrors useAwardPoints UNIT-02.
  describe('onError rollback null-guards context.previous*', () => {
    it('[P0][BATCH.01-UNIT-05] does NOT issue setQueryData(key, undefined) for keys whose previous state was undefined', async () => {
      mockInsertResponse.mockResolvedValue({ data: null, error: new Error('forced 4xx') });
      const qc = makeClient();
      // Seed transactions only. classroomsKey + studentsKey are deliberately unseeded,
      // so onMutate's getQueryData returns undefined for them.
      qc.setQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID), []);

      const setSpy = vi.spyOn(qc, 'setQueryData');

      const { result } = renderHook(() => useAwardPointsBatch(), { wrapper: makeWrapper(qc) });

      await act(async () => {
        await expect(result.current.mutateAsync(input)).rejects.toThrow('forced 4xx');
      });

      // onError must NOT roll the classrooms key back to undefined. (onMutate's
      // setQueryData(classroomsKey, updaterFn) passes a FUNCTION, not undefined, so it
      // cannot false-match this value===undefined filter.)
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
      // rollback restored it — confirms the guard is selective, not blanket-off.
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
});
