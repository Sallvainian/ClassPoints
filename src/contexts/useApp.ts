import { createContext, useContext } from 'react';
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

export interface AppContextValue {
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

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
