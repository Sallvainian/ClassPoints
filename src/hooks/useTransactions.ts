import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import { MANUAL_ADJUSTMENT_NAME, MANUAL_ADJUSTMENT_ICON } from '../lib/manualAdjustmentConstants';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import {
  dbToPointTransaction,
  type ClassroomWithCount,
  type StudentWithPoints,
} from '../types/transforms';
import type {
  PointTransaction as DbPointTransaction,
  NewPointTransaction,
} from '../types/database';
import type { Behavior as AppBehavior } from '../types';

/**
 * Sentinel error thrown by `useAdjustStudentPoints` when the target equals the
 * current total (delta = 0). Wrappers discriminate on `err instanceof AdjustNoOpError`
 * — NOT a string match — so future error-message tweaks can't break the check.
 */
export class AdjustNoOpError extends Error {
  constructor() {
    super('useAdjustStudentPoints: no-op (delta=0)');
    this.name = 'AdjustNoOpError';
  }
}

export interface AwardPointsInput {
  studentId: string;
  classroomId: string;
  behavior: AppBehavior;
  note?: string | null;
  // Optional batch correlation id; award-to-students / award-class pass a shared id
  // so batch undo can match a cluster of inserts via the DB `batch_id` column.
  batchId?: string | null;
  // Caller-provided ms timestamp. Keeps the optimistic row id deterministic for
  // duplicate mutation invocations while staying distinct across separate taps.
  timestamp: number;
}

export interface BatchAwardInput {
  classroomId: string;
  // Shared batch correlation id stamped on every row, minted once per batch by
  // useBatchAward. Required (unlike the single-award case): undo groups on it.
  batchId: string;
  // Single ms timestamp shared by all rows; drives deterministic optimistic ids.
  timestamp: number;
  behavior: AppBehavior;
  note?: string | null;
  // One row per id. All rows carry the same behavior/batchId/timestamp.
  studentIds: string[];
}

interface AwardPointsContext {
  previousTransactions: DbPointTransaction[] | undefined;
  previousClassrooms: ClassroomWithCount[] | undefined;
  // Phase 3: useAwardPoints owns student-level optimism via the 3rd cache patch.
  previousStudents: StudentWithPoints[] | undefined;
}

