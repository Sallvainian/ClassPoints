import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import type { Classroom, NewClassroom, UpdateClassroom } from '../types/database';

// Extended classroom type with student count and point totals
export interface ClassroomWithCount extends Classroom {
  student_count: number;
  point_total: number;
  positive_total: number;
  negative_total: number;
}

interface UseClassroomsReturn {
  classrooms: ClassroomWithCount[];
  loading: boolean;
  error: Error | null;
  createClassroom: (name: string) => Promise<Classroom | null>;
  updateClassroom: (id: string, updates: Partial<Classroom>) => Promise<Classroom | null>;
  deleteClassroom: (id: string) => Promise<boolean>;
  updateClassroomPointsOptimistically: (classroomId: string, points: number) => void;
  setClassroomTotals: (
    classroomId: string,
    totals: { pointTotal: number; positiveTotal: number; negativeTotal: number }
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

    // Fetch classrooms with student count (parallel with student totals)
    const [classroomsResult, studentsResult] = await Promise.all([
      supabase.from('classrooms').select('*, students(count)').order('name', { ascending: true }),
      // Fetch all students with stored point totals for aggregation
      supabase.from('students').select('classroom_id, point_total, positive_total, negative_total'),
    ]);

    if (classroomsResult.error) {
      setError(new Error(classroomsResult.error.message));
      setClassrooms([]);
      setLoading(false);
      return;
    }

    // Aggregate student point totals by classroom
    const classroomTotals = new Map<
      string,
      { total: number; positive: number; negative: number }
    >();
    (studentsResult.data || []).forEach((s) => {
      const current = classroomTotals.get(s.classroom_id) || { total: 0, positive: 0, negative: 0 };
      classroomTotals.set(s.classroom_id, {
        total: current.total + (s.point_total || 0),
        positive: current.positive + (s.positive_total || 0),
        negative: current.negative + (s.negative_total || 0),
      });
    });

    // Map the response to include student_count and aggregated point totals
    const classroomsWithCount: ClassroomWithCount[] = (classroomsResult.data || []).map((c) => {
      const totals = classroomTotals.get(c.id) || { total: 0, positive: 0, negative: 0 };
      return {
        id: c.id,
        name: c.name,
        created_at: c.created_at,
        updated_at: c.updated_at,
        user_id: c.user_id,
        student_count: (c.students as { count: number }[])?.[0]?.count ?? 0,
        point_total: totals.total,
        positive_total: totals.positive,
        negative_total: totals.negative,
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
        const newClassroom = {
          ...classroom,
          student_count: 0,
          point_total: 0,
          positive_total: 0,
          negative_total: 0,
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

  // Subscribe to student changes to update counts and point totals
  // Students now have stored point totals (maintained by DB trigger)
  useRealtimeSubscription<
    {
      id: string;
      classroom_id: string;
      point_total: number;
      positive_total: number;
      negative_total: number;
    },
    {
      id: string;
      classroom_id: string;
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
              }
            : c
        )
      );
    },
    onUpdate: () => {
      // Student point totals changed (updated by DB trigger on transaction INSERT/DELETE)
      // Refetch to get accurate classroom totals
      // This is triggered when DB trigger updates student's stored totals
      fetchClassrooms();
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

  // Optimistically update classroom points before realtime event arrives
  const updateClassroomPointsOptimistically = useCallback((classroomId: string, points: number) => {
    setClassrooms((prev) =>
      prev.map((c) =>
        c.id === classroomId
          ? {
              ...c,
              point_total: c.point_total + points,
              positive_total: points > 0 ? c.positive_total + points : c.positive_total,
              negative_total: points < 0 ? c.negative_total + points : c.negative_total,
            }
          : c
      )
    );
  }, []);

  // Set absolute totals for a classroom (used to sync stale stored values with calculated values)
  const setClassroomTotals = useCallback(
    (
      classroomId: string,
      totals: { pointTotal: number; positiveTotal: number; negativeTotal: number }
    ) => {
      setClassrooms((prev) =>
        prev.map((c) =>
          c.id === classroomId
            ? {
                ...c,
                point_total: totals.pointTotal,
                positive_total: totals.positiveTotal,
                negative_total: totals.negativeTotal,
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
    setClassroomTotals,
    refetch: fetchClassrooms,
  };
}
