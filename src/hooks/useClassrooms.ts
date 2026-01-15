import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { getDateBoundaries } from '../utils/dateUtils';
import type { Classroom, NewClassroom, UpdateClassroom } from '../types/database';

// Student summary for dashboard display (minimal data for leaderboard)
// Includes time-based totals fetched via RPC for today/weekly leaderboards
export interface StudentSummary {
  id: string;
  name: string;
  avatar_color: string | null;
  point_total: number;
  positive_total: number;
  negative_total: number;
  today_total: number;
  this_week_total: number;
}

// Extended classroom type with student count and point totals
export interface ClassroomWithCount extends Classroom {
  student_count: number;
  point_total: number;
  positive_total: number;
  negative_total: number;
  student_summaries: StudentSummary[];
}

interface UseClassroomsReturn {
  classrooms: ClassroomWithCount[];
  loading: boolean;
  error: Error | null;
  createClassroom: (name: string) => Promise<Classroom | null>;
  updateClassroom: (id: string, updates: Partial<Classroom>) => Promise<Classroom | null>;
  deleteClassroom: (id: string) => Promise<boolean>;
  updateClassroomPointsOptimistically: (
    classroomId: string,
    studentId: string,
    points: number
  ) => void;
  refetch: () => Promise<void>;
}

