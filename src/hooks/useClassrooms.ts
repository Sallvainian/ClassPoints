import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import type { Classroom, NewClassroom, UpdateClassroom } from '../types/database';

// Extended classroom type with student count and point total
export interface ClassroomWithCount extends Classroom {
  student_count: number;
  point_total: number;
}

interface UseClassroomsReturn {
  classrooms: ClassroomWithCount[];
  loading: boolean;
  error: Error | null;
  createClassroom: (name: string) => Promise<Classroom | null>;
  updateClassroom: (id: string, updates: Partial<Classroom>) => Promise<Classroom | null>;
  deleteClassroom: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useClassrooms(): UseClassroomsReturn {
  const [classrooms, setClassrooms] = useState<ClassroomWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchClassrooms = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Fetch classrooms with student count using Supabase's nested select
    const { data, error: queryError } = await supabase
      .from('classrooms')
      .select('*, students(count)')
      .order('name', { ascending: true });

    if (queryError) {
      setError(new Error(queryError.message));
      setClassrooms([]);
      setLoading(false);
      return;
    }

    // Fetch all transactions to calculate point totals per classroom
    const { data: transactionData } = await supabase
      .from('point_transactions')
      .select('classroom_id, points');

    // Calculate point totals per classroom
    const pointTotals = new Map<string, number>();
    (transactionData || []).forEach((t) => {
      const current = pointTotals.get(t.classroom_id) || 0;
      pointTotals.set(t.classroom_id, current + t.points);
    });

    // Map the response to include student_count and point_total
    const classroomsWithCount: ClassroomWithCount[] = (data || []).map((c) => ({
      id: c.id,
      name: c.name,
      created_at: c.created_at,
      updated_at: c.updated_at,
      user_id: c.user_id,
      student_count: (c.students as { count: number }[])?.[0]?.count ?? 0,
      point_total: pointTotals.get(c.id) || 0,
    }));
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
        const newClassroom = { ...classroom, student_count: 0, point_total: 0 };
        return [...prev, newClassroom].sort((a, b) => a.name.localeCompare(b.name));
      });
    },
    onUpdate: (classroom) => {
      setClassrooms((prev) =>
        prev
          .map((c) =>
            c.id === classroom.id
              ? { ...classroom, student_count: c.student_count, point_total: c.point_total }
              : c
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    },
    onDelete: ({ id }) => {
      setClassrooms((prev) => prev.filter((c) => c.id !== id));
    },
  });

  // Also subscribe to student changes to update counts
  useRealtimeSubscription<
    { id: string; classroom_id: string },
    { id: string; classroom_id: string }
  >({
    table: 'students',
    onInsert: (student) => {
      setClassrooms((prev) =>
        prev.map((c) =>
          c.id === student.classroom_id ? { ...c, student_count: c.student_count + 1 } : c
        )
      );
    },
    onDelete: (oldStudent) => {
      setClassrooms((prev) =>
        prev.map((c) =>
          c.id === oldStudent.classroom_id ? { ...c, student_count: Math.max(0, c.student_count - 1) } : c
        )
      );
    },
  });

  // Subscribe to point_transactions to update point totals in real-time
  useRealtimeSubscription<
    { id: string; classroom_id: string; points: number },
    { id: string; classroom_id: string; points: number }
  >({
    table: 'point_transactions',
    onInsert: (transaction) => {
      setClassrooms((prev) =>
        prev.map((c) =>
          c.id === transaction.classroom_id
            ? { ...c, point_total: c.point_total + transaction.points }
            : c
        )
      );
    },
    onDelete: (oldTransaction) => {
      // If we have full row data (REPLICA IDENTITY FULL), update directly
      if (oldTransaction.classroom_id && oldTransaction.points !== undefined) {
        setClassrooms((prev) =>
          prev.map((c) =>
            c.id === oldTransaction.classroom_id
              ? { ...c, point_total: c.point_total - oldTransaction.points }
              : c
          )
        );
      } else {
        // Fallback: refetch all classrooms if we don't have full row data
        fetchClassrooms();
      }
    },
  });

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
    const classroomWithCount: ClassroomWithCount = { ...data, student_count: 0, point_total: 0 };
    setClassrooms((prev) => [...prev, classroomWithCount].sort((a, b) => a.name.localeCompare(b.name)));
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
          c.id === id ? { ...data, student_count: c.student_count, point_total: c.point_total } : c
        )
      );
      return data;
    },
    []
  );

  const deleteClassroom = useCallback(async (id: string): Promise<boolean> => {
    const { error: deleteError } = await supabase
      .from('classrooms')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(new Error(deleteError.message));
      return false;
    }

    setClassrooms((prev) => prev.filter((c) => c.id !== id));
    return true;
  }, []);

  return {
    classrooms,
    loading,
    error,
    createClassroom,
    updateClassroom,
    deleteClassroom,
    refetch: fetchClassrooms,
  };
}
