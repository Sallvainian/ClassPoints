// ============================================
// ClassPoints - Type Definitions
// ============================================

// Behavior category for positive/negative tracking
export type BehaviorCategory = 'positive' | 'negative';

// Behavior definition
export interface Behavior {
  id: string;
  name: string;
  points: number; // +1 to +5 for positive, -1 to -5 for negative
  icon: string; // Emoji
  category: BehaviorCategory;
  isCustom: boolean;
  createdAt: number;
}

// Point transaction record
export interface PointTransaction {
  id: string;
  studentId: string;
  classroomId: string;
  behaviorId: string;
  behaviorName: string; // Snapshot for history display
  behaviorIcon: string; // Snapshot for history display
  points: number;
  timestamp: number;
  note?: string;
}

// Student entity
export interface Student {
  id: string;
  name: string;
  avatarColor?: string; // Optional color for visual distinction
}

// Classroom container
export interface Classroom {
  id: string;
  name: string;
  students: Student[];
  createdAt: number;
  updatedAt: number;
  pointTotal?: number; // Pre-fetched total points for sidebar display
}

// Application state
export interface AppState {
  version: number;
  classrooms: Classroom[];
  behaviors: Behavior[];
  transactions: PointTransaction[];
  lastActiveClassroomId: string | null;
}

// Computed point totals for a student
export interface StudentPoints {
  total: number;
  positiveTotal: number;
  negativeTotal: number;
  today: number;
  thisWeek: number;
}

// Recent undo action for toast
export interface UndoableAction {
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
