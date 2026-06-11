import { useCallback, useMemo } from 'react';
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useTransactions } from './useTransactions';
import { queryKeys } from '../lib/queryKeys';
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
// reads the batch kind straight off the cached rows' `batch_kind` column
// (deferred #7) — optimistic rows during flight, server rows after — so the
// label is correct cross-device and after a reload. The single-student name
// lookup reads the students roster straight from the cache via `qc.getQueryData`
// inside the callback — like the original AppContext read the one shared
// `students` array — it does NOT mount `useStudents`, so it opens no second
// realtime channel.
export function useUndoableAction(classroomId: string | null): {
  getRecentUndoableAction: () => UndoableAction | null;
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

      // The kind rides the row itself (DB batch_kind column, deferred #7): the
      // batch insert stamps it on optimistic AND committed rows, so cross-device
      // undo and reload-mid-window label correctly. NULL/unknown (legacy rows,
      // the old-bundle deploy window) falls back to the class-wide label.
      const kind = recent.batch_kind;
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

  return { getRecentUndoableAction, transactionsQuery };
}
