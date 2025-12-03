import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import type { PointTransaction, NewPointTransaction, Behavior } from '../types/database';

interface StudentPoints {
  total: number;
  today: number;
  thisWeek: number;
}

interface UseTransactionsReturn {
  transactions: PointTransaction[];
  loading: boolean;
  error: Error | null;
  awardPoints: (
    studentId: string,
    classroomId: string,
    behavior: Behavior,
    note?: string
  ) => Promise<PointTransaction | null>;
  undoTransaction: (id: string) => Promise<boolean>;
  getStudentPoints: (studentId: string) => StudentPoints;
  getStudentTransactions: (studentId: string, limit?: number) => PointTransaction[];
  clearStudentPoints: (studentId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

// Helper to get start of today
function getStartOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

// Helper to get start of this week (Monday)
function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  now.setDate(diff);
  now.setHours(0, 0, 0, 0);
  return now;
}

export function useTransactions(classroomId: string | null): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!classroomId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(new Error(queryError.message));
      setTransactions([]);
    } else {
      setTransactions(data || []);
    }

    setLoading(false);
  }, [classroomId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Real-time subscription for transaction changes in this classroom
  useRealtimeSubscription<PointTransaction>({
    table: 'point_transactions',
    filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
    enabled: !!classroomId,
    onInsert: (transaction) => {
      setTransactions((prev) => {
        // Avoid duplicates if we already added optimistically
        if (prev.some((t) => t.id === transaction.id)) return prev;
        return [transaction, ...prev]; // Newest first
      });
    },
    onUpdate: (transaction) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === transaction.id ? transaction : t))
      );
    },
    onDelete: ({ id }) => {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    },
  });

  const awardPoints = useCallback(
    async (
      studentId: string,
      classroomId: string,
      behavior: Behavior,
      note?: string
    ): Promise<PointTransaction | null> => {
      const newTransaction: NewPointTransaction = {
        student_id: studentId,
        classroom_id: classroomId,
        behavior_id: behavior.id,
        behavior_name: behavior.name,
        behavior_icon: behavior.icon,
        points: behavior.points,
        note: note || null,
      };

      const { data, error: insertError } = await supabase
        .from('point_transactions')
        .insert(newTransaction)
        .select()
        .single();

      if (insertError) {
        setError(new Error(insertError.message));
        return null;
      }

      setTransactions((prev) => [data, ...prev]);
      return data;
    },
    []
  );

  const undoTransaction = useCallback(async (id: string): Promise<boolean> => {
    const { error: deleteError } = await supabase
      .from('point_transactions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(new Error(deleteError.message));
      return false;
    }

    setTransactions((prev) => prev.filter((t) => t.id !== id));
    return true;
  }, []);

  const getStudentPoints = useCallback(
    (studentId: string): StudentPoints => {
      const studentTransactions = transactions.filter((t) => t.student_id === studentId);

      const startOfToday = getStartOfToday();
      const startOfWeek = getStartOfWeek();

      const total = studentTransactions.reduce((sum, t) => sum + t.points, 0);
      const today = studentTransactions
        .filter((t) => new Date(t.created_at) >= startOfToday)
        .reduce((sum, t) => sum + t.points, 0);
      const thisWeek = studentTransactions
        .filter((t) => new Date(t.created_at) >= startOfWeek)
        .reduce((sum, t) => sum + t.points, 0);

      return { total, today, thisWeek };
    },
    [transactions]
  );

  const getStudentTransactions = useCallback(
    (studentId: string, limit?: number): PointTransaction[] => {
      const filtered = transactions.filter((t) => t.student_id === studentId);
      return limit ? filtered.slice(0, limit) : filtered;
    },
    [transactions]
  );

  const clearStudentPoints = useCallback(
    async (studentId: string): Promise<boolean> => {
      const { error: deleteError } = await supabase
        .from('point_transactions')
        .delete()
        .eq('student_id', studentId);

      if (deleteError) {
        setError(new Error(deleteError.message));
        return false;
      }

      setTransactions((prev) => prev.filter((t) => t.student_id !== studentId));
      return true;
    },
    []
  );

  return {
    transactions,
    loading,
    error,
    awardPoints,
    undoTransaction,
    getStudentPoints,
    getStudentTransactions,
    clearStudentPoints,
    refetch: fetchTransactions,
  };
}