export function useTransactions(
  classroomId: string | null
): UseQueryResult<DbPointTransaction[], Error> {
  const qc = useQueryClient();

  // §6: point_transactions IS a realtime domain (PRD FR5). Subscription stays.
  // onChange → invalidate per the Phase 1 transitional signature (Decision 3).
  useRealtimeSubscription<DbPointTransaction>({
    table: 'point_transactions',
    filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
    enabled: !!classroomId,
    onChange: () => {
      if (classroomId) {
        qc.invalidateQueries({ queryKey: queryKeys.transactions.list(classroomId) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
    },
  });

  return useQuery<DbPointTransaction[], Error>({
    queryKey: classroomId ? queryKeys.transactions.list(classroomId) : queryKeys.transactions.all,
    enabled: !!classroomId,
    queryFn: async () => {
      if (!classroomId) return [];
      const data = unwrap(
        await supabase
          .from('point_transactions')
          .select('*')
          .eq('classroom_id', classroomId)
          .order('created_at', { ascending: false })
      );
      return (data ?? []).map(dbToPointTransaction);
    },
  });
}

/**
 * Canonical Phase 2 optimistic mutation. Satisfies ADR-005 §4 (a)–(e):
 *   (a) null-guards `context.previous*` in `onError` — undefined post-cancel
 *       would overwrite the cache, worse than no rollback.
 *   (b) onMutate is pure + idempotent; deterministic optimistic id + dedup guard
 *       protect against duplicate mutation invocations.
 *   (c) temp row id is content-derived (studentId + behaviorId + caller timestamp);
 *       no `crypto.randomUUID()`.
 *   (d) explicit `onError` wired below — error surfaces via the caller's mutation
 *       state (`mutation.error` / `isError`), not silently.
 *   (e) reads previous cache state via `queryClient.getQueryData`, never from the
 *       component closure (which goes stale across re-renders).
 */
export function useAwardPoints() {
  const qc = useQueryClient();
  return useMutation<DbPointTransaction, Error, AwardPointsInput, AwardPointsContext>({
    mutationFn: async (input) => {
      const payload: NewPointTransaction = {
        student_id: input.studentId,
        classroom_id: input.classroomId,
        behavior_id: input.behavior.id,
        behavior_name: input.behavior.name,
        behavior_icon: input.behavior.icon,
        points: input.behavior.points,
        note: input.note ?? null,
        batch_id: input.batchId ?? null,
      };
      const data = unwrap(
        await supabase.from('point_transactions').insert(payload).select().single()
      );
      return dbToPointTransaction(data);
    },
    onMutate: async (input) => {
      const listKey = queryKeys.transactions.list(input.classroomId);
      const studentsKey = queryKeys.students.byClassroom(input.classroomId);
      await qc.cancelQueries({ queryKey: listKey });
      await qc.cancelQueries({ queryKey: queryKeys.classrooms.all });
      await qc.cancelQueries({ queryKey: studentsKey });

      // (e) read state from cache, not from closure
      const previousTransactions = qc.getQueryData<DbPointTransaction[]>(listKey);
      const previousClassrooms = qc.getQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all);
      const previousStudents = qc.getQueryData<StudentWithPoints[]>(studentsKey);

      // (c) deterministic temp id — same input → same id across duplicate invocations
      const optimisticId = `optimistic-${input.studentId}-${input.behavior.id}-${input.timestamp}`;

      // (b) idempotency guard: if onMutate double-fires for the same input, the
      // first invocation has already prepended the optimistic tx. Detecting that
      // here skips BOTH cache patches — without this, the classroom aggregate
      // `+ points` arithmetic would double-apply on the second invocation.
      const alreadyPatched = previousTransactions?.some((t) => t.id === optimisticId) ?? false;

      if (!alreadyPatched) {
        const optimisticTx: DbPointTransaction = {
          id: optimisticId,
          student_id: input.studentId,
          classroom_id: input.classroomId,
          behavior_id: input.behavior.id,
          behavior_name: input.behavior.name,
          behavior_icon: input.behavior.icon,
          points: input.behavior.points,
          note: input.note ?? null,
          batch_id: input.batchId ?? null,
          created_at: new Date(input.timestamp).toISOString(),
        };

        qc.setQueryData<DbPointTransaction[]>(listKey, (prev) =>
          prev ? [optimisticTx, ...prev] : [optimisticTx]
        );

        const points = input.behavior.points;
        qc.setQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all, (prev) => {
          if (!prev) return prev;
          return prev.map((c) => {
            if (c.id !== input.classroomId) return c;
            return {
              ...c,
              point_total: c.point_total + points,
              positive_total: points > 0 ? c.positive_total + points : c.positive_total,
              negative_total: points < 0 ? c.negative_total + points : c.negative_total,
              student_summaries: c.student_summaries.map((s) =>
                s.id === input.studentId
                  ? {
                      ...s,
                      point_total: s.point_total + points,
                      positive_total: points > 0 ? s.positive_total + points : s.positive_total,
                      negative_total: points < 0 ? s.negative_total + points : s.negative_total,
                      today_total: s.today_total + points,
                      this_week_total: s.this_week_total + points,
                    }
                  : s
              ),
            };
          });
        });

        // Phase 3: 3rd cache patch — students.byClassroom. Mirrors the per-student
        // arithmetic above, applied to the dedicated useStudents cache that
        // previously lived in component state behind a manual optimistic helper.
        // Skipped in the same alreadyPatched branch as the other two patches so
        // StrictMode double-invoke can't double-bump.
        qc.setQueryData<StudentWithPoints[]>(studentsKey, (prev) =>
          prev
            ? prev.map((s) =>
                s.id === input.studentId
                  ? {
                      ...s,
                      point_total: s.point_total + points,
                      positive_total: points > 0 ? s.positive_total + points : s.positive_total,
                      negative_total: points < 0 ? s.negative_total + points : s.negative_total,
                      today_total: s.today_total + points,
                      this_week_total: s.this_week_total + points,
                    }
                  : s
              )
            : prev
        );
      }

      return { previousTransactions, previousClassrooms, previousStudents };
    },
    // (a) null-guard context.previous — `undefined` after cancellation would wipe
    //     the cache on rollback, worse than leaving the optimistic write in place.
    // (d) explicit onError present → error surfaces via the caller's mutation state
    //     (`mutation.error` / `isError`); never silent.
    onError: (_err, input, context) => {
      if (context?.previousTransactions !== undefined) {
        qc.setQueryData(
          queryKeys.transactions.list(input.classroomId),
          context.previousTransactions
        );
      }
      if (context?.previousClassrooms !== undefined) {
        qc.setQueryData(queryKeys.classrooms.all, context.previousClassrooms);
      }
      if (context?.previousStudents !== undefined) {
        qc.setQueryData(
          queryKeys.students.byClassroom(input.classroomId),
          context.previousStudents
        );
      }
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.list(input.classroomId) });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
      qc.invalidateQueries({ queryKey: queryKeys.students.byClassroom(input.classroomId) });
    },
  });
}

