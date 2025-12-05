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

// Types matching the original app interface (for backwards compatibility)
interface AppStudent {
  id: string;
  name: string;
  avatarColor?: string;
}

interface AppClassroom {
  id: string;
  name: string;
  students: AppStudent[];
  createdAt: number;
  updatedAt: number;
  pointTotal?: number; // Pre-fetched total points for sidebar display
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
  undoTransaction: (transactionId: string) => Promise<void>;
  undoBatchTransaction: (batchId: string) => Promise<void>;
  getStudentPoints: (studentId: string) => StudentPoints;
  getClassPoints: (classroomId: string) => ClassPoints;
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
  } = useClassrooms();

  const {
    students,
    loading: studentsLoading,
    error: studentsError,
    addStudent: addStudentHook,
    addStudents: addStudentsHook,
    updateStudent: updateStudentHook,
    removeStudent: removeStudentHook,
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
    getStudentPoints,
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

    // Map Supabase students to old format and embed in classroom
    const mappedStudents = students.map((s) => ({
      id: s.id,
      name: s.name,
      avatarColor: s.avatar_color || undefined,
    }));

    return {
      id: classroom.id,
      name: classroom.name,
      students: mappedStudents,
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

  // Default behavior templates (matching localStorage defaults)
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
      return await awardPointsHook(studentId, classroomId, behavior, note);
    },
    [behaviors, awardPointsHook]
  );

  const awardClassPoints = useCallback(
    async (
      classroomId: string,
      behaviorId: string,
      note?: string
    ): Promise<DbPointTransaction[]> => {
      const behavior = behaviors.find((b) => b.id === behaviorId);
      if (!behavior || students.length === 0) return [];

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
        return [];
      }

      // Refetch transactions to update state
      refetchTransactions();

      return data || [];
    },
    [behaviors, students, refetchTransactions]
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

  // Get aggregated class points (sum of all student points in classroom)
  const getClassPoints = useCallback(
    (classroomId: string): ClassPoints => {
      const classTransactions = transactions.filter((t) => t.classroom_id === classroomId);

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const day = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
      startOfWeek.setHours(0, 0, 0, 0);

      const total = classTransactions.reduce((sum, t) => sum + t.points, 0);
      const today = classTransactions
        .filter((t) => new Date(t.created_at) >= startOfToday)
        .reduce((sum, t) => sum + t.points, 0);
      const thisWeek = classTransactions
        .filter((t) => new Date(t.created_at) >= startOfWeek)
        .reduce((sum, t) => sum + t.points, 0);

      return { total, today, thisWeek };
    },
    [transactions]
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
  // This avoids race conditions when switching between classrooms
  const mappedClassrooms: AppClassroom[] = useMemo(() => {
    return classrooms.map((c) => {
      // Create placeholder array matching student_count for consistent display
      const placeholderStudents: AppStudent[] = Array.from(
        { length: c.student_count },
        (_, i) => ({ id: `placeholder-${i}`, name: '' })
      );
      return {
        id: c.id,
        name: c.name,
        students: placeholderStudents,
        createdAt: new Date(c.created_at).getTime(),
        updatedAt: new Date(c.updated_at).getTime(),
        pointTotal: c.point_total,
      };
    });
  }, [classrooms]);

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

  // Map students to app format
  const mappedStudents: AppStudent[] = useMemo(() => {
    return students.map((s) => ({
      id: s.id,
      name: s.name,
      avatarColor: s.avatar_color || undefined,
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
    undoTransaction,
    undoBatchTransaction,
    getStudentPoints,
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
