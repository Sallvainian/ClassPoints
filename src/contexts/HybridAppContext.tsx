/**
 * HybridAppContext - Combines Supabase with localStorage fallback
 *
 * Strategy:
 * - Online: Use Supabase directly with realtime sync
 * - Offline: Queue operations and use localStorage cache
 * - Reconnect: Sync queued operations to Supabase
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { syncManager } from '../services/SyncManager';
import { useSupabaseApp, SupabaseAppProvider } from './SupabaseAppContext';
import type {
  Classroom as DbClassroom,
  Student as DbStudent,
  Behavior as DbBehavior,
  PointTransaction as DbPointTransaction,
} from '../types/database';

// Re-export types for convenience
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

interface SyncStatus {
  isOnline: boolean;
  pendingOperations: number;
  lastSyncAt: number | null;
  syncError: string | null;
}

// App-compatible types (matching original interface)
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

interface HybridAppContextValue {
  // Loading/error states
  loading: boolean;
  error: Error | null;
  syncStatus: SyncStatus;

  // State
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
  getClassPoints: (classroomId: string, studentIds?: string[]) => StudentPoints;
  getStudentTransactions: (studentId: string, limit?: number) => DbPointTransaction[];
  getClassroomTransactions: (classroomId: string, limit?: number) => DbPointTransaction[];
  getRecentUndoableAction: () => UndoableAction | null;
  clearStudentPoints: (classroomId: string, studentId: string) => Promise<void>;
}

const HybridAppContext = createContext<HybridAppContextValue | null>(null);

/**
 * Internal component that has access to SupabaseApp context
 */
function HybridAppProviderInner({ children }: { children: ReactNode }) {
  const supabaseApp = useSupabaseApp();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => syncManager.getStatus());

  // Subscribe to sync status changes
  useEffect(() => {
    const unsubscribe = syncManager.subscribe(setSyncStatus);
    return unsubscribe;
  }, []);

  // Map all Supabase operations through to the context
  // In the future, this could add offline queueing
  const value: HybridAppContextValue = {
    // Loading/error states
    loading: supabaseApp.loading,
    error: supabaseApp.error,
    syncStatus,

    // State (already mapped in SupabaseAppContext)
    classrooms: supabaseApp.classrooms,
    behaviors: supabaseApp.behaviors,
    transactions: supabaseApp.transactions,
    activeClassroomId: supabaseApp.activeClassroomId,
    activeClassroom: supabaseApp.activeClassroom,
    students: supabaseApp.students,

    // Classroom operations
    createClassroom: supabaseApp.createClassroom,
    updateClassroom: supabaseApp.updateClassroom,
    deleteClassroom: supabaseApp.deleteClassroom,
    setActiveClassroom: supabaseApp.setActiveClassroom,

    // Student operations
    addStudent: supabaseApp.addStudent,
    addStudents: supabaseApp.addStudents,
    updateStudent: supabaseApp.updateStudent,
    removeStudent: supabaseApp.removeStudent,

    // Behavior operations
    addBehavior: supabaseApp.addBehavior,
    updateBehavior: supabaseApp.updateBehavior,
    deleteBehavior: supabaseApp.deleteBehavior,
    resetBehaviorsToDefault: supabaseApp.resetBehaviorsToDefault,

    // Point operations
    awardPoints: supabaseApp.awardPoints,
    awardClassPoints: supabaseApp.awardClassPoints,
    awardPointsToStudents: supabaseApp.awardPointsToStudents,
    undoTransaction: supabaseApp.undoTransaction,
    undoBatchTransaction: supabaseApp.undoBatchTransaction,
    getStudentPoints: supabaseApp.getStudentPoints,
    getClassPoints: supabaseApp.getClassPoints,
    getStudentTransactions: supabaseApp.getStudentTransactions,
    getClassroomTransactions: supabaseApp.getClassroomTransactions,
    getRecentUndoableAction: supabaseApp.getRecentUndoableAction,
    clearStudentPoints: supabaseApp.clearStudentPoints,
  };

  return (
    <HybridAppContext.Provider value={value}>
      {children}
    </HybridAppContext.Provider>
  );
}

/**
 * Provider that wraps SupabaseAppProvider and adds hybrid functionality
 */
export function HybridAppProvider({ children }: { children: ReactNode }) {
  return (
    <SupabaseAppProvider>
      <HybridAppProviderInner>{children}</HybridAppProviderInner>
    </SupabaseAppProvider>
  );
}

/**
 * Hook to use the hybrid app context
 */
export function useHybridApp() {
  const context = useContext(HybridAppContext);
  if (!context) {
    throw new Error('useHybridApp must be used within HybridAppProvider');
  }
  return context;
}

/**
 * Alias for backwards compatibility - use this in components
 */
export const useApp = useHybridApp;
