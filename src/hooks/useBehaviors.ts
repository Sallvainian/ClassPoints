import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Behavior, NewBehavior, BehaviorCategory } from '../types/database';

interface UseBehaviorsReturn {
  behaviors: Behavior[];
  positiveBehaviors: Behavior[];
  negativeBehaviors: Behavior[];
  loading: boolean;
  error: Error | null;
  addBehavior: (behavior: Omit<NewBehavior, 'id' | 'created_at'>) => Promise<Behavior | null>;
  updateBehavior: (id: string, updates: Partial<Behavior>) => Promise<Behavior | null>;
  deleteBehavior: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useBehaviors(): UseBehaviorsReturn {
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBehaviors = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('behaviors')
      .select('*')
      .order('category', { ascending: true })
      .order('points', { ascending: false });

    if (queryError) {
      setError(new Error(queryError.message));
      setBehaviors([]);
    } else {
      setBehaviors(data || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBehaviors();
  }, [fetchBehaviors]);

  const addBehavior = useCallback(
    async (behavior: Omit<NewBehavior, 'id' | 'created_at'>): Promise<Behavior | null> => {
      const { data, error: insertError } = await supabase
        .from('behaviors')
        .insert(behavior)
        .select()
        .single();

      if (insertError) {
        setError(new Error(insertError.message));
        return null;
      }

      setBehaviors((prev) => [...prev, data]);
      return data;
    },
    []
  );

  const updateBehavior = useCallback(
    async (id: string, updates: Partial<Behavior>): Promise<Behavior | null> => {
      const { data, error: updateError } = await supabase
        .from('behaviors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        setError(new Error(updateError.message));
        return null;
      }

      setBehaviors((prev) => prev.map((b) => (b.id === id ? data : b)));
      return data;
    },
    []
  );

  const deleteBehavior = useCallback(async (id: string): Promise<boolean> => {
    const { error: deleteError } = await supabase
      .from('behaviors')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(new Error(deleteError.message));
      return false;
    }

    setBehaviors((prev) => prev.filter((b) => b.id !== id));
    return true;
  }, []);

  // Computed values
  const positiveBehaviors = behaviors.filter((b) => b.category === 'positive');
  const negativeBehaviors = behaviors.filter((b) => b.category === 'negative');

  return {
    behaviors,
    positiveBehaviors,
    negativeBehaviors,
    loading,
    error,
    addBehavior,
    updateBehavior,
    deleteBehavior,
    refetch: fetchBehaviors,
  };
}
