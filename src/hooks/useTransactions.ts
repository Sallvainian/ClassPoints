import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { dbToPointTransaction, type ClassroomWithCount } from '../types/transforms';
import type {
  PointTransaction as DbPointTransaction,
  NewPointTransaction,
} from '../types/database';
import type { Behavior as AppBehavior } from '../types';

export interface AwardPointsInput {
  studentId: string;
  classroomId: string;
  behavior: AppBehavior;
  note?: string | null;
  // Optional batch correlation id; award-to-students / award-class pass a shared id
  // so batch undo can match a cluster of inserts via the DB `batch_id` column.
  batchId?: string | null;
  // Caller-provided ms timestamp. Makes the optimistic row's id deterministic
  // across React StrictMode double-invokes of `onMutate` (ADR-005 §4c) while
  // staying distinct across separate user taps.
  timestamp: number;
}

interface AwardPointsContext {
  previousTransactions: DbPointTransaction[] | undefined;
  previousClassrooms: ClassroomWithCount[] | undefined;
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
      const { data, error } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(dbToPointTransaction);
    },
  });
}

/**
 * Canonical Phase 2 optimistic mutation. Satisfies ADR-005 §4 (a)–(e):
 *   (a) null-guards `context.previous*` in `onError` — undefined post-cancel
 *       would overwrite the cache, worse than no rollback.
 *   (b) onMutate is pure + idempotent; deterministic optimistic id + dedup guard
 *       protect against React StrictMode double-invoke in dev.
 *   (c) temp row id is content-derived (studentId + behaviorId + caller timestamp);
 *       no `crypto.randomUUID()`.
 *   (d) explicit `onError` wired below — error surfaces through AppContext (not silent).
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
      const { data, error } = await supabase
        .from('point_transactions')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return dbToPointTransaction(data);
    },
    onMutate: async (input) => {
      const listKey = queryKeys.transactions.list(input.classroomId);
      await qc.cancelQueries({ queryKey: listKey });
      await qc.cancelQueries({ queryKey: queryKeys.classrooms.all });

      // (e) read state from cache, not from closure
      const previousTransactions = qc.getQueryData<DbPointTransaction[]>(listKey);
      const previousClassrooms = qc.getQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all);

      // (c) deterministic temp id — same input → same id across StrictMode double-invoke
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
      }

      return { previousTransactions, previousClassrooms };
    },
    // (a) null-guard context.previous — `undefined` after cancellation would wipe
    //     the cache on rollback, worse than leaving the optimistic write in place.
    // (d) explicit onError present → error surfaces via AppContext.error; never silent.
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
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.list(input.classroomId) });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
    },
  });
}

export function useUndoTransaction() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('point_transactions').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
    },
  });
}

export function useClearStudentPoints() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (studentId) => {
      const { error } = await supabase
        .from('point_transactions')
        .delete()
        .eq('student_id', studentId);
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
    },
  });
}