/**
 * Atomic batch award (class-wide / multi-select subset). The all-or-nothing
 * counterpart to useAwardPoints: ONE multi-row INSERT so Postgres commits every
 * row or none — there is no partial outcome. The `011` totals trigger fires per
 * row inside that same transaction, so `students` totals commit/roll back with
 * the rows. Used only via useBatchAward; single-student award stays useAwardPoints.
 *
 * Satisfies ADR-005 §4 (a)–(e) as ONE batch-level lifecycle (§5 gates on "any
 * useMutation WITH onMutate"): one snapshot per cache, one N-row patch, one
 * null-guarded rollback, one getQueryData read per cache, deterministic ids.
 */
export function useAwardPointsBatch() {
  const qc = useQueryClient();
  return useMutation<DbPointTransaction[], Error, BatchAwardInput, AwardPointsContext>({
    mutationFn: async (input) => {
      const rows: NewPointTransaction[] = input.studentIds.map((studentId) => ({
        student_id: studentId,
        classroom_id: input.classroomId,
        behavior_id: input.behavior.id,
        behavior_name: input.behavior.name,
        behavior_icon: input.behavior.icon,
        points: input.behavior.points,
        note: input.note ?? null,
        batch_id: input.batchId,
      }));
      // ONE statement → atomic all-or-none. Bare `.select()`, NOT `.single()`:
      // N rows are expected, and `.single()` throws on count ≠ 1 (a manufactured
      // false-positive failure surface). unwrap() preserves the PostgREST error
      // metadata (Error instances rethrown by identity; plain literals hydrated
      // into a real PostgrestError): the SQLSTATE `.code` must survive for
      // useBatchAward's failure classification (SPEC §3) — never flatten it to
      // `new Error(error.message)`.
      const data = unwrap(await supabase.from('point_transactions').insert(rows).select());
      return (data ?? []).map(dbToPointTransaction);
    },
    onMutate: async (input) => {
      const listKey = queryKeys.transactions.list(input.classroomId);
      const studentsKey = queryKeys.students.byClassroom(input.classroomId);
      await qc.cancelQueries({ queryKey: listKey });
      await qc.cancelQueries({ queryKey: queryKeys.classrooms.all });
      await qc.cancelQueries({ queryKey: studentsKey });

      // (e) read state from cache, not from closure
      const previousTransactions = qc.getQueryData<DbPointTransaction[]>(listKey);
      const previousClassrooms = qc.getQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all);
      const previousStudents = qc.getQueryData<StudentWithPoints[]>(studentsKey);

      const points = input.behavior.points;

      // (b) batch-level idempotency guard: if onMutate double-fires (StrictMode /
      // double-submit), the first invocation already prepended the N optimistic
      // rows. Detecting the first id skips ALL patches so the aggregate arithmetic
      // can't double-apply. (c) deterministic id: optimistic-${batchId}-${studentId}.
      const firstId =
        input.studentIds.length > 0 ? `optimistic-${input.batchId}-${input.studentIds[0]}` : null;
      const alreadyPatched =
        firstId !== null && (previousTransactions?.some((t) => t.id === firstId) ?? false);

      if (!alreadyPatched && input.studentIds.length > 0) {
        const targeted = new Set(input.studentIds);
        const aggregateDelta = points * input.studentIds.length;

        const optimisticRows: DbPointTransaction[] = input.studentIds.map((studentId) => ({
          id: `optimistic-${input.batchId}-${studentId}`,
          student_id: studentId,
          classroom_id: input.classroomId,
          behavior_id: input.behavior.id,
          behavior_name: input.behavior.name,
          behavior_icon: input.behavior.icon,
          points,
          note: input.note ?? null,
          batch_id: input.batchId,
          created_at: new Date(input.timestamp).toISOString(),
        }));

        qc.setQueryData<DbPointTransaction[]>(listKey, (prev) =>
          prev ? [...optimisticRows, ...prev] : optimisticRows
        );

        qc.setQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all, (prev) => {
          if (!prev) return prev;
          return prev.map((c) => {
            if (c.id !== input.classroomId) return c;
            return {
              ...c,
              point_total: c.point_total + aggregateDelta,
              positive_total: points > 0 ? c.positive_total + aggregateDelta : c.positive_total,
              negative_total: points < 0 ? c.negative_total + aggregateDelta : c.negative_total,
              student_summaries: c.student_summaries.map((s) =>
                targeted.has(s.id)
                  ? {
                      ...s,
                      point_total: s.point_total + points,
                      positive_total: points > 0 ? s.positive_total + points : s.positive_total,
                      negative_total: points < 0 ? s.negative_total + points : s.negative_total,
                      today_total: s.today_total + points,
                      this_week_total: s.this_week_total + points,
                    }
                  : s
              ),
            };
          });
        });

        qc.setQueryData<StudentWithPoints[]>(studentsKey, (prev) =>
          prev
            ? prev.map((s) =>
                targeted.has(s.id)
                  ? {
                      ...s,
                      point_total: s.point_total + points,
                      positive_total: points > 0 ? s.positive_total + points : s.positive_total,
                      negative_total: points < 0 ? s.negative_total + points : s.negative_total,
                      today_total: s.today_total + points,
                      this_week_total: s.this_week_total + points,
                    }
                  : s
              )
            : prev
        );
      }

      return { previousTransactions, previousClassrooms, previousStudents };
    },
    // (a) null-guard context.previous — undefined post-cancellation would wipe the
    // cache. One whole-batch rollback replaces the prior N per-student rollbacks.
    onError: (_err, input, context) => {
      if (context?.previousTransactions !== undefined) {
        qc.setQueryData(
          queryKeys.transactions.list(input.classroomId),
          context.previousTransactions
        );
      }
      if (context?.previousClassrooms !== undefined) {
        qc.setQueryData(queryKeys.classrooms.all, context.previousClassrooms);
      }
      if (context?.previousStudents !== undefined) {
        qc.setQueryData(
          queryKeys.students.byClassroom(input.classroomId),
          context.previousStudents
        );
      }
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.list(input.classroomId) });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
      qc.invalidateQueries({ queryKey: queryKeys.students.byClassroom(input.classroomId) });
    },
  });
}

