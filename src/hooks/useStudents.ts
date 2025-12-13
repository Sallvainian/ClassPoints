import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { getRandomAvatarColor } from '../utils';
import type { Student, NewStudent, UpdateStudent } from '../types/database';

// Extended student type with point totals
export interface StudentWithPoints extends Student {
  point_total: number;
  positive_total: number;
  negative_total: number;
  today_total: number;
  this_week_total: number;
}

interface UseStudentsReturn {
  students: StudentWithPoints[];
  loading: boolean;
  error: Error | null;
  addStudent: (classroomId: string, name: string, avatarColor?: string) => Promise<Student | null>;
  addStudents: (classroomId: string, names: string[]) => Promise<Student[]>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<Student | null>;
  removeStudent: (id: string) => Promise<boolean>;
  updateStudentPointsOptimistically: (studentId: string, points: number) => void;
  refetch: () => Promise<void>;
}

export function useStudents(classroomId: string | null): UseStudentsReturn {
  const [students, setStudents] = useState<StudentWithPoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStudents = useCallback(async () => {
    if (!classroomId) {
      setStudents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('students')
      .select('*')
      .eq('classroom_id', classroomId)
      .order('name', { ascending: true });

    if (queryError) {
      setError(new Error(queryError.message));
      setStudents([]);
      setLoading(false);
      return;
    }

    // Fetch all transactions for this classroom to calculate point totals per student
    const { data: transactionData } = await supabase
      .from('point_transactions')
      .select('student_id, points, created_at')
      .eq('classroom_id', classroomId);

    // Calculate time boundaries for today/this week
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
    startOfWeek.setHours(0, 0, 0, 0);

    // Calculate point totals per student (total, positive, negative, today, thisWeek)
    const pointTotals = new Map<string, { total: number; positive: number; negative: number; today: number; thisWeek: number }>();
    (transactionData || []).forEach((t) => {
      const current = pointTotals.get(t.student_id) || { total: 0, positive: 0, negative: 0, today: 0, thisWeek: 0 };
      current.total += t.points;
      if (t.points > 0) current.positive += t.points;
      if (t.points < 0) current.negative += t.points;

      const createdAt = new Date(t.created_at);
      if (createdAt >= startOfToday) current.today += t.points;
      if (createdAt >= startOfWeek) current.thisWeek += t.points;

      pointTotals.set(t.student_id, current);
    });

    // Map students with point totals
    const studentsWithPoints: StudentWithPoints[] = (data || []).map((s) => {
      const totals = pointTotals.get(s.id) || { total: 0, positive: 0, negative: 0, today: 0, thisWeek: 0 };
      return {
        ...s,
        point_total: totals.total,
        positive_total: totals.positive,
        negative_total: totals.negative,
        today_total: totals.today,
        this_week_total: totals.thisWeek,
      };
    });
    setStudents(studentsWithPoints);

    setLoading(false);
  }, [classroomId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Real-time subscription for student changes in this classroom
  useRealtimeSubscription<Student>({
    table: 'students',
    filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
    enabled: !!classroomId,
    onInsert: (student) => {
      setStudents((prev) => {
        // Avoid duplicates if we already added optimistically
        if (prev.some((s) => s.id === student.id)) return prev;
        // New students start with 0 points
        const studentWithPoints: StudentWithPoints = {
          ...student,
          point_total: 0,
          positive_total: 0,
          negative_total: 0,
          today_total: 0,
          this_week_total: 0,
        };
        return [...prev, studentWithPoints].sort((a, b) => a.name.localeCompare(b.name));
      });
    },
    onUpdate: (student) => {
      setStudents((prev) =>
        prev
          .map((s) =>
            s.id === student.id
              ? {
                  ...student,
                  point_total: s.point_total,
                  positive_total: s.positive_total,
                  negative_total: s.negative_total,
                  today_total: s.today_total,
                  this_week_total: s.this_week_total,
                }
              : s
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    },
    onDelete: ({ id }) => {
      setStudents((prev) => prev.filter((s) => s.id !== id));
    },
  });

  // Subscribe to point_transactions for DELETE events (undo)
  // Note: INSERT events are handled via optimistic updates in awardPoints/awardClassPoints
  // to avoid race conditions and double-counting
  useRealtimeSubscription<
    { id: string; student_id: string; points: number; created_at: string },
    { id: string; student_id: string; points: number; created_at: string }
  >({
    table: 'point_transactions',
    filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
    enabled: !!classroomId,
    // onInsert is intentionally omitted - we use optimistic updates instead
    onDelete: (oldTransaction) => {
      // If we have full row data (REPLICA IDENTITY FULL), update directly
      if (oldTransaction.student_id && oldTransaction.points !== undefined) {
        // Check if transaction was from today/this week
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const day = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
        startOfWeek.setHours(0, 0, 0, 0);

        const createdAt = new Date(oldTransaction.created_at);
        const wasToday = createdAt >= startOfToday;
        const wasThisWeek = createdAt >= startOfWeek;

        setStudents((prev) =>
          prev.map((s) =>
            s.id === oldTransaction.student_id
              ? {
                  ...s,
                  point_total: s.point_total - oldTransaction.points,
                  positive_total: oldTransaction.points > 0 ? s.positive_total - oldTransaction.points : s.positive_total,
                  negative_total: oldTransaction.points < 0 ? s.negative_total - oldTransaction.points : s.negative_total,
                  today_total: wasToday ? s.today_total - oldTransaction.points : s.today_total,
                  this_week_total: wasThisWeek ? s.this_week_total - oldTransaction.points : s.this_week_total,
                }
              : s
          )
        );
      } else {
        // Fallback: refetch all students if we don't have full row data
        fetchStudents();
      }
    },
  });

  const addStudent = useCallback(
    async (classroomId: string, name: string, avatarColor?: string): Promise<Student | null> => {
      const newStudent: NewStudent = {
        classroom_id: classroomId,
        name,
        avatar_color: avatarColor || getRandomAvatarColor(),
      };

      const { data, error: insertError } = await supabase
        .from('students')
        .insert(newStudent)
        .select()
        .single();

      if (insertError) {
        setError(new Error(insertError.message));
        return null;
      }

      // New students start with 0 points
      const studentWithPoints: StudentWithPoints = {
        ...data,
        point_total: 0,
        positive_total: 0,
        negative_total: 0,
        today_total: 0,
        this_week_total: 0,
      };
      setStudents((prev) => {
        // Avoid duplicates if realtime subscription already added this student
        if (prev.some((s) => s.id === data.id)) return prev;
        return [...prev, studentWithPoints].sort((a, b) => a.name.localeCompare(b.name));
      });
      return data;
    },
    []
  );

  const addStudents = useCallback(
    async (classroomId: string, names: string[]): Promise<Student[]> => {
      const newStudents: NewStudent[] = names.map((name) => ({
        classroom_id: classroomId,
        name,
        avatar_color: getRandomAvatarColor(),
      }));

      const { data, error: insertError } = await supabase
        .from('students')
        .insert(newStudents)
        .select();

      if (insertError) {
        setError(new Error(insertError.message));
        return [];
      }

      // New students start with 0 points
      const inserted: StudentWithPoints[] = (data || []).map((s) => ({
        ...s,
        point_total: 0,
        positive_total: 0,
        negative_total: 0,
        today_total: 0,
        this_week_total: 0,
      }));
      setStudents((prev) => {
        // Filter out any students that realtime subscription already added
        const newStudents = inserted.filter((newS) => !prev.some((s) => s.id === newS.id));
        if (newStudents.length === 0) return prev;
        return [...prev, ...newStudents].sort((a, b) => a.name.localeCompare(b.name));
      });
      return data || [];
    },
    []
  );

  const updateStudent = useCallback(
    async (id: string, updates: UpdateStudent): Promise<Student | null> => {
      const { data, error: updateError } = await supabase
        .from('students')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        setError(new Error(updateError.message));
        return null;
      }

      // Preserve point totals when updating student
      setStudents((prev) =>
        prev
          .map((s) =>
            s.id === id
              ? {
                  ...data,
                  point_total: s.point_total,
                  positive_total: s.positive_total,
                  negative_total: s.negative_total,
                  today_total: s.today_total,
                  this_week_total: s.this_week_total,
                }
              : s
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      return data;
    },
    []
  );

  const removeStudent = useCallback(async (id: string): Promise<boolean> => {
    const { error: deleteError } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(new Error(deleteError.message));
      return false;
    }

    setStudents((prev) => prev.filter((s) => s.id !== id));
    return true;
  }, []);

  // Optimistically update student points before realtime event arrives
  const updateStudentPointsOptimistically = useCallback(
    (studentId: string, points: number) => {
      setStudents((prev) =>
        prev.map((s) =>
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
        )
      );
    },
    []
  );

  return {
    students,
    loading,
    error,
    addStudent,
    addStudents,
    updateStudent,
    removeStudent,
    updateStudentPointsOptimistically,
    refetch: fetchStudents,
  };
}
