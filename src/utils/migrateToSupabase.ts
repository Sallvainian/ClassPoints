/**
 * Data Migration Utility - Migrate localStorage data to Supabase
 *
 * Handles:
 * - Export from localStorage
 * - Transform camelCase to snake_case
 * - Import to Supabase respecting FK constraints
 * - Validation and rollback
 */

import { supabase } from '../lib/supabase';
import type { AppState, Classroom, Student, Behavior, PointTransaction } from '../types';
import type {
  Classroom as DbClassroom,
  Student as DbStudent,
  Behavior as DbBehavior,
  NewClassroom,
  NewStudent,
  NewBehavior,
  NewPointTransaction,
} from '../types/database';

const STORAGE_KEY = 'classpoints-state';

export interface MigrationResult {
  success: boolean;
  classroomsMigrated: number;
  studentsMigrated: number;
  behaviorsMigrated: number;
  transactionsMigrated: number;
  errors: string[];
  warnings: string[];
}

export interface MigrationProgress {
  phase: 'idle' | 'exporting' | 'classrooms' | 'students' | 'behaviors' | 'transactions' | 'validating' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
}

type ProgressCallback = (progress: MigrationProgress) => void;

/**
 * Export data from localStorage
 */
export function exportFromLocalStorage(): AppState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as AppState;
  } catch (error) {
    console.error('Failed to export from localStorage:', error);
    return null;
  }
}

/**
 * Check if there's data in localStorage to migrate
 */
export function hasLocalStorageData(): boolean {
  const data = exportFromLocalStorage();
  if (!data) return false;

  return (
    data.classrooms.length > 0 ||
    data.behaviors.some((b) => b.isCustom) ||
    data.transactions.length > 0
  );
}

/**
 * Get migration summary before starting
 */
export function getMigrationSummary(): {
  classrooms: number;
  students: number;
  behaviors: number;
  transactions: number;
} {
  const data = exportFromLocalStorage();
  if (!data) {
    return { classrooms: 0, students: 0, behaviors: 0, transactions: 0 };
  }

  const studentCount = data.classrooms.reduce((sum, c) => sum + c.students.length, 0);

  return {
    classrooms: data.classrooms.length,
    students: studentCount,
    behaviors: data.behaviors.filter((b) => b.isCustom).length, // Only custom behaviors
    transactions: data.transactions.length,
  };
}

/**
 * Transform localStorage classroom to Supabase format
 */
function transformClassroom(classroom: Classroom): NewClassroom {
  return {
    name: classroom.name,
    // Note: id, user_id, created_at, updated_at handled by Supabase
  };
}

/**
 * Transform localStorage student to Supabase format
 */
function transformStudent(student: Student, classroomId: string): NewStudent {
  return {
    classroom_id: classroomId,
    name: student.name,
    avatar_color: student.avatarColor || null,
  };
}

/**
 * Transform localStorage behavior to Supabase format
 */
function transformBehavior(behavior: Behavior): NewBehavior {
  return {
    name: behavior.name,
    points: behavior.points,
    icon: behavior.icon,
    category: behavior.category,
    is_custom: behavior.isCustom,
  };
}

/**
 * Transform localStorage transaction to Supabase format
 */
function transformTransaction(
  transaction: PointTransaction,
  studentIdMap: Map<string, string>,
  classroomIdMap: Map<string, string>,
  behaviorIdMap: Map<string, string>
): NewPointTransaction | null {
  const studentId = studentIdMap.get(transaction.studentId);
  const classroomId = classroomIdMap.get(transaction.classroomId);
  const behaviorId = behaviorIdMap.get(transaction.behaviorId);

  if (!studentId || !classroomId) {
    return null; // Skip orphaned transactions
  }

  return {
    student_id: studentId,
    classroom_id: classroomId,
    behavior_id: behaviorId || null, // Behavior might be deleted
    behavior_name: transaction.behaviorName,
    behavior_icon: transaction.behaviorIcon,
    points: transaction.points,
    note: transaction.note || null,
  };
}