export function useClassrooms(): UseClassroomsReturn {
  const [classrooms, setClassrooms] = useState<ClassroomWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchClassrooms = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Fetch classrooms with student count (parallel with student data)
    const [classroomsResult, studentsResult] = await Promise.all([
      supabase.from('classrooms').select('*, students(count)').order('name', { ascending: true }),
      // Fetch all students with stored point totals for dashboard leaderboard
      // Note: today_total and this_week_total require separate RPC call, so we set to 0 for dashboard
      supabase
        .from('students')
        .select(
          'id, classroom_id, name, avatar_color, point_total, positive_total, negative_total'
        ),
    ]);

    if (classroomsResult.error) {
      setError(new Error(classroomsResult.error.message));
      setClassrooms([]);
      setLoading(false);
      return;
    }

    // Fetch time-based totals for all classrooms in parallel
    const { startOfToday, startOfWeek } = getDateBoundaries();
    const classroomIds = (classroomsResult.data || []).map((c) => c.id);

    const timeTotalsPromises = classroomIds.map((classroomId) =>
      supabase.rpc('get_student_time_totals', {
        p_classroom_id: classroomId,
        p_start_of_today: startOfToday.toISOString(),
        p_start_of_week: startOfWeek.toISOString(),
      })
    );

    const timeTotalsResults = await Promise.all(timeTotalsPromises);

    // Create lookup map: studentId -> { today_total, this_week_total }
    const timeTotalsMap = new Map<string, { today: number; week: number }>();
    timeTotalsResults.forEach((result) => {
      (result.data || []).forEach(
        (row: { student_id: string; today_total: number; this_week_total: number }) => {
          timeTotalsMap.set(row.student_id, {
            today: row.today_total || 0,
            week: row.this_week_total || 0,
          });
        }
      );
    });

    // Group students by classroom and aggregate totals
    const classroomData = new Map<
      string,
      { total: number; positive: number; negative: number; students: StudentSummary[] }
    >();
    (studentsResult.data || []).forEach((s) => {
      const current = classroomData.get(s.classroom_id) || {
        total: 0,
        positive: 0,
        negative: 0,
        students: [],
      };
      current.total += s.point_total || 0;
      current.positive += s.positive_total || 0;
      current.negative += s.negative_total || 0;
      // Get time totals from RPC results
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

    // Map the response to include student_count, aggregated point totals, and student summaries
    const classroomsWithCount: ClassroomWithCount[] = (classroomsResult.data || []).map((c) => {
      const data = classroomData.get(c.id) || {
        total: 0,
        positive: 0,
        negative: 0,
        students: [],
      };
      return {
        id: c.id,
        name: c.name,
        created_at: c.created_at,
        updated_at: c.updated_at,
        user_id: c.user_id,
        student_count: (c.students as { count: number }[])?.[0]?.count ?? 0,
        point_total: data.total,
        positive_total: data.positive,
        negative_total: data.negative,
        student_summaries: data.students,
      };
    });
    setClassrooms(classroomsWithCount);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClassrooms();
  }, [fetchClassrooms]);

  // Real-time subscription for classroom changes
  useRealtimeSubscription<Classroom>({
    table: 'classrooms',
    onInsert: (classroom) => {
      setClassrooms((prev) => {
        // Avoid duplicates if we already added optimistically
        if (prev.some((c) => c.id === classroom.id)) return prev;
        // New classrooms start with 0 students and 0 points, insert in sorted order
        const newClassroom: ClassroomWithCount = {
          ...classroom,
          student_count: 0,
          point_total: 0,
          positive_total: 0,
          negative_total: 0,
          student_summaries: [],
        };
        return [...prev, newClassroom].sort((a, b) => a.name.localeCompare(b.name));
      });
    },
    onUpdate: (classroom) => {
      setClassrooms((prev) =>
        prev
          .map((c) =>
            c.id === classroom.id
              ? {
                  ...classroom,
                  student_count: c.student_count,
                  point_total: c.point_total,
                  positive_total: c.positive_total,
                  negative_total: c.negative_total,
                  student_summaries: c.student_summaries,
                }
              : c
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    },
    onDelete: ({ id }) => {
      setClassrooms((prev) => prev.filter((c) => c.id !== id));
    },
  });

  // Subscribe to student changes to update counts, point totals, and student summaries
  // Students now have stored point totals (maintained by DB trigger)
  useRealtimeSubscription<
    {
      id: string;
      classroom_id: string;
      name: string;
      avatar_color: string | null;
      point_total: number;
      positive_total: number;
      negative_total: number;
    },
    {
      id: string;
      classroom_id: string;
      name: string;
      avatar_color: string | null;
      point_total: number;
      positive_total: number;
      negative_total: number;
    }
  >({
    table: 'students',
    onInsert: (student) => {
      setClassrooms((prev) =>
        prev.map((c) =>
          c.id === student.classroom_id
            ? {
                ...c,
                student_count: c.student_count + 1,
                // Add new student's point totals to classroom (should be 0 for new students)
                point_total: c.point_total + (student.point_total || 0),
                positive_total: c.positive_total + (student.positive_total || 0),
                negative_total: c.negative_total + (student.negative_total || 0),
                // Add student to summaries
                student_summaries: [
                  ...c.student_summaries,
                  {
                    id: student.id,
                    name: student.name,
                    avatar_color: student.avatar_color,
                    point_total: student.point_total || 0,
                    positive_total: student.positive_total || 0,
                    negative_total: student.negative_total || 0,
                    today_total: 0, // Computed separately for active classroom
                    this_week_total: 0, // Computed separately for active classroom
                  },
                ],
              }
            : c
        )
      );
    },
    onUpdate: (student) => {
      // Student point totals changed (updated by DB trigger on transaction INSERT/DELETE)
      // Update in place to avoid flicker - don't refetch everything
      setClassrooms((prev) =>
        prev.map((c) => {
          if (c.id !== student.classroom_id) return c;

          // Find the old student to calculate delta
          const oldStudent = c.student_summaries.find((s) => s.id === student.id);
          const oldTotal = oldStudent?.point_total || 0;
          const oldPositive = oldStudent?.positive_total || 0;
          const oldNegative = oldStudent?.negative_total || 0;

          // Calculate deltas
          const totalDelta = (student.point_total || 0) - oldTotal;
          const positiveDelta = (student.positive_total || 0) - oldPositive;
          const negativeDelta = (student.negative_total || 0) - oldNegative;

          return {
            ...c,
            point_total: c.point_total + totalDelta,
            positive_total: c.positive_total + positiveDelta,
            negative_total: c.negative_total + negativeDelta,
            student_summaries: c.student_summaries.map((s) =>
              s.id === student.id
                ? {
                    ...s,
                    point_total: student.point_total || 0,
                    positive_total: student.positive_total || 0,
                    negative_total: student.negative_total || 0,
                    // Preserve time totals from initial load
                  }
                : s
            ),
          };
        })
      );
    },
    onDelete: (oldStudent) => {
      setClassrooms((prev) =>
        prev.map((c) =>
          c.id === oldStudent.classroom_id
            ? {
                ...c,
                student_count: Math.max(0, c.student_count - 1),
                // Subtract deleted student's point totals from classroom
                point_total: c.point_total - (oldStudent.point_total || 0),
                positive_total: c.positive_total - (oldStudent.positive_total || 0),
                negative_total: c.negative_total - (oldStudent.negative_total || 0),
                // Remove student from summaries
                student_summaries: c.student_summaries.filter((s) => s.id !== oldStudent.id),
              }
            : c
        )
      );
    },
  });

  // Note: point_transactions subscription removed - no longer needed
  // When transactions are inserted: optimistic updates handle UI immediately
  // When transactions are deleted (undo): DB trigger updates student totals →
  //   students subscription receives UPDATE → fetchClassrooms() is called

  const createClassroom = useCallback(async (name: string): Promise<Classroom | null> => {
    const newClassroom: NewClassroom = { name };

    const { data, error: insertError } = await supabase
      .from('classrooms')
      .insert(newClassroom)
      .select()
      .single();

    if (insertError) {
      setError(new Error(insertError.message));
      return null;
    }

    // New classrooms start with 0 students and 0 points, insert in sorted order
    const classroomWithCount: ClassroomWithCount = {
      ...data,
      student_count: 0,
      point_total: 0,
      positive_total: 0,
      negative_total: 0,
      student_summaries: [],
    };
    setClassrooms((prev) => {
      // Avoid duplicates if realtime subscription already added this classroom
      if (prev.some((c) => c.id === data.id)) return prev;
      return [...prev, classroomWithCount].sort((a, b) => a.name.localeCompare(b.name));
    });
    return data;
  }, []);

  const updateClassroom = useCallback(
    async (id: string, updates: UpdateClassroom): Promise<Classroom | null> => {
      const { data, error: updateError } = await supabase
        .from('classrooms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        setError(new Error(updateError.message));
        return null;
      }

      setClassrooms((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...data,
                student_count: c.student_count,
                point_total: c.point_total,
                positive_total: c.positive_total,
                negative_total: c.negative_total,
                student_summaries: c.student_summaries,
              }
            : c
        )
      );
      return data;
    },
    []
  );

  const deleteClassroom = useCallback(async (id: string): Promise<boolean> => {
    const { error: deleteError } = await supabase.from('classrooms').delete().eq('id', id);

    if (deleteError) {
      setError(new Error(deleteError.message));
      return false;
    }

    setClassrooms((prev) => prev.filter((c) => c.id !== id));
    return true;
  }, []);

  // Optimistically update classroom points AND student_summary before realtime event arrives
  // CRITICAL: Must update student_summaries so realtime delta calculation is 0 for our own changes
  const updateClassroomPointsOptimistically = useCallback(
    (classroomId: string, studentId: string, points: number) => {
      setClassrooms((prev) =>
        prev.map((c) =>
          c.id === classroomId
            ? {
                ...c,
                point_total: c.point_total + points,
                positive_total: points > 0 ? c.positive_total + points : c.positive_total,
                negative_total: points < 0 ? c.negative_total + points : c.negative_total,
                // Update student_summary so realtime delta = 0
                student_summaries: c.student_summaries.map((s) =>
                  s.id === studentId
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
              }
            : c
        )
      );
    },
    []
  );

  return {
    classrooms,
    loading,
    error,
    createClassroom,
    updateClassroom,
    deleteClassroom,
    updateClassroomPointsOptimistically,
    refetch: fetchClassrooms,
  };
}
