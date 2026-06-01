// Pure point/transaction selectors relocated verbatim from AppContext.tsx's
// context methods (:416-472): getStudentTransactions, getClassroomTransactions,
// getStudentPointsStored, getClassPoints. They are derivations over already-cached
// data, so they belong in utils rather than on the context surface (SPEC CAP-1).

import type { PointTransaction as DbPointTransaction } from '../types/database';
import type { AppStudent, StudentPoints } from '../types';

const ZERO_POINTS: StudentPoints = {
  total: 0,
  positiveTotal: 0,
  negativeTotal: 0,
  today: 0,
  thisWeek: 0,
};

// Filter a transaction list to one student, newest-first (callers pass the
// already-sorted useTransactions cache), optionally capping to `limit`.
export function studentTransactions(
  transactions: DbPointTransaction[],
  studentId: string,
  limit?: number
): DbPointTransaction[] {
  const filtered = transactions.filter((t) => t.student_id === studentId);
  return limit ? filtered.slice(0, limit) : filtered;
}

// Filter a transaction list to one classroom, optionally capping to `limit`.
export function classroomTransactions(
  transactions: DbPointTransaction[],
  classroomId: string,
  limit?: number
): DbPointTransaction[] {
  const filtered = transactions.filter((t) => t.classroom_id === classroomId);
  return limit ? filtered.slice(0, limit) : filtered;
}

// Read a student's stored point totals (DB-trigger maintained; do not compute
// from transactions). Returns zeros when the student is absent — mirrors the
// original guard at AppContext.tsx:436-438.
export function studentPoints(student: AppStudent | undefined): StudentPoints {
  if (!student) return { ...ZERO_POINTS };
  return {
    total: student.pointTotal,
    positiveTotal: student.positiveTotal,
    negativeTotal: student.negativeTotal,
    today: student.todayTotal,
    thisWeek: student.thisWeekTotal,
  };
}

// Aggregate stored totals across a subset of students by id. With no ids (or an
// empty list) returns zeros — preserving AppContext.tsx:452-469 exactly, where
// the no-subset branch never summed the whole roster.
export function classPoints(students: AppStudent[], studentIds?: string[]): StudentPoints {
  if (studentIds && studentIds.length > 0) {
    const byId = new Map(students.map((s) => [s.id, s]));
    let total = 0;
    let positiveTotal = 0;
    let negativeTotal = 0;
    let today = 0;
    let thisWeek = 0;
    for (const studentId of studentIds) {
      const pts = studentPoints(byId.get(studentId));
      total += pts.total;
      positiveTotal += pts.positiveTotal;
      negativeTotal += pts.negativeTotal;
      today += pts.today;
      thisWeek += pts.thisWeek;
    }
    return { total, positiveTotal, negativeTotal, today, thisWeek };
  }
  return { ...ZERO_POINTS };
}