/**
 * Main migration function
 */
export async function migrateToSupabase(
  onProgress?: ProgressCallback
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    classroomsMigrated: 0,
    studentsMigrated: 0,
    behaviorsMigrated: 0,
    transactionsMigrated: 0,
    errors: [],
    warnings: [],
  };

  const reportProgress = (progress: MigrationProgress) => {
    onProgress?.(progress);
  };

  try {
    // Phase 1: Export from localStorage
    reportProgress({
      phase: 'exporting',
      current: 0,
      total: 1,
      message: 'Reading localStorage data...',
    });

    const data = exportFromLocalStorage();
    if (!data) {
      result.errors.push('No data found in localStorage');
      return result;
    }

    // ID mapping (old localStorage ID -> new Supabase ID)
    const classroomIdMap = new Map<string, string>();
    const studentIdMap = new Map<string, string>();
    const behaviorIdMap = new Map<string, string>();

    // Phase 2: Migrate classrooms
    reportProgress({
      phase: 'classrooms',
      current: 0,
      total: data.classrooms.length,
      message: 'Migrating classrooms...',
    });

    for (let i = 0; i < data.classrooms.length; i++) {
      const classroom = data.classrooms[i];
      const newClassroom = transformClassroom(classroom);

      const { data: inserted, error } = await supabase
        .from('classrooms')
        .insert(newClassroom)
        .select()
        .single();

      if (error) {
        result.errors.push(`Failed to migrate classroom "${classroom.name}": ${error.message}`);
        continue;
      }

      const insertedClassroom = inserted as DbClassroom;
      classroomIdMap.set(classroom.id, insertedClassroom.id);
      result.classroomsMigrated++;

      reportProgress({
        phase: 'classrooms',
        current: i + 1,
        total: data.classrooms.length,
        message: `Migrated classroom: ${classroom.name}`,
      });
    }

    // Phase 3: Migrate students (depends on classrooms)
    const allStudents: Array<{ student: Student; classroomId: string; newClassroomId: string }> = [];
    for (const classroom of data.classrooms) {
      const newClassroomId = classroomIdMap.get(classroom.id);
      if (!newClassroomId) continue;

      for (const student of classroom.students) {
        allStudents.push({
          student,
          classroomId: classroom.id,
          newClassroomId,
        });
      }
    }

    reportProgress({
      phase: 'students',
      current: 0,
      total: allStudents.length,
      message: 'Migrating students...',
    });

    for (let i = 0; i < allStudents.length; i++) {
      const { student, newClassroomId } = allStudents[i];
      const newStudent = transformStudent(student, newClassroomId);

      const { data: inserted, error } = await supabase
        .from('students')
        .insert(newStudent)
        .select()
        .single();

      if (error) {
        result.errors.push(`Failed to migrate student "${student.name}": ${error.message}`);
        continue;
      }

      const insertedStudent = inserted as DbStudent;
      studentIdMap.set(student.id, insertedStudent.id);
      result.studentsMigrated++;

      reportProgress({
        phase: 'students',
        current: i + 1,
        total: allStudents.length,
        message: `Migrated student: ${student.name}`,
      });
    }

    // Phase 4: Migrate custom behaviors
    const customBehaviors = data.behaviors.filter((b) => b.isCustom);

    reportProgress({
      phase: 'behaviors',
      current: 0,
      total: customBehaviors.length,
      message: 'Migrating custom behaviors...',
    });

    // First, map existing default behaviors by name
    const { data: existingBehaviors } = await supabase
      .from('behaviors')
      .select('id, name');

    if (existingBehaviors) {
      const behaviorList = existingBehaviors as Array<{ id: string; name: string }>;
      for (const behavior of data.behaviors) {
        const existing = behaviorList.find(
          (b) => b.name.toLowerCase() === behavior.name.toLowerCase()
        );
        if (existing) {
          behaviorIdMap.set(behavior.id, existing.id);
        }
      }
    }

    // Migrate custom behaviors
    for (let i = 0; i < customBehaviors.length; i++) {
      const behavior = customBehaviors[i];
      const newBehavior = transformBehavior(behavior);

      const { data: inserted, error } = await supabase
        .from('behaviors')
        .insert(newBehavior)
        .select()
        .single();

      if (error) {
        result.errors.push(`Failed to migrate behavior "${behavior.name}": ${error.message}`);
        continue;
      }

      const insertedBehavior = inserted as DbBehavior;
      behaviorIdMap.set(behavior.id, insertedBehavior.id);
      result.behaviorsMigrated++;

      reportProgress({
        phase: 'behaviors',
        current: i + 1,
        total: customBehaviors.length,
        message: `Migrated behavior: ${behavior.name}`,
      });
    }

    // Phase 5: Migrate transactions (depends on students, classrooms, behaviors)
    reportProgress({
      phase: 'transactions',
      current: 0,
      total: data.transactions.length,
      message: 'Migrating point transactions...',
    });

    // Batch transactions for efficiency
    const batchSize = 50;
    for (let i = 0; i < data.transactions.length; i += batchSize) {
      const batch = data.transactions.slice(i, i + batchSize);
      const transformedBatch: NewPointTransaction[] = [];

      for (const transaction of batch) {
        const transformed = transformTransaction(
          transaction,
          studentIdMap,
          classroomIdMap,
          behaviorIdMap
        );

        if (transformed) {
          transformedBatch.push(transformed);
        } else {
          result.warnings.push(
            `Skipped orphaned transaction: ${transaction.behaviorName} for student ${transaction.studentId}`
          );
        }
      }

      if (transformedBatch.length > 0) {
        const { error } = await supabase
          .from('point_transactions')
          .insert(transformedBatch);

        if (error) {
          result.errors.push(`Failed to migrate batch of transactions: ${error.message}`);
        } else {
          result.transactionsMigrated += transformedBatch.length;
        }
      }

      reportProgress({
        phase: 'transactions',
        current: Math.min(i + batchSize, data.transactions.length),
        total: data.transactions.length,
        message: `Migrated ${result.transactionsMigrated} transactions...`,
      });
    }

    // Phase 6: Validation
    reportProgress({
      phase: 'validating',
      current: 0,
      total: 1,
      message: 'Validating migration...',
    });

    // Quick validation: check counts
    const { count: classroomCount } = await supabase
      .from('classrooms')
      .select('*', { count: 'exact', head: true });

    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    if ((classroomCount || 0) < result.classroomsMigrated) {
      result.warnings.push('Some classrooms may not have been migrated correctly');
    }

    if ((studentCount || 0) < result.studentsMigrated) {
      result.warnings.push('Some students may not have been migrated correctly');
    }

    // Mark as complete
    result.success = result.errors.length === 0;

    reportProgress({
      phase: 'complete',
      current: 1,
      total: 1,
      message: result.success ? 'Migration complete!' : 'Migration completed with errors',
    });

    return result;
  } catch (error) {
    result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    reportProgress({
      phase: 'error',
      current: 0,
      total: 0,
      message: result.errors[result.errors.length - 1],
    });
    return result;
  }
}

/**
 * Clear localStorage after successful migration
 */
export function clearLocalStorageAfterMigration(): void {
  const backup = localStorage.getItem(STORAGE_KEY);
  if (backup) {
    // Store a backup just in case
    localStorage.setItem(`${STORAGE_KEY}-backup-${Date.now()}`, backup);
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Restore from backup if needed
 */
export function restoreFromBackup(): boolean {
  const keys = Object.keys(localStorage);
  const backupKey = keys
    .filter((k) => k.startsWith(`${STORAGE_KEY}-backup-`))
    .sort()
    .pop();

  if (backupKey) {
    const backup = localStorage.getItem(backupKey);
    if (backup) {
      localStorage.setItem(STORAGE_KEY, backup);
      return true;
    }
  }
  return false;
}
