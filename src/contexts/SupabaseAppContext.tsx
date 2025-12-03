import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useClassrooms } from '../hooks/useClassrooms';
import { useStudents } from '../hooks/useStudents';
import { useBehaviors } from '../hooks/useBehaviors';
import { useTransactions } from '../hooks/useTransactions';
import type {
  Classroom as DbClassroom,
  Student as DbStudent,
  Behavior as DbBehavior,
  PointTransaction as DbPointTransaction,
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
  studentName: string;
  behaviorName: string;
  points: number;
  timestamp: number;
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

  // Point operations
  awardPoints: (classroomId: string, studentId: string, behaviorId: string, note?: string) => Promise<DbPointTransaction | null>;
  undoTransaction: (transactionId: string) => Promise<void>;
  getStudentPoints: (studentId: string) => StudentPoints;
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
    async (name: string): Promise<Classroom | null> => {
      const classroom = await createClassroomHook(name);
      if (classroom) {
        setActiveClassroomId(classroom.id);
      }
      return classroom;
    },
    [createClassroomHook]
  );

  const updateClassroom = useCallback(
    async (id: string, updates: Partial<Classroom>): Promise<void> => {
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
    async (classroomId: string, name: string): Promise<Student | null> => {
      return await addStudentHook(classroomId, name);
    },
    [addStudentHook]
  );

  const addStudents = useCallback(
    async (classroomId: string, names: string[]): Promise<Student[]> => {
      return await addStudentsHook(classroomId, names);
    },
    [addStudentsHook]
  );

  const updateStudent = useCallback(
    async (_classroomId: string, studentId: string, updates: Partial<Student>): Promise<void> => {
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
    async (behavior: Omit<Behavior, 'id' | 'created_at'>): Promise<Behavior | null> => {
      return await addBehaviorHook(behavior);
    },
    [addBehaviorHook]
  );

  const updateBehavior = useCallback(
    async (id: string, updates: Partial<Behavior>): Promise<void> => {
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

  // ============================================
  // Point Operations
  // ============================================

  const awardPoints = useCallback(
    async (
      classroomId: string,
      studentId: string,
      behaviorId: string,
      note?: string
    ): Promise<PointTransaction | null> => {
      const behavior = behaviors.find((b) => b.id === behaviorId);
      if (!behavior) return null;
      return await awardPointsHook(studentId, classroomId, behavior, note);
    },
    [behaviors, awardPointsHook]
  );

  const undoTransaction = useCallback(
    async (transactionId: string): Promise<void> => {
      await undoTransactionHook(transactionId);
    },
    [undoTransactionHook]
  );

  const getClassroomTransactions = useCallback(
    (classroomId: string, limit?: number): PointTransaction[] => {
      const filtered = transactions.filter((t) => t.classroom_id === classroomId);
      return limit ? filtered.slice(0, limit) : filtered;
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

    // Find student name
    const student = students.find((s) => s.id === recent.student_id);
    const studentName = student?.name || 'Unknown';

    return {
      transactionId: recent.id,
      studentName,
      behaviorName: recent.behavior_name,
      points: recent.points,
      timestamp: recentTimestamp,
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
  const mappedClassrooms: AppClassroom[] = useMemo(() => {
    return classrooms.map((c) => ({
      id: c.id,
      name: c.name,
      students: [], // Students are loaded separately per active classroom
      createdAt: new Date(c.created_at).getTime(),
      updatedAt: new Date(c.updated_at).getTime(),
    }));
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

    // Point operations
    awardPoints,
    undoTransaction,
    getStudentPoints,
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
