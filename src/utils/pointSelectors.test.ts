import { describe, it, expect } from 'vitest';
import {
  studentTransactions,
  classroomTransactions,
  studentPoints,
  classPoints,
} from './pointSelectors';
import type { PointTransaction as DbPointTransaction } from '../types/database';
import type { AppStudent } from '../types';

// Closes the trace's Low-priority gap: studentTransactions / classroomTransactions
// (relocated from AppContext untouched) had zero test references. studentPoints /
// classPoints are covered alongside since they share the file and the same
// "derivation over already-cached data" contract (pointSelectors.ts:1-5).

function tx(overrides: Partial<DbPointTransaction> = {}): DbPointTransaction {
  return {
    id: 'tx-1',
    student_id: 'stu-1',
    classroom_id: 'class-1',
    behavior_id: 'beh-1',
    behavior_name: 'Good listener',
    behavior_icon: '👂',
    points: 1,
    note: null,
    batch_id: null,
    batch_kind: null,
    created_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function student(overrides: Partial<AppStudent> = {}): AppStudent {
  return {
    id: 'stu-1',
    name: 'Ada',
    pointTotal: 10,
    positiveTotal: 12,
    negativeTotal: -2,
    todayTotal: 3,
    thisWeekTotal: 7,
    ...overrides,
  };
}

describe('pointSelectors', () => {
  describe('studentTransactions', () => {
    it('filters to one student and preserves caller order (newest-first)', () => {
      const list = [
        tx({ id: 'a', student_id: 'stu-1' }),
        tx({ id: 'b', student_id: 'stu-2' }),
        tx({ id: 'c', student_id: 'stu-1' }),
      ];
      expect(studentTransactions(list, 'stu-1').map((t) => t.id)).toEqual(['a', 'c']);
    });

    it('returns an empty array when the student has no transactions', () => {
      expect(studentTransactions([tx({ student_id: 'stu-2' })], 'stu-1')).toEqual([]);
    });

    it('caps the result to `limit` when provided', () => {
      const list = [
        tx({ id: 'a', student_id: 'stu-1' }),
        tx({ id: 'b', student_id: 'stu-1' }),
        tx({ id: 'c', student_id: 'stu-1' }),
      ];
      expect(studentTransactions(list, 'stu-1', 2).map((t) => t.id)).toEqual(['a', 'b']);
    });
  });

  describe('classroomTransactions', () => {
    it('filters to one classroom and preserves caller order', () => {
      const list = [
        tx({ id: 'a', classroom_id: 'class-1' }),
        tx({ id: 'b', classroom_id: 'class-2' }),
        tx({ id: 'c', classroom_id: 'class-1' }),
      ];
      expect(classroomTransactions(list, 'class-1').map((t) => t.id)).toEqual(['a', 'c']);
    });

    it('returns an empty array when the classroom has no transactions', () => {
      expect(classroomTransactions([tx({ classroom_id: 'class-2' })], 'class-1')).toEqual([]);
    });

    it('caps the result to `limit` when provided', () => {
      const list = [
        tx({ id: 'a', classroom_id: 'class-1' }),
        tx({ id: 'b', classroom_id: 'class-1' }),
        tx({ id: 'c', classroom_id: 'class-1' }),
      ];
      expect(classroomTransactions(list, 'class-1', 1).map((t) => t.id)).toEqual(['a']);
    });
  });

  describe('studentPoints', () => {
    it('maps stored totals to the StudentPoints shape', () => {
      expect(studentPoints(student())).toEqual({
        total: 10,
        positiveTotal: 12,
        negativeTotal: -2,
        today: 3,
        thisWeek: 7,
      });
    });

    it('returns zeros for an absent student', () => {
      expect(studentPoints(undefined)).toEqual({
        total: 0,
        positiveTotal: 0,
        negativeTotal: 0,
        today: 0,
        thisWeek: 0,
      });
    });
  });

  describe('classPoints', () => {
    it('sums stored totals across the provided subset of student ids', () => {
      const students = [
        student({
          id: 's1',
          pointTotal: 5,
          positiveTotal: 5,
          negativeTotal: 0,
          todayTotal: 2,
          thisWeekTotal: 3,
        }),
        student({
          id: 's2',
          pointTotal: -2,
          positiveTotal: 0,
          negativeTotal: -2,
          todayTotal: -1,
          thisWeekTotal: -1,
        }),
        student({
          id: 's3',
          pointTotal: 100,
          positiveTotal: 100,
          negativeTotal: 0,
          todayTotal: 50,
          thisWeekTotal: 60,
        }),
      ];
      expect(classPoints(students, ['s1', 's2'])).toEqual({
        total: 3,
        positiveTotal: 5,
        negativeTotal: -2,
        today: 1,
        thisWeek: 2,
      });
    });

    it('treats unknown ids in the subset as zero contributions', () => {
      const students = [
        student({
          id: 's1',
          pointTotal: 5,
          positiveTotal: 5,
          negativeTotal: 0,
          todayTotal: 2,
          thisWeekTotal: 3,
        }),
      ];
      expect(classPoints(students, ['s1', 'ghost'])).toEqual({
        total: 5,
        positiveTotal: 5,
        negativeTotal: 0,
        today: 2,
        thisWeek: 3,
      });
    });

    it('returns zeros when no subset is provided (never sums the whole roster)', () => {
      expect(classPoints([student({ id: 's1', pointTotal: 5 })])).toEqual({
        total: 0,
        positiveTotal: 0,
        negativeTotal: 0,
        today: 0,
        thisWeek: 0,
      });
    });

    it('returns zeros for an empty subset', () => {
      expect(classPoints([student({ id: 's1', pointTotal: 5 })], [])).toEqual({
        total: 0,
        positiveTotal: 0,
        negativeTotal: 0,
        today: 0,
        thisWeek: 0,
      });
    });
  });
});
