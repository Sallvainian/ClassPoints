import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useClassrooms } from '../hooks/useClassrooms';
import { useStudents } from '../hooks/useStudents';
import { useBehaviors } from '../hooks/useBehaviors';
import { useTransactions } from '../hooks/useTransactions';
import type {
  Classroom as DbClassroom,
  Student as DbStudent,
  Behavior as DbBehavior,
  PointTransaction as DbPointTransaction,
  NewBehavior,
  NewPointTransaction,
} from '../types/database';

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

// Types matching the original app interface (for backwards compatibility)
interface AppStudent {
  id: string;
  name: string;
  avatarColor?: string;
  pointTotal: number;
  positiveTotal: number;
  negativeTotal: number;
  todayTotal: number;
  thisWeekTotal: number;
}

interface AppClassroom {
  id: string;
  name: string;
  students: AppStudent[];
  createdAt: number;
  updatedAt: number;
  pointTotal?: number; // Pre-fetched total points for sidebar display
  positiveTotal?: number; // Total positive points
  negativeTotal?: number; // Total negative points
}

interface AppBehavior {
  id: string;
  name: string;
  points: number;
  icon: string;
  category: 'positive' | 'negative';
  isCustom: boolean;
  createdAt: number;
}

interface StudentPoints {
  total: number;
  positiveTotal: number;
  negativeTotal: number;
  today: number;
  thisWeek: number;
}

interface UndoableAction {
  transactionId: string;
  transactionIds?: string[]; // Multiple IDs for batch undo (class-wide awards)
  batchId?: string; // Batch identifier for grouped transactions
  studentName: string;
  behaviorName: string;
  points: number;
  timestamp: number;
  isBatch?: boolean; // True if this is a class-wide award
  studentCount?: number; // Number of students affected in batch
}

interface ClassPoints {
  total: number;
  positiveTotal: number;
  negativeTotal: number;
  today: number;
  thisWeek: number;
}

interface SupabaseAppContextValue {
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
  updateStudent: (classroomId: string, studentId: string, updates: Partial<DbStudent>) => Promise<void>;
  removeStudent: (classroomId: string, studentId: string) => Promise<void>;

  // Behavior operations
  addBehavior: (behavior: Omit<DbBehavior, 'id' | 'created_at'>) => Promise<DbBehavior | null>;
  updateBehavior: (id: string, updates: Partial<DbBehavior>) => Promise<void>;
  deleteBehavior: (id: string) => Promise<void>;
  resetBehaviorsToDefault: () => Promise<void>;

  // Point operations
  awardPoints: (classroomId: string, studentId: string, behaviorId: string, note?: string) => Promise<DbPointTransaction | null>;
  awardClassPoints: (classroomId: string, behaviorId: string, note?: string) => Promise<DbPointTransaction[]>;
  awardPointsToStudents: (classroomId: string, studentIds: string[], behaviorId: string, note?: string) => Promise<DbPointTransaction[]>;
  undoTransaction: (transactionId: string) => Promise<void>;
  undoBatchTransaction: (batchId: string) => Promise<void>;
  getStudentPoints: (studentId: string) => StudentPoints;
  getClassPoints: (classroomId: string, studentIds?: string[]) => ClassPoints;
  getStudentTransactions: (studentId: string, limit?: number) => DbPointTransaction[];
  getClassroomTransactions: (classroomId: string, limit?: number) => DbPointTransaction[];
  getRecentUndoableAction: () => UndoableAction | null;
  clearStudentPoints: (classroomId: string, studentId: string) => Promise<void>;
}

const SupabaseAppContext = createContext<SupabaseAppContextValue | null>(null);

const UNDO_WINDOW_MS = 10000; // 10 seconds for undo

