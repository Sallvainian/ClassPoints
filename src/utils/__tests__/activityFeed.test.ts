import { describe, it, expect } from 'vitest';
import { mergeFailedIntoFeed } from '../activityFeed';
import type { PointTransaction } from '../../types';
import type { PointTransaction as DbPointTransaction } from '../../types/database';
import type { FailedBatchNotice } from '../../lib/failedBatchStore';

// Pins CAP-3 (a failed batch is visible in the activity feed as a synthetic row,
// SPEC.md:28-30) and CAP-6 (a late-confirmed / lost-ack batch whose rows actually
// committed is suppressed so it never shows as both awarded and failed,
// SPEC.md:40-42; activityFeed.ts:12-17). mergeFailedIntoFeed is a pure function —
// no Supabase, no providers — so this mirrors the pointSelectors.test.ts style.

// app-shape PointTransaction (camelCase) — used for `real` (committed feed rows).
function real(overrides: Partial<PointTransaction> = {}): PointTransaction {
  return {
    id: 'real-1',
    studentId: 'stu-1',
    classroomId: 'class-1',
    behaviorId: 'beh-1',
    behaviorName: 'Good listener',
    behaviorIcon: '👂',
    points: 1,
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

// DB-shape PointTransaction (snake_case) — used for `dbRows`, the suppression
// oracle only. These rows never appear in the output; they exist solely to seed
// the committed-batch-id set (activityFeed.ts:23-25).
function dbRow(overrides: Partial<DbPointTransaction> = {}): DbPointTransaction {
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
    created_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

// FailedBatchNotice (failedBatchStore.ts:17-32) — all required fields populated so
// strict TS is satisfied; mapped fields use non-default values so case 1 exercises
// the mapping rather than coincidentally matching a default.
function notice(overrides: Partial<FailedBatchNotice> = {}): FailedBatchNotice {
  return {
    batchId: 'b-1',
    classroomId: 'class-9',
    kind: 'class',
    behaviorName: 'Disruptive',
    behaviorIcon: '⚠️',
    points: -3,
    studentCount: 4,
    timestamp: 1_700_000_999_000,
    classification: 'ambient',
    ...overrides,
  };
}

describe('mergeFailedIntoFeed', () => {
  // CAP-3 (SPEC.md:28-30): one failed notice + empty dbRows yields a synthetic
  // PREPENDED row whose mapped fields come from the notice and whose
  // studentId/behaviorId/failed encode the synthetic marker (activityFeed.ts:26-39).
  it('[P1][BATCH.06-UNIT-01] injects one synthetic failed row mapped from the notice (CAP-3)', () => {
    const n = notice({
      batchId: 'b-fail',
      classroomId: 'class-9',
      behaviorName: 'Disruptive',
      behaviorIcon: '⚠️',
      points: -3,
      timestamp: 1_700_000_999_000,
    });

    const result = mergeFailedIntoFeed([], [n], []);

    expect(result).toEqual([
      {
        id: 'failed-b-fail',
        studentId: '',
        classroomId: 'class-9',
        behaviorId: '',
        behaviorName: 'Disruptive',
        behaviorIcon: '⚠️',
        points: -3,
        timestamp: 1_700_000_999_000,
        failed: true,
      },
    ]);
  });

  // CAP-3 (SPEC.md:28-30): synthetic failed rows are prepended; real committed
  // rows follow (order = synthetic then real, activityFeed.ts:39).
  it('[P1][BATCH.06-UNIT-02] prepends the synthetic row before real rows (CAP-3 ordering)', () => {
    const result = mergeFailedIntoFeed(
      [real({ id: 'real-a' })],
      [notice({ batchId: 'b-fail' })],
      []
    );

    expect(result.map((t) => t.id)).toEqual(['failed-b-fail', 'real-a']);
    expect(result[0].failed).toBe(true);
    expect(result[1].failed).toBeUndefined();
  });

  // CAP-6 (SPEC.md:40-42): a notice whose batchId appears among committed dbRows
  // batch_id values is DROPPED (the batch actually landed); a notice whose batchId
  // is absent stays (activityFeed.ts:23-27).
  it('[P1][BATCH.06-UNIT-03] suppresses a notice whose batchId is among committed dbRows (CAP-6)', () => {
    const dbRows = [dbRow({ batch_id: 'b-committed' })];
    const failed = [notice({ batchId: 'b-committed' }), notice({ batchId: 'b-genuine' })];

    const result = mergeFailedIntoFeed([], failed, dbRows);

    expect(result.map((t) => t.id)).toEqual(['failed-b-genuine']);
  });

  // CAP-6 (SPEC.md:40-42): the committed set filters out null batch_id rows
  // (activityFeed.ts:24 `!!id`), so a dbRows row with batch_id:null must not
  // suppress any notice.
  it('[P1][BATCH.06-UNIT-04] null batch_id rows do not suppress any notice (CAP-6 filter)', () => {
    const dbRows = [dbRow({ batch_id: null }), dbRow({ id: 'tx-2', batch_id: null })];
    const failed = [notice({ batchId: 'b-genuine' })];

    const result = mergeFailedIntoFeed([], failed, dbRows);

    expect(result.map((t) => t.id)).toEqual(['failed-b-genuine']);
  });

  // CAP-3 (SPEC.md:28-30): empty `failed` injects no synthetic rows — output is
  // exactly the real array contents, same items and order (activityFeed.ts:26-39).
  it('[P1][BATCH.06-UNIT-05] empty failed returns exactly the real rows in order', () => {
    const reals = [real({ id: 'real-a' }), real({ id: 'real-b' }), real({ id: 'real-c' })];

    const result = mergeFailedIntoFeed(reals, [], [dbRow({ batch_id: 'b-committed' })]);

    expect(result.map((t) => t.id)).toEqual(['real-a', 'real-b', 'real-c']);
    expect(result.every((t) => t.failed === undefined)).toBe(true);
  });

  // CAP-3 (SPEC.md:28-30): multiple failed notices preserve incoming order and are
  // all prepended before the real rows (activityFeed.ts:26-39).
  it('[P1][BATCH.06-UNIT-06] multiple failed notices keep incoming order, all before real', () => {
    const failed = [
      notice({ batchId: 'b-1' }),
      notice({ batchId: 'b-2' }),
      notice({ batchId: 'b-3' }),
    ];

    const result = mergeFailedIntoFeed([real({ id: 'real-a' })], failed, []);

    expect(result.map((t) => t.id)).toEqual(['failed-b-1', 'failed-b-2', 'failed-b-3', 'real-a']);
  });
});
