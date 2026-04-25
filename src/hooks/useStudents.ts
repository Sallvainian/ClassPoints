import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { getRandomAvatarColor } from '../utils';
import { getDateBoundaries } from '../utils/dateUtils';
import { dbToStudent, type StudentWithPoints } from '../types/transforms';
import type { Student as DbStudent, NewStudent, UpdateStudent } from '../types/database';

// Re-export so hooks/index.ts can keep the public surface intact post-migration
// (the type itself was relocated to src/types/transforms.ts so dbToStudent and
// useAwardPoints can import it without going through the hook layer).
export type { StudentWithPoints };

interface TimeTotalsRow {
  student_id: string;
  today_total: number;
  this_week_total: number;
}

function sortByName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export function useStudents(
  classroomId: string | null
): UseQueryResult<StudentWithPoints[], Error> {
  const qc = useQueryClient();

  // §6: students table IS realtime per ADR-005. Phase 3 makes useStudents the
  // SINGLE owner — useClassrooms no longer subscribes (entry #4 RESOLVED).
  // Routing by event:
  //   INSERT → dedup-by-id append (await server row that already carries 0 totals).
  //   UPDATE → merge-patch the row, **preserving today_total / this_week_total**.
  //            DB trigger bumps lifetime totals on every point award; if we
  //            invalidated here, get_student_time_totals would re-fire on every
  //            tap. Time totals are kept fresh by:
  //              1. point_transactions DELETE realtime (decrements on undo)
  //              2. visibility-change handler (day-boundary)
  //              3. mutation onSettled invalidations (undo/clear/adjust/reset)
  //   DELETE → filter by id.
  // Every event also invalidates classrooms.all so cross-hook aggregates refresh.
  useRealtimeSubscription<DbStudent>({
    table: 'students',
    filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
    enabled: !!classroomId,
    onChange: (payload) => {
      if (!classroomId) return;
      const listKey = queryKeys.students.byClassroom(classroomId);

      if (payload.eventType === 'INSERT') {
        const incoming = payload.new as DbStudent;
        qc.setQueryData<StudentWithPoints[]>(listKey, (prev) => {
          const base = prev ?? [];
          if (base.some((s) => s.id === incoming.id)) return base;
          const next: StudentWithPoints = {
            ...incoming,
            point_total: incoming.point_total ?? 0,
            positive_total: incoming.positive_total ?? 0,
            negative_total: incoming.negative_total ?? 0,
            today_total: 0,
            this_week_total: 0,
          };
          return sortByName([...base, next]);
        });
      } else if (payload.eventType === 'UPDATE') {
        const incoming = payload.new as DbStudent;
        qc.setQueryData<StudentWithPoints[]>(listKey, (prev) =>
          prev
            ? sortByName(
                prev.map((s) =>
                  s.id === incoming.id
                    ? {
                        ...s,
                        // Lifetime totals from server (DB trigger updated them)
                        point_total: incoming.point_total ?? s.point_total,
                        positive_total: incoming.positive_total ?? s.positive_total,
                        negative_total: incoming.negative_total ?? s.negative_total,
                        // Other identity fields from server
                        name: incoming.name ?? s.name,
                        avatar_color: incoming.avatar_color ?? s.avatar_color,
                        // Time totals are preserved from optimistic updates above.
                        // They refresh on tab visibility change or full page reload.
                        today_total: s.today_total,
                        this_week_total: s.this_week_total,
                      }
                    : s
                )
              )
            : prev
        );
      } else if (payload.eventType === 'DELETE') {
        const removed = payload.old as { id: string };
        qc.setQueryData<StudentWithPoints[]>(listKey, (prev) =>
          prev ? prev.filter((s) => s.id !== removed.id) : prev
        );
      }

      // Cross-hook: classroom aggregates need a refresh on any students-row event.
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
    },
  });

  // ADR-005 §6: point_transactions is a realtime domain. The DELETE branch is
  // the cross-device undo time-totals propagation path (when device A undoes,
  // device B's today_total / this_week_total decrement here). INSERT events are
  // intentionally NOT handled — own-device awards already patched the cache via
  // useAwardPoints.onMutate, and cross-device INSERTs fall through to the
  // students-table UPDATE realtime path (DB trigger bumps lifetime columns).
  useRealtimeSubscription<
    { id: string; student_id: string; points: number; created_at: string },
    { id: string; student_id: string; points: number; created_at: string }
  >({
    table: 'point_transactions',
    filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
    enabled: !!classroomId,
    event: 'DELETE',
    onDelete: (oldTransaction) => {
      if (!classroomId) return;
      const listKey = queryKeys.students.byClassroom(classroomId);

      if (oldTransaction.student_id && oldTransaction.points !== undefined) {
        // REPLICA IDENTITY FULL (migration 005) gives us the row data we need
        // to decrement time-windowed totals locally without a refetch.
        const { startOfToday, startOfWeek } = getDateBoundaries();
        const createdAt = new Date(oldTransaction.created_at);
        const wasToday = createdAt >= startOfToday;
        const wasThisWeek = createdAt >= startOfWeek;

        qc.setQueryData<StudentWithPoints[]>(listKey, (prev) =>
          prev
            ? prev.map((s) =>
                s.id === oldTransaction.student_id
                  ? {
                      ...s,
                      // Lifetime totals decremented to mirror the DB trigger; the
                      // students realtime UPDATE will reconcile any drift.
                      point_total: s.point_total - oldTransaction.points,
                      positive_total:
                        oldTransaction.points > 0
                          ? s.positive_total - oldTransaction.points
                          : s.positive_total,
                      negative_total:
                        oldTransaction.points < 0
                          ? s.negative_total - oldTransaction.points
                          : s.negative_total,
                      today_total: wasToday ? s.today_total - oldTransaction.points : s.today_total,
                      this_week_total: wasThisWeek
                        ? s.this_week_total - oldTransaction.points
                        : s.this_week_total,
                    }
                  : s
              )
            : prev
        );
      } else {
        // Fallback: row data missing → refetch the whole list.
        qc.invalidateQueries({ queryKey: listKey });
      }
    },
  });

  // Visibility-change handler — day-boundary safety. Cross-midnight or
  // cross-Sunday transitions don't produce a realtime event, so an explicit
  // invalidation forces the RPC to refresh today_total / this_week_total.
  useEffect(() => {
    if (!classroomId) return;
    const listKey = queryKeys.students.byClassroom(classroomId);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        qc.invalidateQueries({ queryKey: listKey });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [classroomId, qc]);

  return useQuery<StudentWithPoints[], Error>({
    queryKey: queryKeys.students.byClassroom(classroomId),
    enabled: !!classroomId,
    queryFn: async () => {
      if (!classroomId) return [];

      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);

      const { startOfToday, startOfWeek } = getDateBoundaries();
      const { data: timeTotals, error: rpcError } = await supabase.rpc('get_student_time_totals', {
        p_classroom_id: classroomId,
        p_start_of_today: startOfToday.toISOString(),
        p_start_of_week: startOfWeek.toISOString(),
      });
      if (rpcError) {
        // Non-fatal: time totals fall back to 0; lifetime totals from columns are unaffected.
        console.warn('Failed to fetch time-based totals:', rpcError.message);
      }

      const timeTotalsMap = new Map<string, { today_total: number; this_week_total: number }>();
      ((timeTotals ?? []) as TimeTotalsRow[]).forEach((t) => {
        timeTotalsMap.set(t.student_id, {
          today_total: t.today_total,
          this_week_total: t.this_week_total,
        });
      });

      return (data ?? []).map((row) =>
        dbToStudent(row, timeTotalsMap.get(row.id) ?? { today_total: 0, this_week_total: 0 })
      );
    },
  });
}