export function SupabaseAppProvider({ children }: { children: ReactNode }) {
  const [activeClassroomId, setActiveClassroomId] = useState<string | null>(null);

  // Supabase hooks
  const {
    classrooms,
    loading: classroomsLoading,
    error: classroomsError,
    createClassroom: createClassroomHook,
    updateClassroom: updateClassroomHook,
    deleteClassroom: deleteClassroomHook,
    updateClassroomPointsOptimistically,
  } = useClassrooms();

  const {
    students,
    loading: studentsLoading,
    error: studentsError,
    addStudent: addStudentHook,
    addStudents: addStudentsHook,
    updateStudent: updateStudentHook,
    removeStudent: removeStudentHook,
    updateStudentPointsOptimistically,
  } = useStudents(activeClassroomId);

  const {
    behaviors,
    loading: behaviorsLoading,
    error: behaviorsError,
    addBehavior: addBehaviorHook,
    updateBehavior: updateBehaviorHook,
    deleteBehavior: deleteBehaviorHook,
    refetch: refetchBehaviors,
  } = useBehaviors();

  const {
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
    awardPoints: awardPointsHook,
    undoTransaction: undoTransactionHook,
    getStudentTransactions,
    clearStudentPoints: clearStudentPointsHook,
    refetch: refetchTransactions,
  } = useTransactions(activeClassroomId);

  // Combined loading/error state
  const loading = classroomsLoading || studentsLoading || behaviorsLoading || transactionsLoading;
  const error = classroomsError || studentsError || behaviorsError || transactionsError;

  // Active classroom with embedded students (matching old interface)
  const activeClassroom = useMemo(() => {
    const classroom = classrooms.find((c) => c.id === activeClassroomId);
    if (!classroom) return null;

    // Map Supabase students to old format with point totals and embed in classroom
    const mappedStudentsWithPoints: AppStudent[] = students.map((s) => ({
      id: s.id,
      name: s.name,
      avatarColor: s.avatar_color || undefined,
      pointTotal: s.point_total,
      positiveTotal: s.positive_total,
      negativeTotal: s.negative_total,
      todayTotal: s.today_total,
      thisWeekTotal: s.this_week_total,
    }));

    return {
      id: classroom.id,
      name: classroom.name,
      students: mappedStudentsWithPoints,
      createdAt: new Date(classroom.created_at).getTime(),
      updatedAt: new Date(classroom.updated_at).getTime(),
    };
  }, [classrooms, activeClassroomId, students]);

  // ============================================
  // Classroom Operations
  // ============================================

  const createClassroom = useCallback(
    async (name: string): Promise<DbClassroom | null> => {
      const classroom = await createClassroomHook(name);
      if (classroom) {
        setActiveClassroomId(classroom.id);
      }
      return classroom;
    },
    [createClassroomHook]
  );

  const updateClassroom = useCallback(
    async (id: string, updates: Partial<DbClassroom>): Promise<void> => {
      await updateClassroomHook(id, updates);
    },
    [updateClassroomHook]
  );

  const deleteClassroom = useCallback(
    async (id: string): Promise<void> => {
      await deleteClassroomHook(id);
      if (activeClassroomId === id) {
        setActiveClassroomId(null);
      }
    },
    [deleteClassroomHook, activeClassroomId]
  );

  const setActiveClassroom = useCallback((id: string | null) => {
    setActiveClassroomId(id);
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

  const addBehavior = useCallback(
    async (behavior: Omit<DbBehavior, 'id' | 'created_at'>): Promise<DbBehavior | null> => {
      return await addBehaviorHook(behavior);
    },
    [addBehaviorHook]
  );

  const updateBehavior = useCallback(
    async (id: string, updates: Partial<DbBehavior>): Promise<void> => {
      await updateBehaviorHook(id, updates);
    },
    [updateBehaviorHook]
  );

  const deleteBehavior = useCallback(
    async (id: string): Promise<void> => {
      await deleteBehaviorHook(id);
    },
    [deleteBehaviorHook]
  );

  const resetBehaviorsToDefault = useCallback(async (): Promise<void> => {
    // Delete all current behaviors for this user
    const { error: deleteError } = await supabase
      .from('behaviors')
      .delete()
      .not('id', 'is', null); // Delete all rows

    if (deleteError) {
      console.error('Error deleting behaviors:', deleteError);
      return;
    }

    // Insert default behaviors
    const { error: insertError } = await supabase
      .from('behaviors')
      .insert(DEFAULT_BEHAVIORS);

    if (insertError) {
      console.error('Error inserting default behaviors:', insertError);
      return;
    }

    // Refetch behaviors to update state
    refetchBehaviors();
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

      // Optimistically update student and classroom points before awaiting the transaction
      updateStudentPointsOptimistically(studentId, behavior.points);
      updateClassroomPointsOptimistically(classroomId, behavior.points);

      return await awardPointsHook(studentId, classroomId, behavior, note);
    },
    [behaviors, awardPointsHook, updateStudentPointsOptimistically, updateClassroomPointsOptimistically]
  );

  const awardClassPoints = useCallback(
    async (
      classroomId: string,
      behaviorId: string,
      note?: string
    ): Promise<DbPointTransaction[]> => {
      const behavior = behaviors.find((b) => b.id === behaviorId);
      if (!behavior || students.length === 0) return [];

      // Store rollback info before optimistic updates
      const pointsPerStudent = behavior.points;
      const totalPoints = pointsPerStudent * students.length;
      const affectedStudentIds = students.map((s) => s.id);

      // Optimistically update all students' and classroom points before awaiting the transaction
      students.forEach((student) => {
        updateStudentPointsOptimistically(student.id, pointsPerStudent);
      });
      updateClassroomPointsOptimistically(classroomId, totalPoints);

      // Generate a batch_id to group these transactions for undo
      const batchId = crypto.randomUUID();

      // Create transactions for all students in the classroom with shared batch_id
      const newTransactions: NewPointTransaction[] = students.map((student) => ({
        student_id: student.id,
        classroom_id: classroomId,
        behavior_id: behavior.id,
        behavior_name: behavior.name,
        behavior_icon: behavior.icon,
        points: behavior.points,
        note: note || null,
        batch_id: batchId,
      }));

      const { data, error: insertError } = await supabase
        .from('point_transactions')
        .insert(newTransactions)
        .select();

      if (insertError) {
        console.error('Error awarding class points:', insertError);

        // Rollback optimistic updates
        affectedStudentIds.forEach((studentId) => {
          updateStudentPointsOptimistically(studentId, -pointsPerStudent);
        });
        updateClassroomPointsOptimistically(classroomId, -totalPoints);

        throw new Error('Failed to award points to class. Please try again.');
      }

      // Refetch transactions to update state
      refetchTransactions();

      return data || [];
    },
    [behaviors, students, refetchTransactions, updateStudentPointsOptimistically, updateClassroomPointsOptimistically]
  );

  // Award points to specific students (atomic batch insert - all or nothing)
  const awardPointsToStudents = useCallback(
    async (
      classroomId: string,
      studentIds: string[],
      behaviorId: string,
      note?: string
    ): Promise<DbPointTransaction[]> => {
      const behavior = behaviors.find((b) => b.id === behaviorId);
      if (!behavior || studentIds.length === 0) return [];

      // Filter to only students that exist
      const validStudents = students.filter((s) => studentIds.includes(s.id));
      if (validStudents.length === 0) return [];

      // Store rollback info before optimistic updates
      const pointsPerStudent = behavior.points;
      const totalPoints = pointsPerStudent * validStudents.length;
      const affectedStudentIds = validStudents.map((s) => s.id);

      // Optimistically update all selected students' and classroom points
      validStudents.forEach((student) => {
        updateStudentPointsOptimistically(student.id, pointsPerStudent);
      });
      updateClassroomPointsOptimistically(classroomId, totalPoints);

      // Generate a batch_id to group these transactions for undo
      const batchId = crypto.randomUUID();

      // Create transactions for all selected students with shared batch_id (single atomic insert)
      const newTransactions: NewPointTransaction[] = validStudents.map((student) => ({
        student_id: student.id,
        classroom_id: classroomId,
        behavior_id: behavior.id,
        behavior_name: behavior.name,
        behavior_icon: behavior.icon,
        points: behavior.points,
        note: note || null,
        batch_id: batchId,
      }));

      // Single database call - atomic: either ALL rows insert or NONE
      const { data, error: insertError } = await supabase
        .from('point_transactions')
        .insert(newTransactions)
        .select();

      if (insertError) {
        console.error('Error awarding points to students:', insertError);

        // Rollback optimistic updates
        affectedStudentIds.forEach((studentId) => {
          updateStudentPointsOptimistically(studentId, -pointsPerStudent);
        });
        updateClassroomPointsOptimistically(classroomId, -totalPoints);

        throw new Error('Failed to award points to selected students. Please try again.');
      }

      // Refetch transactions to update state
      refetchTransactions();

      return data || [];
    },
    [behaviors, students, refetchTransactions, updateStudentPointsOptimistically, updateClassroomPointsOptimistically]
  );

  const undoTransaction = useCallback(
    async (transactionId: string): Promise<void> => {
      await undoTransactionHook(transactionId);
    },
    [undoTransactionHook]
  );

  const undoBatchTransaction = useCallback(
    async (batchId: string): Promise<void> => {
      // Delete all transactions with this batch_id
      const { error: deleteError } = await supabase
        .from('point_transactions')
        .delete()
        .eq('batch_id', batchId);

      if (deleteError) {
        console.error('Error undoing batch transaction:', deleteError);
        throw deleteError;
      }

      // Refetch transactions to update state
      refetchTransactions();
    },
    [refetchTransactions]
  );

  const getClassroomTransactions = useCallback(
    (classroomId: string, limit?: number): DbPointTransaction[] => {
      const filtered = transactions.filter((t) => t.classroom_id === classroomId);
      return limit ? filtered.slice(0, limit) : filtered;
    },
    [transactions]
  );

  // Get student points from stored totals (replaces transaction-based calculation)
  // Uses point totals from useStudents hook which are kept in sync via realtime subscriptions
  const getStudentPointsStored = useCallback(
    (studentId: string): StudentPoints => {
      const student = students.find((s) => s.id === studentId);
      if (!student) {
        return { total: 0, positiveTotal: 0, negativeTotal: 0, today: 0, thisWeek: 0 };
      }

      // All values come from stored totals - no transaction recalculation
      // This ensures consistency across all screens and eliminates race conditions
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

  // Get aggregated class points (sum of all student points in classroom)
  // Uses stored totals from students - no transaction recalculation
  const getClassPoints = useCallback(
    (_classroomId: string, studentIds?: string[]): ClassPoints => {
      // Sum from student stored totals (guarantees consistency with displayed cards)
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

      // No studentIds provided - return zeros (sidebar uses stored classroom totals)
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
      // Find all transactions with the same batch_id
      const batchTransactions = transactions.filter((t) => t.batch_id === recent.batch_id);
      const transactionIds = batchTransactions.map((t) => t.id);
      const totalPoints = batchTransactions.reduce((sum, t) => sum + t.points, 0);

      return {
        transactionId: recent.id, // Primary ID for compatibility
        transactionIds, // All IDs in the batch
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
      await clearStudentPointsHook(studentId);
    },
    [clearStudentPointsHook]
  );

  // ============================================
  // Mapped values for backwards compatibility
  // ============================================

  // Map classrooms to app format
  // Always use student_count for the students array length (used by sidebar)
  // Uses stored point totals from database - no transaction recalculation to avoid flicker
  // Only provide positive/negative breakdown for the active classroom (sidebar design)
  const mappedClassrooms: AppClassroom[] = useMemo(() => {
    return classrooms.map((c) => {
      // Create placeholder array matching student_count for consistent display
      const placeholderStudents: AppStudent[] = Array.from(
        { length: c.student_count },
        (_, i) => ({ id: `placeholder-${i}`, name: '', pointTotal: 0, positiveTotal: 0, negativeTotal: 0, todayTotal: 0, thisWeekTotal: 0 })
      );

      const isActive = c.id === activeClassroomId;
      return {
        id: c.id,
        name: c.name,
        students: placeholderStudents,
        createdAt: new Date(c.created_at).getTime(),
        updatedAt: new Date(c.updated_at).getTime(),
        pointTotal: c.point_total,
        // Only provide breakdown for active classroom
        positiveTotal: isActive ? c.positive_total : undefined,
        negativeTotal: isActive ? c.negative_total : undefined,
      };
    });
  }, [classrooms, activeClassroomId]);

  // Map behaviors to app format
  const mappedBehaviors: AppBehavior[] = useMemo(() => {
    return behaviors.map((b) => ({
      id: b.id,
      name: b.name,
      points: b.points,
      icon: b.icon,
      category: b.category,
      isCustom: b.is_custom,
      createdAt: new Date(b.created_at).getTime(),
    }));
  }, [behaviors]);

  // Map students to app format (now includes point totals from useStudents)
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

  // ============================================
  // Context Value
  // ============================================

  const value: SupabaseAppContextValue = {
    // Loading states
    loading,
    error,

    // State (mapped to app-compatible format)
    classrooms: mappedClassrooms,
    behaviors: mappedBehaviors,
    transactions,
    activeClassroomId,
    activeClassroom,
    students: mappedStudents,

    // Classroom operations
    createClassroom,
    updateClassroom,
    deleteClassroom,
    setActiveClassroom,

    // Student operations
    addStudent,
    addStudents,
    updateStudent,
    removeStudent,

    // Behavior operations
    addBehavior,
    updateBehavior,
    deleteBehavior,
    resetBehaviorsToDefault,

    // Point operations
    awardPoints,
    awardClassPoints,
    awardPointsToStudents,
    undoTransaction,
    undoBatchTransaction,
    getStudentPoints: getStudentPointsStored, // Use stored totals instead of transaction-based
    getClassPoints,
    getStudentTransactions,
    getClassroomTransactions,
    getRecentUndoableAction,
    clearStudentPoints,
  };

  return (
    <SupabaseAppContext.Provider value={value}>
      {children}
    </SupabaseAppContext.Provider>
  );
}

export function useSupabaseApp() {
  const context = useContext(SupabaseAppContext);
  if (!context) {
    throw new Error('useSupabaseApp must be used within SupabaseAppProvider');
  }
  return context;
}
