import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAwardPoints } from './useTransactions';
import { queryKeys } from '../lib/queryKeys';
import * as batchKindStore from '../lib/batchKindStore';
import type { StudentWithPoints } from '../types/transforms';
import type { PointTransaction as DbPointTransaction } from '../types/database';
import type { Behavior as AppBehavior } from '../types';

// The batch-award fan-out extracted from AppContext's `awardClassPoints`
// (:310-354) and `awardPointsToStudents` (:356-398). Mints one batchId+timestamp,
// reads the classroom roster straight from the useStudents cache (no second
// subscription — avoids a duplicate realtime channel), loops useAwardPoints over
// it, and tags the batch kind in the module-level batchKindStore so
// useUndoableAction can label the undo toast correctly.
//
// The per-student `.catch(() => null)` silent filter is PRESERVED VERBATIM — the
// silent-partial-failure fix is a separate, later commit (SPEC non-goal).
export function useBatchAward(classroomId: string): {
  awardClass: (behavior: AppBehavior) => Promise<DbPointTransaction[]>;
  awardSubset: (
    studentIds: string[],
    behavior: AppBehavior,
    note?: string
  ) => Promise<DbPointTransaction[]>;
} {
  const qc = useQueryClient();
  const awardPointsMutation = useAwardPoints();

  const readRoster = useCallback(
    (): StudentWithPoints[] =>
      qc.getQueryData<StudentWithPoints[]>(queryKeys.students.byClassroom(classroomId)) ?? [],
    [qc, classroomId]
  );

  const awardClass = useCallback(
    async (behavior: AppBehavior): Promise<DbPointTransaction[]> => {
      const students = readRoster();
      if (students.length === 0) return [];

      const batchId = crypto.randomUUID();
      const timestamp = Date.now();

      // Tag AFTER the early-return guards so no-op calls don't leak Map entries.
      // Paired with cleanup in undoBatch/reset/clear paths.
      batchKindStore.tag(batchId, 'class');

      // Each mutation owns its own optimism + rollback (3 caches, ADR-005 §4).
      // A per-student failure rolls back just that row. batch_id is preserved so
      // getRecentUndoableAction / undoBatchTransaction continue to see the cluster.
      const results = await Promise.all(
        students.map((student) =>
          awardPointsMutation
            .mutateAsync({
              studentId: student.id,
              classroomId,
              behavior,
              note: null,
              batchId,
              timestamp,
            })
            .catch((err) => {
              console.error('Error awarding class points:', err);
              return null;
            })
        )
      );

      const successful = results.filter((r): r is DbPointTransaction => r !== null);
      // If every mutation failed, no transaction was written → undoBatchTransaction
      // never runs → batchKindStore entry would leak. Clean it up here.
      if (successful.length === 0) batchKindStore.forget(batchId);
      return successful;
    },
    [readRoster, awardPointsMutation, classroomId]
  );

  const awardSubset = useCallback(
    async (
      studentIds: string[],
      behavior: AppBehavior,
      note?: string
    ): Promise<DbPointTransaction[]> => {
      if (studentIds.length === 0) return [];

      const students = readRoster();
      const validStudents = students.filter((s) => studentIds.includes(s.id));
      if (validStudents.length === 0) return [];

      const batchId = crypto.randomUUID();
      const timestamp = Date.now();

      // Tag AFTER the guards so no-op calls don't leak Map entries.
      batchKindStore.tag(batchId, 'subset');

      const results = await Promise.all(
        validStudents.map((student) =>
          awardPointsMutation
            .mutateAsync({
              studentId: student.id,
              classroomId,
              behavior,
              note: note ?? null,
              batchId,
              timestamp,
            })
            .catch((err) => {
              console.error('Error awarding points to students:', err);
              return null;
            })
        )
      );

      const successful = results.filter((r): r is DbPointTransaction => r !== null);
      if (successful.length === 0) batchKindStore.forget(batchId);
      return successful;
    },
    [readRoster, awardPointsMutation, classroomId]
  );

  return { awardClass, awardSubset };
}
