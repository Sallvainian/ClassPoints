import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import {
  useClassrooms,
  useCreateClassroom,
  useUpdateClassroom,
  useDeleteClassroom,
} from '../hooks/useClassrooms';
import { useStudents } from '../hooks/useStudents';
import {
  useBehaviors,
  useAddBehavior,
  useUpdateBehavior,
  useDeleteBehavior,
} from '../hooks/useBehaviors';
import {
  useTransactions,
  useAwardPoints,
  useUndoTransaction,
  useClearStudentPoints,
} from '../hooks/useTransactions';
import type {
  Classroom as DbClassroom,
  Student as DbStudent,
  Behavior as DbBehavior,
  PointTransaction as DbPointTransaction,
  NewBehavior,
} from '../types/database';
import type {
  AppStudent,
  AppClassroom,
  AppBehavior,
  StudentPoints,
  UndoableAction,
} from '../types';

// Default behavior templates (module-level constant for stability)
const DEFAULT_BEHAVIORS: NewBehavior[] = [
  // Positive behaviors
  { name: 'On Task', points: 1, icon: '📚', category: 'positive', is_custom: false },
  { name: 'Helping Others', points: 2, icon: '🤝', category: 'positive', is_custom: false },
  { name: 'Great Effort', points: 2, icon: '💪', category: 'positive', is_custom: false },
  { name: 'Participation', points: 1, icon: '✋', category: 'positive', is_custom: false },
  { name: 'Excellent Work', points: 3, icon: '⭐', category: 'positive', is_custom: false },
  { name: 'Being Kind', points: 2, icon: '❤️', category: 'positive', is_custom: false },
  { name: 'Following Rules', points: 1, icon: '✅', category: 'positive', is_custom: false },
  { name: 'Working Quietly', points: 1, icon: '🤫', category: 'positive', is_custom: false },
  // Negative behaviors
  { name: 'Off Task', points: -1, icon: '😴', category: 'negative', is_custom: false },
  { name: 'Disruptive', points: -2, icon: '🔊', category: 'negative', is_custom: false },
  { name: 'Unprepared', points: -1, icon: '📝', category: 'negative', is_custom: false },
  { name: 'Unkind Words', points: -2, icon: '💬', category: 'negative', is_custom: false },
  { name: 'Not Following Rules', points: -1, icon: '🚫', category: 'negative', is_custom: false },
  { name: 'Late', points: -1, icon: '⏰', category: 'negative', is_custom: false },
];

// Manual adjustment constants
const MANUAL_ADJUSTMENT_NAME = 'Manual Adjustment';
const MANUAL_ADJUSTMENT_ICON = '✏️';

interface AppContextValue {
  // Loading states
  loading: boolean;
  error: Error | null;

  // State (using app-compatible types)
  classrooms: AppClassroom[];
  behaviors: AppBehavior[];
  transactions: DbPointTransaction[];
  activeClassroomId: string | null;
  activeClassroom: AppClassroom | null;
  students: AppStudent[];

  // Classroom operations
  createClassroom: (name: string) => Promise<DbClassroom | null>;
  updateClassroom: (id: string, updates: Partial<DbClassroom>) => Promise<void>;
  deleteClassroom: (id: string) => Promise<void>;
  setActiveClassroom: (id: string | null) => void;

  // Student operations
  addStudent: (classroomId: string, name: string) => Promise<DbStudent | null>;
  addStudents: (classroomId: string, names: string[]) => Promise<DbStudent[]>;
  updateStudent: (
    classroomId: string,
    studentId: string,
    updates: Partial<DbStudent>
  ) => Promise<void>;
  removeStudent: (classroomId: string, studentId: string) => Promise<void>;

  // Behavior operations
  addBehavior: (behavior: Omit<NewBehavior, 'id' | 'created_at'>) => Promise<AppBehavior | null>;
  updateBehavior: (id: string, updates: Partial<DbBehavior>) => Promise<void>;
  deleteBehavior: (id: string) => Promise<void>;
  resetBehaviorsToDefault: () => Promise<void>;

