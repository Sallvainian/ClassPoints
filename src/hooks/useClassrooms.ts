import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Classroom, NewClassroom } from '../types/database';

interface UseClassroomsReturn {
  classrooms: Classroom[];
  loading: boolean;
  error: Error | null;
  createClassroom: (name: string) => Promise<Classroom | null>;
  updateClassroom: (id: string, updates: Partial<Classroom>) => Promise<Classroom | null>;
  deleteClassroom: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useClassrooms(): UseClassroomsReturn {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchClassrooms = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('classrooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(new Error(queryError.message));
      setClassrooms([]);
    } else {
      setClassrooms(data || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClassrooms();
  }, [fetchClassrooms]);

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

    setClassrooms((prev) => [data, ...prev]);
    return data;
  }, []);

  const updateClassroom = useCallback(
    async (id: string, updates: Partial<Classroom>): Promise<Classroom | null> => {
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
        prev.map((c) => (c.id === id ? data : c))
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