// ============================================
// Mutations
// ============================================

export interface AddStudentInput {
  classroomId: string;
  name: string;
  avatarColor?: string;
}

export function useAddStudent() {
  const qc = useQueryClient();
  return useMutation<DbStudent, Error, AddStudentInput>({
    mutationFn: async (input) => {
      const payload: NewStudent = {
        classroom_id: input.classroomId,
        name: input.name,
        avatar_color: input.avatarColor ?? getRandomAvatarColor(),
      };
      const { data, error } = await supabase.from('students').insert(payload).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.students.byClassroom(input.classroomId) });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
    },
  });
}

export interface AddStudentsInput {
  classroomId: string;
  names: string[];
}

export function useAddStudents() {
  const qc = useQueryClient();
  return useMutation<DbStudent[], Error, AddStudentsInput>({
    mutationFn: async (input) => {
      const payload: NewStudent[] = input.names.map((name) => ({
        classroom_id: input.classroomId,
        name,
        avatar_color: getRandomAvatarColor(),
      }));
      const { data, error } = await supabase.from('students').insert(payload).select();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.students.byClassroom(input.classroomId) });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
    },
  });
}

export interface UpdateStudentInput {
  id: string;
  updates: UpdateStudent;
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation<DbStudent, Error, UpdateStudentInput>({
    mutationFn: async ({ id, updates }) => {
      // Typed UpdateStudent payload per supabase-js 2.104 RejectExcessProperties
      // (reference: src/hooks/useSeatingChart.ts).
      const { data, error } = await supabase
        .from('students')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSettled: () => {
      // Update doesn't carry classroomId in input; broader invalidation is acceptable
      // for a non-hot-path settings-level mutation.
      qc.invalidateQueries({ queryKey: queryKeys.students.all });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
    },
  });
}

export function useRemoveStudent() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.students.all });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
    },
  });
}
