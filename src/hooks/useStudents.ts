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

  // Helper to calculate date boundaries for today/this week
  const getDateBoundaries = useCallback(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
    startOfWeek.setHours(0, 0, 0, 0);
    return { startOfToday, startOfWeek };
  }, []);

  const fetchStudents = useCallback(async () => {
    if (!classroomId) {
      setStudents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Fetch students with stored lifetime totals (maintained by DB trigger)
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

    // Get date boundaries for today/week calculations
    const { startOfToday, startOfWeek } = getDateBoundaries();

    // Call RPC function to get today/this_week totals (only queries this week's transactions)
    const { data: timeTotals, error: rpcError } = await supabase.rpc('get_student_time_totals', {
      p_classroom_id: classroomId,
      p_start_of_today: startOfToday.toISOString(),
      p_start_of_week: startOfWeek.toISOString(),
    });

    if (rpcError) {
      // Non-fatal: fall back to 0 for time-based totals
      console.warn('Failed to fetch time-based totals:', rpcError.message);
    }

    // Create lookup map for time-based totals
    const timeTotalsMap = new Map<string, { today_total: number; this_week_total: number }>();
    (timeTotals || []).forEach(
      (t: { student_id: string; today_total: number; this_week_total: number }) => {
        timeTotalsMap.set(t.student_id, {
          today_total: t.today_total,
          this_week_total: t.this_week_total,
        });
      }
    );

    // Map students with stored lifetime totals + calculated time-based totals
    const studentsWithPoints: StudentWithPoints[] = (data || []).map((s) => {
      const timeTotals = timeTotalsMap.get(s.id) || { today_total: 0, this_week_total: 0 };
      return {
        ...s,
        // Lifetime totals from stored columns (maintained by DB trigger)
        point_total: s.point_total,
        positive_total: s.positive_total,
        negative_total: s.negative_total,
        // Time-based totals from RPC function
        today_total: timeTotals.today_total,
        this_week_total: timeTotals.this_week_total,
      };
    });
    setStudents(studentsWithPoints);

    setLoading(false);
  }, [classroomId, getDateBoundaries]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Real-time subscription for student changes in this classroom
  // Now includes stored point totals (maintained by DB trigger)
  useRealtimeSubscription<Student>({
    table: 'students',
    filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
    enabled: !!classroomId,
    onInsert: (student) => {
      setStudents((prev) => {
        // Avoid duplicates if we already added optimistically
        if (prev.some((s) => s.id === student.id)) return prev;
        // New students start with stored totals (should be 0 from DB)
        const studentWithPoints: StudentWithPoints = {
          ...student,
          // Use stored totals from DB (defaults to 0 for new students)
          point_total: student.point_total ?? 0,
          positive_total: student.positive_total ?? 0,
          negative_total: student.negative_total ?? 0,
          // Time-based totals start at 0 (will be updated on next fetch)
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
                  // Use stored lifetime totals from server (updated by DB trigger)
                  point_total: student.point_total ?? s.point_total,
                  positive_total: student.positive_total ?? s.positive_total,
                  negative_total: student.negative_total ?? s.negative_total,
                  // Preserve client-side time-based totals (optimistic updates)
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
  // Note: Lifetime totals (point_total, positive_total, negative_total) are now maintained by DB trigger
  // We still need to update time-based totals (today_total, this_week_total) on DELETE
  useRealtimeSubscription<
    { id: string; student_id: string; points: number; created_at: string },
    { id: string; student_id: string; points: number; created_at: string }
  >({
    table: 'point_transactions',
    filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
    enabled: !!classroomId,
    // onInsert is intentionally omitted - we use optimistic updates instead
    onDelete: (oldTransaction) => {
      // If we have full row data (REPLICA IDENTITY FULL), update time-based totals
      // Note: Lifetime totals are updated by DB trigger, we just need to update UI state
      if (oldTransaction.student_id && oldTransaction.points !== undefined) {
        const { startOfToday, startOfWeek } = getDateBoundaries();
        const createdAt = new Date(oldTransaction.created_at);
        const wasToday = createdAt >= startOfToday;
        const wasThisWeek = createdAt >= startOfWeek;

        setStudents((prev) =>
          prev.map((s) =>
            s.id === oldTransaction.student_id
              ? {
                  ...s,
                  // Lifetime totals: sync from optimistic update (DB trigger handles the real value)
                  // We subtract here to match the optimistic rollback pattern
                  point_total: s.point_total - oldTransaction.points,
                  positive_total:
                    oldTransaction.points > 0
                      ? s.positive_total - oldTransaction.points
                      : s.positive_total,
                  negative_total:
                    oldTransaction.points < 0
                      ? s.negative_total - oldTransaction.points
                      : s.negative_total,
                  // Time-based totals: update based on transaction date
                  today_total: wasToday ? s.today_total - oldTransaction.points : s.today_total,
                  this_week_total: wasThisWeek
                    ? s.this_week_total - oldTransaction.points
                    : s.this_week_total,
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

      // Use stored totals from DB (defaults to 0 for new students)
      const studentWithPoints: StudentWithPoints = {
        ...data,
        point_total: data.point_total ?? 0,
        positive_total: data.positive_total ?? 0,
        negative_total: data.negative_total ?? 0,
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

      // Use stored totals from DB (defaults to 0 for new students)
      const inserted: StudentWithPoints[] = (data || []).map((s) => ({
        ...s,
        point_total: s.point_total ?? 0,
        positive_total: s.positive_total ?? 0,
        negative_total: s.negative_total ?? 0,
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

      // Use stored lifetime totals from server, preserve time-based totals
      setStudents((prev) =>
        prev
          .map((s) =>
            s.id === id
              ? {
                  ...data,
                  // Use stored lifetime totals from DB
                  point_total: data.point_total ?? s.point_total,
                  positive_total: data.positive_total ?? s.positive_total,
                  negative_total: data.negative_total ?? s.negative_total,
                  // Preserve time-based totals (from client)
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
    const { error: deleteError } = await supabase.from('students').delete().eq('id', id);

    if (deleteError) {
      setError(new Error(deleteError.message));
      return false;
    }

    setStudents((prev) => prev.filter((s) => s.id !== id));
    return true;
  }, []);

  // Optimistically update student points before realtime event arrives
  const updateStudentPointsOptimistically = useCallback((studentId: string, points: number) => {
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
  }, []);

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
