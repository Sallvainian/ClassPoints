import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { getDateBoundaries } from '../utils/dateUtils';
import { dbToClassroom, type ClassroomWithCount, type StudentSummary } from '../types/transforms';
import type {
  Classroom as DbClassroom,
  Student as DbStudent,
  NewClassroom,
  UpdateClassroom,
} from '../types/database';

// Re-exports preserved for Phase 0/1 consumers that imported these types from this module.
export type { ClassroomWithCount, StudentSummary };

export function useClassrooms(): UseQueryResult<ClassroomWithCount[], Error> {
  const qc = useQueryClient();

  // §6: classrooms table is non-realtime — no subscription here.
  // The `students`-table subscription is the cross-aggregate refresh trigger that
  // keeps classroom roll-ups fresh when another device's award lands on the server
  // (DB trigger bumps students.point_total → UPDATE event → invalidate). Phase 3
  // migrates useStudents and can relocate this upstream.
  useRealtimeSubscription<DbStudent>({
    table: 'students',
    onChange: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
    },
  });

  return useQuery<ClassroomWithCount[], Error>({
    queryKey: queryKeys.classrooms.all,
    queryFn: async () => {
      const [classroomsResult, studentsResult] = await Promise.all([
        supabase.from('classrooms').select('*, students(count)').order('name', { ascending: true }),
        supabase
          .from('students')
          .select(
            'id, classroom_id, name, avatar_color, point_total, positive_total, negative_total'
          ),
      ]);

      if (classroomsResult.error) throw new Error(classroomsResult.error.message);
      if (studentsResult.error) throw new Error(studentsResult.error.message);

      const { startOfToday, startOfWeek } = getDateBoundaries();
      const classroomIds = (classroomsResult.data ?? []).map((c) => c.id);

      const timeTotalsResults = await Promise.all(
        classroomIds.map((classroomId) =>
          supabase.rpc('get_student_time_totals', {
            p_classroom_id: classroomId,
            p_start_of_today: startOfToday.toISOString(),
            p_start_of_week: startOfWeek.toISOString(),
          })
        )
      );

      const timeTotalsMap = new Map<string, { today: number; week: number }>();
      timeTotalsResults.forEach((result) => {
        (result.data ?? []).forEach(
          (row: { student_id: string; today_total: number; this_week_total: number }) => {
            timeTotalsMap.set(row.student_id, {
              today: row.today_total || 0,
              week: row.this_week_total || 0,
            });
          }
        );
      });

      const classroomData = new Map<
        string,
        { total: number; positive: number; negative: number; students: StudentSummary[] }
      >();
      (studentsResult.data ?? []).forEach((s) => {
        const current = classroomData.get(s.classroom_id) || {
          total: 0,
          positive: 0,
          negative: 0,
          students: [],
        };
        current.total += s.point_total || 0;
        current.positive += s.positive_total || 0;
        current.negative += s.negative_total || 0;
        const timeTotals = timeTotalsMap.get(s.id);
        current.students.push({
          id: s.id,
          name: s.name,
          avatar_color: s.avatar_color,
          point_total: s.point_total || 0,
          positive_total: s.positive_total || 0,
          negative_total: s.negative_total || 0,
          today_total: timeTotals?.today || 0,
          this_week_total: timeTotals?.week || 0,
        });
        classroomData.set(s.classroom_id, current);
      });

      return (classroomsResult.data ?? []).map((c) => {
        const data = classroomData.get(c.id) || {
          total: 0,
          positive: 0,
          negative: 0,
          students: [],
        };
        return dbToClassroom(c, {
          studentCount: (c.students as { count: number }[] | undefined)?.[0]?.count ?? 0,
          pointTotal: data.total,
          positiveTotal: data.positive,
          negativeTotal: data.negative,
          studentSummaries: data.students,
        });
      });
    },
  });
}

export function useCreateClassroom() {
  const qc = useQueryClient();
  return useMutation<DbClassroom, Error, NewClassroom>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.from('classrooms').insert(input).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.classrooms.all }),
  });
}

interface UpdateClassroomInput {
  id: string;
  updates: UpdateClassroom;
}

export function useUpdateClassroom() {
  const qc = useQueryClient();
  return useMutation<DbClassroom, Error, UpdateClassroomInput>({
    mutationFn: async ({ id, updates }) => {
      // Typed UpdateClassroom payload per supabase-js 2.104 RejectExcessProperties
      // (reference: src/hooks/useSeatingChart.ts).
      const { data, error } = await supabase
        .from('classrooms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.classrooms.all }),
  });
}

export function useDeleteClassroom() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('classrooms').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.classrooms.all }),
  });
}
