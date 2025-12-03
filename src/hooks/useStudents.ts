import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Student, NewStudent } from '../types/database';

interface UseStudentsReturn {
  students: Student[];
  loading: boolean;
  error: Error | null;
  addStudent: (classroomId: string, name: string, avatarColor?: string) => Promise<Student | null>;
  addStudents: (classroomId: string, names: string[]) => Promise<Student[]>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<Student | null>;
  removeStudent: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useStudents(classroomId: string | null): UseStudentsReturn {
  const [students, setStudents] = useState<Student[]>([]);
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
    } else {
      setStudents(data || []);
    }

    setLoading(false);
  }, [classroomId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const addStudent = useCallback(
    async (classroomId: string, name: string, avatarColor?: string): Promise<Student | null> => {
      const newStudent: NewStudent = {
        classroom_id: classroomId,
        name,
        avatar_color: avatarColor || null,
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

      setStudents((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    },
    []
  );

  const addStudents = useCallback(
    async (classroomId: string, names: string[]): Promise<Student[]> => {
      const newStudents: NewStudent[] = names.map((name) => ({
        classroom_id: classroomId,
        name,
        avatar_color: null,
      }));

      const { data, error: insertError } = await supabase
        .from('students')
        .insert(newStudents)
        .select();

      if (insertError) {
        setError(new Error(insertError.message));
        return [];
      }

      const inserted = data || [];
      setStudents((prev) =>
        [...prev, ...inserted].sort((a, b) => a.name.localeCompare(b.name))
      );
      return inserted;
    },
    []
  );

  const updateStudent = useCallback(
    async (id: string, updates: Partial<Student>): Promise<Student | null> => {
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

      setStudents((prev) =>
        prev.map((s) => (s.id === id ? data : s)).sort((a, b) => a.name.localeCompare(b.name))
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

  return {
    students,
    loading,
    error,
    addStudent,
    addStudents,
    updateStudent,
    removeStudent,
    refetch: fetchStudents,
  };
}
