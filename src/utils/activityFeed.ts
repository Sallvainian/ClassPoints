import type { PointTransaction } from '../types';
import type { PointTransaction as DbPointTransaction } from '../types/database';
import type { FailedBatchNotice } from '../lib/failedBatchStore';

// Merges session-ephemeral "batch award failed" notices into the activity feed
// alongside the real, committed point-transaction rows.
//
// CAP-3: an atomic batch failure writes ZERO DB rows, so its activity-feed
// visibility is a synthetic entry sourced from failedBatchStore (device-local;
// survives a DashboardView unmount, gone on reload).
//
// CAP-6 late-confirm: if a failed notice's batch_id now appears among the
// committed rows, the batch actually landed (a lost ack whose recovery read
// couldn't confirm at award time, later surfaced by onSettled's refetch).
// Suppress its "Failed" entry so the feed never shows one batch as both awarded
// and failed. A genuine failure wrote zero rows, so its batchId is absent from
// `dbRows` and the notice stays. Synthetic rows are prepended (newest-first).
export function mergeFailedIntoFeed(
  real: PointTransaction[],
  failed: readonly FailedBatchNotice[],
  dbRows: DbPointTransaction[]
): PointTransaction[] {
  const committedBatchIds = new Set(
    dbRows.map((t) => t.batch_id).filter((id): id is string => !!id)
  );
  const synthetic: PointTransaction[] = failed
    .filter((n) => !committedBatchIds.has(n.batchId))
    .map((n) => ({
      id: `failed-${n.batchId}`,
      studentId: '',
      classroomId: n.classroomId,
      behaviorId: '',
      behaviorName: n.behaviorName,
      behaviorIcon: n.behaviorIcon,
      points: n.points,
      timestamp: n.timestamp,
      failed: true,
    }));
  return [...synthetic, ...real];
}
