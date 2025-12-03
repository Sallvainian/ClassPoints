import { createContext, useContext, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  AppState,
  Classroom,
  Student,
  Behavior,
  PointTransaction,
  StudentPoints,
  UndoableAction,
} from '../types';
import { usePersistedState } from '../hooks/usePersistedState';
import { getRandomAvatarColor } from '../utils/defaults';

// Helper to get start of today
function getStartOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

// Helper to get start of this week (Monday)
function getStartOfWeek(): number {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  now.setDate(diff);
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

interface AppContextValue {
  // State
  classrooms: Classroom[];
  behaviors: Behavior[];
  transactions: PointTransaction[];
  activeClassroomId: string | null;
  activeClassroom: Classroom | null;

  // Classroom operations
  createClassroom: (name: string) => Classroom;
  updateClassroom: (id: string, updates: Partial<Classroom>) => void;
  deleteClassroom: (id: string) => void;
  setActiveClassroom: (id: string | null) => void;

  // Student operations
  addStudent: (classroomId: string, name: string) => Student;
  addStudents: (classroomId: string, names: string[]) => Student[];
  updateStudent: (classroomId: string, studentId: string, updates: Partial<Student>) => void;
  removeStudent: (classroomId: string, studentId: string) => void;

  // Behavior operations
  addBehavior: (behavior: Omit<Behavior, 'id' | 'createdAt'>) => Behavior;
  updateBehavior: (id: string, updates: Partial<Behavior>) => void;
  deleteBehavior: (id: string) => void;
  resetBehaviorsToDefault: () => void;

  // Point operations
  awardPoints: (classroomId: string, studentId: string, behaviorId: string, note?: string) => PointTransaction | null;
  undoTransaction: (transactionId: string) => void;
  getStudentPoints: (studentId: string) => StudentPoints;
  getStudentTransactions: (studentId: string, limit?: number) => PointTransaction[];
  getClassroomTransactions: (classroomId: string, limit?: number) => PointTransaction[];
  getRecentUndoableAction: () => UndoableAction | null;
  clearStudentPoints: (classroomId: string, studentId: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const UNDO_WINDOW_MS = 10000; // 10 seconds for undo

export function AppProvider({ children }: { children: ReactNode }) {
  const { state, setState } = usePersistedState();

  // Use ref for latest state in callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  const updateState = useCallback(
    (updater: (prev: AppState) => AppState) => {
      const newState = updater(stateRef.current);
      stateRef.current = newState;
      setState(newState);
    },
    [setState]
  );

  // ============================================
  // Classroom Operations
  // ============================================

  const createClassroom = useCallback(
    (name: string): Classroom => {
      const now = Date.now();
      const newClassroom: Classroom = {
        id: uuidv4(),
        name,
        students: [],
        createdAt: now,
        updatedAt: now,
      };

      updateState((prev) => ({
        ...prev,
        classrooms: [...prev.classrooms, newClassroom],
        lastActiveClassroomId: newClassroom.id,
      }));

      return newClassroom;
    },
    [updateState]
  );

  const updateClassroom = useCallback(
    (id: string, updates: Partial<Classroom>) => {
      updateState((prev) => ({
        ...prev,
        classrooms: prev.classrooms.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
        ),
      }));
    },
    [updateState]
  );

  const deleteClassroom = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        classrooms: prev.classrooms.filter((c) => c.id !== id),
        // Also remove all transactions for this classroom
        transactions: prev.transactions.filter((t) => t.classroomId !== id),
        lastActiveClassroomId:
          prev.lastActiveClassroomId === id ? null : prev.lastActiveClassroomId,
      }));
    },
    [updateState]
  );

  const setActiveClassroom = useCallback(
    (id: string | null) => {
      updateState((prev) => ({
        ...prev,
        lastActiveClassroomId: id,
      }));
    },
    [updateState]
  );

  // ============================================
  // Student Operations
  // ============================================

  const addStudent = useCallback(
    (classroomId: string, name: string): Student => {
      const student: Student = {
        id: uuidv4(),
        name,
        avatarColor: getRandomAvatarColor(),
      };

      updateState((prev) => ({
        ...prev,
        classrooms: prev.classrooms.map((c) =>
          c.id === classroomId
            ? { ...c, students: [...c.students, student], updatedAt: Date.now() }
            : c
        ),
      }));

      return student;
    },
    [updateState]
  );

  const addStudents = useCallback(
    (classroomId: string, names: string[]): Student[] => {
      const students: Student[] = names.map((name) => ({
        id: uuidv4(),
        name,
        avatarColor: getRandomAvatarColor(),
      }));

      updateState((prev) => ({
        ...prev,
        classrooms: prev.classrooms.map((c) =>
          c.id === classroomId
            ? { ...c, students: [...c.students, ...students], updatedAt: Date.now() }
            : c
        ),
      }));

      return students;
    },
    [updateState]
  );

  const updateStudent = useCallback(
    (classroomId: string, studentId: string, updates: Partial<Student>) => {
      updateState((prev) => ({
        ...prev,
        classrooms: prev.classrooms.map((c) =>
          c.id === classroomId
            ? {
                ...c,
                students: c.students.map((s) =>
                  s.id === studentId ? { ...s, ...updates } : s
                ),
                updatedAt: Date.now(),
              }
            : c
        ),
      }));
    },
    [updateState]
  );

  const removeStudent = useCallback(
    (classroomId: string, studentId: string) => {
      updateState((prev) => ({
        ...prev,
        classrooms: prev.classrooms.map((c) =>
          c.id === classroomId
            ? {
                ...c,
                students: c.students.filter((s) => s.id !== studentId),
                updatedAt: Date.now(),
              }
            : c
        ),
        // Remove all transactions for this student
        transactions: prev.transactions.filter((t) => t.studentId !== studentId),
      }));
    },
    [updateState]
  );

  // ============================================
  // Behavior Operations
  // ============================================

  const addBehavior = useCallback(
    (behavior: Omit<Behavior, 'id' | 'createdAt'>): Behavior => {
      const newBehavior: Behavior = {
        ...behavior,
        id: uuidv4(),
        createdAt: Date.now(),
      };

      updateState((prev) => ({
        ...prev,
        behaviors: [...prev.behaviors, newBehavior],
      }));

      return newBehavior;
    },
    [updateState]
  );

  const updateBehavior = useCallback(
    (id: string, updates: Partial<Behavior>) => {
      updateState((prev) => ({
        ...prev,
        behaviors: prev.behaviors.map((b) =>
          b.id === id ? { ...b, ...updates } : b
        ),
      }));
    },
    [updateState]
  );

  const deleteBehavior = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        behaviors: prev.behaviors.filter((b) => b.id !== id),
      }));
    },
    [updateState]
  );

  const resetBehaviorsToDefault = useCallback(() => {
    // Import here to avoid circular dependency
    import('../utils/defaults').then(({ createDefaultBehaviors }) => {
      updateState((prev) => ({
        ...prev,
        behaviors: createDefaultBehaviors(),
      }));
    });
  }, [updateState]);

  // ============================================
  // Point Operations
  // ============================================

  const awardPoints = useCallback(
    (classroomId: string, studentId: string, behaviorId: string, note?: string): PointTransaction | null => {
      const behavior = stateRef.current.behaviors.find((b) => b.id === behaviorId);
      if (!behavior) return null;

      const transaction: PointTransaction = {
        id: uuidv4(),
        studentId,
        classroomId,
        behaviorId,
        behaviorName: behavior.name,
        behaviorIcon: behavior.icon,
        points: behavior.points,
        timestamp: Date.now(),
        note,
      };

      updateState((prev) => ({
        ...prev,
        transactions: [...prev.transactions, transaction],
      }));

      return transaction;
    },
    [updateState]
  );

  const undoTransaction = useCallback(
    (transactionId: string) => {
      updateState((prev) => ({
        ...prev,
        transactions: prev.transactions.filter((t) => t.id !== transactionId),
      }));
    },
    [updateState]
  );

  const getStudentPoints = useCallback(
    (studentId: string): StudentPoints => {
      const transactions = stateRef.current.transactions.filter(
        (t) => t.studentId === studentId
      );

      const startOfToday = getStartOfToday();
      const startOfWeek = getStartOfWeek();

      const total = transactions.reduce((sum, t) => sum + t.points, 0);
      const today = transactions
        .filter((t) => t.timestamp >= startOfToday)
        .reduce((sum, t) => sum + t.points, 0);
      const thisWeek = transactions
        .filter((t) => t.timestamp >= startOfWeek)
        .reduce((sum, t) => sum + t.points, 0);

      return { total, today, thisWeek };
    },
    []
  );

  const getStudentTransactions = useCallback(
    (studentId: string, limit?: number): PointTransaction[] => {
      const transactions = stateRef.current.transactions
        .filter((t) => t.studentId === studentId)
        .sort((a, b) => b.timestamp - a.timestamp);

      return limit ? transactions.slice(0, limit) : transactions;
    },
    []
  );

  const getClassroomTransactions = useCallback(
    (classroomId: string, limit?: number): PointTransaction[] => {
      const transactions = stateRef.current.transactions
        .filter((t) => t.classroomId === classroomId)
        .sort((a, b) => b.timestamp - a.timestamp);

      return limit ? transactions.slice(0, limit) : transactions;
    },
    []
  );

  const getRecentUndoableAction = useCallback((): UndoableAction | null => {
    const now = Date.now();
    const transactions = stateRef.current.transactions;

    if (transactions.length === 0) return null;

    // Get most recent transaction
    const sorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
    const recent = sorted[0];

    // Check if within undo window
    if (now - recent.timestamp > UNDO_WINDOW_MS) return null;

    // Find student name
    let studentName = 'Unknown';
    for (const classroom of stateRef.current.classrooms) {
      const student = classroom.students.find((s) => s.id === recent.studentId);
      if (student) {
        studentName = student.name;
        break;
      }
    }

    return {
      transactionId: recent.id,
      studentName,
      behaviorName: recent.behaviorName,
      points: recent.points,
      timestamp: recent.timestamp,
    };
  }, []);

  const clearStudentPoints = useCallback(
    (classroomId: string, studentId: string) => {
      updateState((prev) => ({
        ...prev,
        transactions: prev.transactions.filter(
          (t) => !(t.classroomId === classroomId && t.studentId === studentId)
        ),
      }));
    },
    [updateState]
  );

  // ============================================
  // Computed Values
  // ============================================

  const activeClassroom = useMemo(() => {
    return state.classrooms.find((c) => c.id === state.lastActiveClassroomId) || null;
  }, [state.classrooms, state.lastActiveClassroomId]);

  // ============================================
  // Context Value
  // ============================================

  const value: AppContextValue = {
    // State
    classrooms: state.classrooms,
    behaviors: state.behaviors,
    transactions: state.transactions,
    activeClassroomId: state.lastActiveClassroomId,
    activeClassroom,

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
    undoTransaction,
    getStudentPoints,
    getStudentTransactions,
    getClassroomTransactions,
    getRecentUndoableAction,
    clearStudentPoints,
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