  // Point operations
  awardPoints: (
    classroomId: string,
    studentId: string,
    behaviorId: string,
    note?: string
  ) => Promise<DbPointTransaction | null>;
  awardClassPoints: (
    classroomId: string,
    behaviorId: string,
    note?: string
  ) => Promise<DbPointTransaction[]>;
  awardPointsToStudents: (
    classroomId: string,
    studentIds: string[],
    behaviorId: string,
    note?: string
  ) => Promise<DbPointTransaction[]>;
  undoTransaction: (transactionId: string) => Promise<void>;
  undoBatchTransaction: (batchId: string) => Promise<void>;
  getStudentPoints: (studentId: string) => StudentPoints;
  getClassPoints: (classroomId: string, studentIds?: string[]) => StudentPoints;
  getStudentTransactions: (studentId: string, limit?: number) => DbPointTransaction[];
  getClassroomTransactions: (classroomId: string, limit?: number) => DbPointTransaction[];
  getRecentUndoableAction: () => UndoableAction | null;
  clearStudentPoints: (classroomId: string, studentId: string) => Promise<void>;
  adjustStudentPoints: (
    classroomId: string,
    studentId: string,
    targetPoints: number,
    note?: string
  ) => Promise<DbPointTransaction | null>;
  resetClassroomPoints: (classroomId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const UNDO_WINDOW_MS = 10000; // 10 seconds for undo

const ACTIVE_CLASSROOM_STORAGE_KEY = 'app:activeClassroomId';

export function AppProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [activeClassroomId, setActiveClassroomId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACTIVE_CLASSROOM_STORAGE_KEY);
  });

  // Phase 2 adapter bridge: useClassrooms is now a TanStack Query wrapper; the three
  // classroom mutations are split hooks. AppContext reshapes the output to preserve
  // the legacy useApp() surface. The prior manual classroom-aggregate patch helper
  // was deleted — useAwardPoints.onMutate now owns that optimism.
  const classroomsQuery = useClassrooms();
  const createClassroomMutation = useCreateClassroom();
  const updateClassroomMutation = useUpdateClassroom();
  const deleteClassroomMutation = useDeleteClassroom();
  const classrooms = useMemo(() => classroomsQuery.data ?? [], [classroomsQuery.data]);
  const classroomsLoading = classroomsQuery.isPending;
  const classroomsError = classroomsQuery.error;

  const {
    students,
    loading: studentsLoading,
    error: studentsError,
    addStudent: addStudentHook,
    addStudents: addStudentsHook,
    updateStudent: updateStudentHook,
    removeStudent: removeStudentHook,
    updateStudentPointsOptimistically,
    refetch: refetchStudents,
  } = useStudents(activeClassroomId);

  // Phase 1 adapter bridge: useBehaviors is now a TanStack Query wrapper.
  const behaviorsQuery = useBehaviors();
  const addBehaviorMutation = useAddBehavior();
  const updateBehaviorMutation = useUpdateBehavior();
  const deleteBehaviorMutation = useDeleteBehavior();
  const behaviors = useMemo(() => behaviorsQuery.data ?? [], [behaviorsQuery.data]);
  const behaviorsLoading = behaviorsQuery.isPending;
  const behaviorsError = behaviorsQuery.error;
  const refetchBehaviors = behaviorsQuery.refetch;

  // Phase 2 adapter bridge: useTransactions is now a TanStack Query wrapper; the
  // four transaction mutations are split hooks. useAwardPoints is the canonical
  // optimistic-mutation showcase (ADR-005 §4 checklist inline in the hook).
  const transactionsQuery = useTransactions(activeClassroomId);
  const awardPointsMutation = useAwardPoints();
  const undoTransactionMutation = useUndoTransaction();
  const clearStudentPointsMutation = useClearStudentPoints();
  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);
  const transactionsLoading = transactionsQuery.isPending;
  const transactionsError = transactionsQuery.error;

  // Combined loading/error state
  const loading = classroomsLoading || studentsLoading || behaviorsLoading || transactionsLoading;
  const error = classroomsError || studentsError || behaviorsError || transactionsError;

  // ============================================
  // Classroom Operations
  // ============================================

  const createClassroom = useCallback(
    async (name: string): Promise<DbClassroom | null> => {
      const classroom = await createClassroomMutation.mutateAsync({ name });
      setActiveClassroomId(classroom.id);
      return classroom;
    },
    [createClassroomMutation]
  );

  const updateClassroom = useCallback(
    async (id: string, updates: Partial<DbClassroom>): Promise<void> => {
      await updateClassroomMutation.mutateAsync({ id, updates });
    },
    [updateClassroomMutation]
  );

  const deleteClassroom = useCallback(
    async (id: string): Promise<void> => {
      await deleteClassroomMutation.mutateAsync(id);
      if (activeClassroomId === id) {
        setActiveClassroomId(null);
      }
    },
    [deleteClassroomMutation, activeClassroomId]
  );

  const setActiveClassroom = useCallback((id: string | null) => {
    setActiveClassroomId(id);
    if (id) {
      window.localStorage.setItem(ACTIVE_CLASSROOM_STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(ACTIVE_CLASSROOM_STORAGE_KEY);
    }
  }, []);

  // ============================================
  // Student Operations
  // ============================================

  const addStudent = useCallback(
    async (classroomId: string, name: string): Promise<DbStudent | null> => {
      return await addStudentHook(classroomId, name);
    },
    [addStudentHook]
  );

  const addStudents = useCallback(
    async (classroomId: string, names: string[]): Promise<DbStudent[]> => {
      return await addStudentsHook(classroomId, names);
    },
    [addStudentsHook]
  );

  const updateStudent = useCallback(
    async (_classroomId: string, studentId: string, updates: Partial<DbStudent>): Promise<void> => {
      await updateStudentHook(studentId, updates);
    },
    [updateStudentHook]
  );

  const removeStudent = useCallback(
    async (_classroomId: string, studentId: string): Promise<void> => {
      await removeStudentHook(studentId);
    },
    [removeStudentHook]
  );

  // ============================================
  // Behavior Operations
  // ============================================

  // Adapter error contract (ADR-005 §2): each wrapper throws on Supabase failure.
  // The nullable return on addBehavior is reserved for "insert matched zero rows"
  // — unreachable while mutationFn uses `.single()` — preserved for the Phase 4
  // adapter dissolve (pure type narrowing).
  const addBehavior = useCallback(
    (behavior: Omit<NewBehavior, 'id' | 'created_at'>): Promise<AppBehavior | null> =>
      addBehaviorMutation.mutateAsync(behavior),
    [addBehaviorMutation]
  );

  const updateBehavior = useCallback(
    async (id: string, updates: Partial<DbBehavior>): Promise<void> => {
      await updateBehaviorMutation.mutateAsync({ id, updates });
    },
    [updateBehaviorMutation]
  );

  const deleteBehavior = useCallback(
    async (id: string): Promise<void> => {
      await deleteBehaviorMutation.mutateAsync(id);
    },
    [deleteBehaviorMutation]
  );

  const resetBehaviorsToDefault = useCallback(async (): Promise<void> => {
    // Delete all current behaviors for this user
    const { error: deleteError } = await supabase.from('behaviors').delete().not('id', 'is', null); // Delete all rows

    if (deleteError) {
      console.error('Error deleting behaviors:', deleteError);
      throw new Error('Failed to reset behaviors. Your custom behaviors were preserved.');
    }

    // Insert default behaviors
    const { error: insertError } = await supabase.from('behaviors').insert(DEFAULT_BEHAVIORS);

    if (insertError) {
      console.error('Error inserting default behaviors:', insertError);
      throw new Error('Failed to restore default behaviors. Please refresh the page.');
    }

    // Refetch behaviors to update state
    await refetchBehaviors();
  }, [refetchBehaviors]);

  // ============================================
  // Point Operations
  // ============================================

  const awardPoints = useCallback(
    async (
      classroomId: string,
      studentId: string,
      behaviorId: string,
      note?: string
    ): Promise<DbPointTransaction | null> => {
      const behavior = behaviors.find((b) => b.id === behaviorId);
      if (!behavior) return null;

      const pointsToAward = behavior.points;

      // Student-level optimism still lives in useStudents (Phase 3 target).
      // Classroom-level optimism is owned by useAwardPoints.onMutate (ADR-005 §4).
      updateStudentPointsOptimistically(studentId, pointsToAward);

      try {
        return await awardPointsMutation.mutateAsync({
          studentId,
          classroomId,
          behavior,
          note: note ?? null,
          timestamp: Date.now(),
        });
      } catch (err) {
        // Roll back the student-level optimistic patch; the mutation's onError
        // already restored the classroom-level one via its snapshot.
        updateStudentPointsOptimistically(studentId, -pointsToAward);
        throw err;
      }
    },
    [behaviors, awardPointsMutation, updateStudentPointsOptimistically]
  );

  const awardClassPoints = useCallback(
    async (
      classroomId: string,
      behaviorId: string,
      note?: string
    ): Promise<DbPointTransaction[]> => {
      const behavior = behaviors.find((b) => b.id === behaviorId);
      if (!behavior || students.length === 0) return [];

      const pointsPerStudent = behavior.points;
      const batchId = crypto.randomUUID();
      const timestamp = Date.now();

      // Student-level optimism remains in useStudents until Phase 3.
      students.forEach((student) => {
        updateStudentPointsOptimistically(student.id, pointsPerStudent);
      });

      // Each mutation owns its own classroom-aggregate optimism + rollback; a
      // per-student failure rolls back just that row. batch_id is preserved so
      // getRecentUndoableAction / undoBatchTransaction continue to see the cluster.
      const results = await Promise.all(
        students.map((student) =>
          awardPointsMutation
            .mutateAsync({
              studentId: student.id,
              classroomId,
              behavior,
              note: note ?? null,
              batchId,
              timestamp,
            })
            .catch((err) => {
              updateStudentPointsOptimistically(student.id, -pointsPerStudent);
              console.error('Error awarding class points:', err);
              return null;
            })
        )
      );

      return results.filter((r): r is DbPointTransaction => r !== null);
    },
    [behaviors, students, awardPointsMutation, updateStudentPointsOptimistically]
  );

  const awardPointsToStudents = useCallback(
    async (
      classroomId: string,
      studentIds: string[],
      behaviorId: string,
      note?: string
    ): Promise<DbPointTransaction[]> => {
      const behavior = behaviors.find((b) => b.id === behaviorId);
      if (!behavior || studentIds.length === 0) return [];

      const validStudents = students.filter((s) => studentIds.includes(s.id));
      if (validStudents.length === 0) return [];

      const pointsPerStudent = behavior.points;
      const batchId = crypto.randomUUID();
      const timestamp = Date.now();

      validStudents.forEach((student) => {
        updateStudentPointsOptimistically(student.id, pointsPerStudent);
      });

      const results = await Promise.all(
        validStudents.map((student) =>
          awardPointsMutation
            .mutateAsync({
              studentId: student.id,
              classroomId,
              behavior,
              note: note ?? null,
              batchId,
              timestamp,
            })
            .catch((err) => {
              updateStudentPointsOptimistically(student.id, -pointsPerStudent);
              console.error('Error awarding points to students:', err);
              return null;
            })
        )
      );

      return results.filter((r): r is DbPointTransaction => r !== null);
    },
    [behaviors, students, awardPointsMutation, updateStudentPointsOptimistically]
  );

  const undoTransaction = useCallback(
    async (transactionId: string): Promise<void> => {
      await undoTransactionMutation.mutateAsync(transactionId);
      // useStudents owns today_total/this_week_total via RPC (legacy hook, Phase 3
      // migration will dissolve this). Realtime DELETE handler is unreliable, so
      // force a fresh RPC fetch after undo so both the per-student and summed
      // class-level today counters reflect the delete.
      await refetchStudents();
    },
    [undoTransactionMutation, refetchStudents]
  );

  const undoBatchTransaction = useCallback(
    async (batchId: string): Promise<void> => {
      const { error: deleteError } = await supabase
        .from('point_transactions')
        .delete()
        .eq('batch_id', batchId);

      if (deleteError) {
        console.error('Error undoing batch transaction:', deleteError);
        throw new Error('Failed to undo class award. Please try again or refresh the page.');
      }

      await qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      await qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
      await refetchStudents();
    },
    [qc, refetchStudents]
  );

  const getStudentTransactions = useCallback(
    (studentId: string, limit?: number): DbPointTransaction[] => {
      const filtered = transactions.filter((t) => t.student_id === studentId);
      return limit ? filtered.slice(0, limit) : filtered;
    },
    [transactions]
  );

  const getClassroomTransactions = useCallback(
    (classroomId: string, limit?: number): DbPointTransaction[] => {
      const filtered = transactions.filter((t) => t.classroom_id === classroomId);
      return limit ? filtered.slice(0, limit) : filtered;
    },
    [transactions]
  );

  // Get student points from stored totals (students hook keeps them in sync via realtime).
  const getStudentPointsStored = useCallback(
    (studentId: string): StudentPoints => {
      const student = students.find((s) => s.id === studentId);
      if (!student) {
        return { total: 0, positiveTotal: 0, negativeTotal: 0, today: 0, thisWeek: 0 };
      }
      return {
        total: student.point_total,
        positiveTotal: student.positive_total,
        negativeTotal: student.negative_total,
        today: student.today_total,
        thisWeek: student.this_week_total,
      };
    },
    [students]
  );

  // Get aggregated class points (sum of student stored totals).
  const getClassPoints = useCallback(
    (_classroomId: string, studentIds?: string[]): StudentPoints => {
      if (studentIds && studentIds.length > 0) {
        let total = 0;
        let positiveTotal = 0;
        let negativeTotal = 0;
        let today = 0;
        let thisWeek = 0;
        for (const studentId of studentIds) {
          const pts = getStudentPointsStored(studentId);
          total += pts.total;
          positiveTotal += pts.positiveTotal;
          negativeTotal += pts.negativeTotal;
          today += pts.today;
          thisWeek += pts.thisWeek;
        }
        return { total, positiveTotal, negativeTotal, today, thisWeek };
      }
      return { total: 0, positiveTotal: 0, negativeTotal: 0, today: 0, thisWeek: 0 };
    },
    [getStudentPointsStored]
  );

  const getRecentUndoableAction = useCallback((): UndoableAction | null => {
    const now = Date.now();

    if (transactions.length === 0) return null;

    // Get most recent transaction
    const recent = transactions[0]; // Already sorted by created_at DESC
    const recentTimestamp = new Date(recent.created_at).getTime();

    // Check if within undo window
    if (now - recentTimestamp > UNDO_WINDOW_MS) return null;

    // Check if this is part of a batch (class-wide award)
    if (recent.batch_id) {
      const batchTransactions = transactions.filter((t) => t.batch_id === recent.batch_id);
      const transactionIds = batchTransactions.map((t) => t.id);
      const totalPoints = batchTransactions.reduce((sum, t) => sum + t.points, 0);

      return {
        transactionId: recent.id,
        transactionIds,
        batchId: recent.batch_id,
        studentName: 'Entire Class',
        behaviorName: recent.behavior_name,
        points: totalPoints,
        timestamp: recentTimestamp,
        isBatch: true,
        studentCount: batchTransactions.length,
      };
    }

    // Single student transaction
    const student = students.find((s) => s.id === recent.student_id);
    const studentName = student?.name || 'Unknown';

    return {
      transactionId: recent.id,
      studentName,
      behaviorName: recent.behavior_name,
      points: recent.points,
      timestamp: recentTimestamp,
      isBatch: false,
    };
  }, [transactions, students]);

  const clearStudentPoints = useCallback(
    async (_classroomId: string, studentId: string): Promise<void> => {
      await clearStudentPointsMutation.mutateAsync(studentId);
      await refetchStudents();
    },
    [clearStudentPointsMutation, refetchStudents]
  );

  // Adjust student points to a target value (creates a manual adjustment transaction).
  const adjustStudentPoints = useCallback(
    async (
      classroomId: string,
      studentId: string,
      targetPoints: number,
      note?: string
    ): Promise<DbPointTransaction | null> => {
      const student = students.find((s) => s.id === studentId);
      if (!student) {
        console.error('Student not found for adjustment:', studentId);
        return null;
      }

      const currentTotal = student.point_total || 0;
      const delta = targetPoints - currentTotal;

      if (delta === 0) return null;

      const { data, error: insertError } = await supabase
        .from('point_transactions')
        .insert({
          student_id: studentId,
          classroom_id: classroomId,
          behavior_id: null,
          behavior_name: MANUAL_ADJUSTMENT_NAME,
          behavior_icon: MANUAL_ADJUSTMENT_ICON,
          points: delta,
          note: note || `Set points to ${targetPoints}`,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error adjusting student points:', insertError);
        throw new Error('Failed to adjust points. Please try again.');
      }

      await qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      await qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });

      return data;
    },
    [students, qc]
  );

  const resetClassroomPoints = useCallback(
    async (classroomId: string): Promise<void> => {
      const { error: deleteError } = await supabase
        .from('point_transactions')
        .delete()
        .eq('classroom_id', classroomId);

      if (deleteError) {
        console.error('Error resetting classroom points:', deleteError);
        throw new Error('Failed to reset points. Please try again.');
      }

      await qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      await qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
      await refetchStudents();
    },
    [qc, refetchStudents]
  );

  // ============================================
  // Mapped values for backwards compatibility
  // ============================================

  const mappedClassrooms: AppClassroom[] = useMemo(() => {
    return classrooms.map((c) => {
      const summaryStudents: AppStudent[] = c.student_summaries.map((s) => ({
        id: s.id,
        name: s.name,
        avatarColor: s.avatar_color || undefined,
        pointTotal: s.point_total,
        positiveTotal: s.positive_total,
        negativeTotal: s.negative_total,
        todayTotal: s.today_total,
        thisWeekTotal: s.this_week_total,
      }));

      const isActive = c.id === activeClassroomId;

      const pointTotal = c.point_total;
      const positiveTotal = c.positive_total;
      const negativeTotal = c.negative_total;

      let todayTotal: number | undefined;
      let thisWeekTotal: number | undefined;

      const studentsMatchClassroom = students.length > 0 && students[0]?.classroom_id === c.id;

      if (isActive && studentsMatchClassroom) {
        todayTotal = students.reduce((sum, s) => sum + s.today_total, 0);
        thisWeekTotal = students.reduce((sum, s) => sum + s.this_week_total, 0);
      }

      return {
        id: c.id,
        name: c.name,
        students: summaryStudents,
        createdAt: new Date(c.created_at).getTime(),
        updatedAt: new Date(c.updated_at).getTime(),
        pointTotal,
        positiveTotal,
        negativeTotal,
        todayTotal,
        thisWeekTotal,
      };
    });
  }, [classrooms, activeClassroomId, students]);

  // Behaviors are already app-shape — transform runs inside the useBehaviors queryFn
  // via dbToBehavior. No intermediate remap needed.

  const mappedStudents: AppStudent[] = useMemo(() => {
    return students.map((s) => ({
      id: s.id,
      name: s.name,
      avatarColor: s.avatar_color || undefined,
      pointTotal: s.point_total,
      positiveTotal: s.positive_total,
      negativeTotal: s.negative_total,
      todayTotal: s.today_total,
      thisWeekTotal: s.this_week_total,
    }));
  }, [students]);

  const activeClassroom: AppClassroom | null = useMemo(() => {
    const classroom = mappedClassrooms.find((c) => c.id === activeClassroomId);
    if (!classroom) return null;

    const studentsMatchClassroom =
      students.length === 0 || students[0]?.classroom_id === activeClassroomId;

    const actualStudents = studentsMatchClassroom ? mappedStudents : [];

    return {
      ...classroom,
      students: actualStudents,
    };
  }, [mappedClassrooms, activeClassroomId, students, mappedStudents]);

  // ============================================
  // Context Value
  // ============================================

  const value: AppContextValue = {
    loading,
    error,

    classrooms: mappedClassrooms,
    behaviors,
    transactions,
    activeClassroomId,
    activeClassroom,
    students: mappedStudents,

    createClassroom,
    updateClassroom,
    deleteClassroom,
    setActiveClassroom,

    addStudent,
    addStudents,
    updateStudent,
    removeStudent,

    addBehavior,
    updateBehavior,
    deleteBehavior,
    resetBehaviorsToDefault,

    awardPoints,
    awardClassPoints,
    awardPointsToStudents,
    undoTransaction,
    undoBatchTransaction,
    getStudentPoints: getStudentPointsStored,
    getClassPoints,
    getStudentTransactions,
    getClassroomTransactions,
    getRecentUndoableAction,
    clearStudentPoints,
    adjustStudentPoints,
    resetClassroomPoints,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
