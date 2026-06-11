import { useCallback, useMemo } from 'react';
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useTransactions } from './useTransactions';
import { queryKeys } from '../lib/queryKeys';
import * as batchKindStore from '../lib/batchKindStore';
import type { StudentWithPoints } from '../types/transforms';
import type { PointTransaction as DbPointTransaction } from '../types/database';
import type { UndoableAction } from '../types';

// 10 seconds for undo. Relocated verbatim from AppContext.tsx:68. Exported so
// DashboardView's event-driven expiry timer (deferred #6) schedules against the
// SAME window the strict comparison below enforces.
export const UNDO_WINDOW_MS = 10000;

// The undo-window machinery extracted from AppContext (CAP-4). Mounts the ONE
// dashboard `useTransactions` query (exposed as `transactionsQuery` so consumers
// don't open a redundant second `point_transactions` channel — deferred #22) and
// reads the batch-kind tags from the module-level batchKindStore. The
// single-student name lookup reads the students roster straight from the cache
// via `qc.getQueryData` inside the callback — like the original AppContext read
// the one shared `students` array — it does NOT mount `useStudents`, so it opens
// no second realtime channel.
// `getRecentUndoableAction` is relocated verbatim from AppContext.tsx:474-530;
// `forget`/`clear` expose the cleanup the undo/clear/reset paths perform.
export function useUndoableAction(classroomId: string | null): {
  getRecentUndoableAction: () => UndoableAction | null;
  forget: (batchId: string) => void;
  clear: () => void;
  transactionsQuery: UseQueryResult<DbPointTransaction[], Error>;
} {
  const qc = useQueryClient();
  const transactionsQuery = useTransactions(classroomId);

  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);

  const getRecentUndoableAction = useCallback((): UndoableAction | null => {
    const now = Date.now();

    if (transactions.length === 0) return null;

    // Get most recent transaction
    const recent = transactions[0]; // Already sorted by created_at DESC
    const recentTimestamp = new Date(recent.created_at).getTime();

    // Check if within undo window
    if (now - recentTimestamp > UNDO_WINDOW_MS) return null;

    // Check if this is part of a batch (class-wide OR multi-select subset).
    if (recent.batch_id) {
      const batchTransactions = transactions.filter((t) => t.batch_id === recent.batch_id);
      const transactionIds = batchTransactions.map((t) => t.id);
      const totalPoints = batchTransactions.reduce((sum, t) => sum + t.points, 0);
      const studentCount = batchTransactions.length;

      // Acknowledged limitation: batchKindStore is local to the originating device.
      // Cross-device undo (teacher awards on phone, undoes on laptop within 10s)
      // and page-reload-mid-window both fall back to 'Entire Class'. Solving
      // requires persisting batch_kind as a DB column — schema change, out of
      // Phase 2.5 scope.
      const kind = batchKindStore.get(recent.batch_id);
      const studentName =
        kind === 'subset'
          ? `${studentCount} student${studentCount === 1 ? '' : 's'}`
          : 'Entire Class';

      return {
        transactionId: recent.id,
        transactionIds,
        batchId: recent.batch_id,
        studentName,
        behaviorName: recent.behavior_name,
        points: totalPoints,
        timestamp: recentTimestamp,
        isBatch: true,
        isClassWide: kind !== 'subset',
        studentCount,
      };
    }

    // Single student transaction. Read the roster from the cache at call-time
    // (no subscription) to resolve the student name.
    const students =
      qc.getQueryData<StudentWithPoints[]>(queryKeys.students.byClassroom(classroomId)) ?? [];
    const student = students.find((s) => s.id === recent.student_id);
    const studentName = student?.name || 'Unknown';

    return {
      transactionId: recent.id,
      studentName,
      behaviorName: recent.behavior_name,
      points: recent.points,
      timestamp: recentTimestamp,
      isBatch: false,
    };
  }, [transactions, qc, classroomId]);

  const forget = useCallback((batchId: string) => batchKindStore.forget(batchId), []);
  const clear = useCallback(() => batchKindStore.clear(), []);

  return { getRecentUndoableAction, forget, clear, transactionsQuery };
}