export function useUndoTransaction() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      unwrap(await supabase.from('point_transactions').delete().eq('id', id));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
      qc.invalidateQueries({ queryKey: queryKeys.students.all });
    },
  });
}

export function useClearStudentPoints() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (studentId) => {
      unwrap(await supabase.from('point_transactions').delete().eq('student_id', studentId));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
      qc.invalidateQueries({ queryKey: queryKeys.students.all });
    },
  });
}

export interface UndoBatchTransactionInput {
  batchId: string;
}

export function useUndoBatchTransaction() {
  const qc = useQueryClient();
  return useMutation<void, Error, UndoBatchTransactionInput>({
    mutationFn: async ({ batchId }) => {
      // Empty string or null batchId would silently no-op (.eq('batch_id', ''))
      // or mass-delete every single-student transaction (.eq('batch_id', null)).
      // Guard explicitly; wrappers should never reach this path, but defense in depth.
      if (!batchId) throw new Error('useUndoBatchTransaction: batchId required');
      const { error } = await supabase.from('point_transactions').delete().eq('batch_id', batchId);
      // Deliberate curated copy that REPLACES the PostgREST message (user-facing UX) — out of unwrap()'s scope.
      if (error) {
        throw new Error('Failed to undo class award. Please try again or refresh the page.');
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
      qc.invalidateQueries({ queryKey: queryKeys.students.all });
    },
  });
}

export interface ResetClassroomPointsInput {
  classroomId: string;
}

export function useResetClassroomPoints() {
  const qc = useQueryClient();
  return useMutation<void, Error, ResetClassroomPointsInput>({
    mutationFn: async ({ classroomId }) => {
      const { error } = await supabase
        .from('point_transactions')
        .delete()
        .eq('classroom_id', classroomId);
      // Deliberate curated copy that REPLACES the PostgREST message (user-facing UX) — out of unwrap()'s scope.
      if (error) throw new Error('Failed to reset points. Please try again.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
      qc.invalidateQueries({ queryKey: queryKeys.students.all });
    },
  });
}

export interface AdjustStudentPointsInput {
  classroomId: string;
  studentId: string;
  targetPoints: number;
  // Caller supplies the current total from its React closure. Do NOT read from
  // `qc.getQueryData` inside mutationFn — the cache may be mid-invalidate from
  // an unrelated mutation; the closure is the source of truth at call time.
  currentPointTotal: number;
  note?: string | null;
  behaviorName?: string;
  behaviorIcon?: string;
}

export function useAdjustStudentPoints() {
  const qc = useQueryClient();
  return useMutation<DbPointTransaction, Error, AdjustStudentPointsInput>({
    mutationFn: async (input) => {
      const delta = input.targetPoints - input.currentPointTotal;
      if (delta === 0) throw new AdjustNoOpError();

      const { data, error } = await supabase
        .from('point_transactions')
        .insert({
          student_id: input.studentId,
          classroom_id: input.classroomId,
          behavior_id: null,
          behavior_name: input.behaviorName ?? MANUAL_ADJUSTMENT_NAME,
          behavior_icon: input.behaviorIcon ?? MANUAL_ADJUSTMENT_ICON,
          points: delta,
          note: input.note ?? `Set points to ${input.targetPoints}`,
          batch_id: null,
        })
        .select()
        .single();

      // Deliberate curated copy that REPLACES the PostgREST message (user-facing UX) — out of unwrap()'s scope.
      if (error) throw new Error('Failed to adjust points. Please try again.');
      return dbToPointTransaction(data);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
      qc.invalidateQueries({ queryKey: queryKeys.students.all });
    },
  });
}
