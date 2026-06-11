import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
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

export function useStudents(
  classroomId: string | null
): UseQueryResult<StudentWithPoints[], Error> {
  const qc = useQueryClient();

  // §6: students table IS realtime per ADR-005. Phase 3 makes useStudents the
  // SINGLE owner — useClassrooms no longer subscribes (entry #4 RESOLVED).
  // Invalidate-not-merge: any students-table realtime event (INSERT/UPDATE/DELETE)
  // refetches the list rather than hand-merging the payload. The refetch re-reads
  // the authoritative all-time columns AND re-runs get_student_time_totals, so
  // every counter (all-time, today, week, roster) refreshes identically. The DB
  // trigger emits a students UPDATE on every point_transactions INSERT/DELETE
  // (011:45-47), so this one event covers cross-device awards, undos, and roster
  // changes. Also invalidate classrooms.all so cross-hook aggregates refresh.
  // The per-tap get_student_time_totals refetch cost is accepted (ADR-005 §7).
  // onReconnect runs the same refresh so events missed during a realtime drop
  // (CHANNEL_ERROR / TIMED_OUT / CLOSED → SUBSCRIBED) get a catch-up refetch —
  // this channel is now the sole cross-device refresh path.
  const refresh = () => {
    if (!classroomId) return;
    qc.invalidateQueries({ queryKey: queryKeys.students.byClassroom(classroomId) });
    qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
  };
  useRealtimeSubscription<DbStudent>({
    table: 'students',
    filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
    enabled: !!classroomId,
    onChange: refresh,
    onReconnect: refresh,
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

      const data = unwrap(
        await supabase
          .from('students')
          .select('*')
          .eq('classroom_id', classroomId)
          .order('name', { ascending: true })
      );

      const { startOfToday, startOfWeek } = getDateBoundaries();
      // Deliberately NOT unwrap(): this RPC is a non-fatal warn-and-fallback regime — totals degrade to 0 rather than failing the roster query.
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
      return unwrap(await supabase.from('students').insert(payload).select().single());
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
      const data = unwrap(await supabase.from('students').insert(payload).select());
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
      // Typed UpdateStudent payload per supabase-js RejectExcessProperties
      // (reference: src/hooks/useSeatingChart.ts).
      return unwrap(await supabase.from('students').update(updates).eq('id', id).select().single());
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
      unwrap(await supabase.from('students').delete().eq('id', id));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.students.all });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
    },
  });
}
