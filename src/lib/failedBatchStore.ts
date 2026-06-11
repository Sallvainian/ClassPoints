// Module-level (singleton) store of FAILED batch-award notices, keyed by
// classroom_id. The writer (`useBatchAward`, mounted in the award modals) and
// the reader (`DashboardView` via `useFailedBatches`) are DIFFERENT component
// mounts, so the notices must live at module scope, not in hook state — a
// per-hook ref/state would not be shared across the two mounts.
//
// An atomic batch failure writes ZERO `point_transactions` rows, so its
// activity-feed visibility (SPEC CAP-3) is this client-side notice. Device-local
// and session-ephemeral by decision: it survives a DashboardView unmount (navigate
// away + back) but is gone on reload. Durable / cross-device failed history is
// explicitly out of scope.

import type { BatchKind } from '../types/database';

export type BatchFailureClassification = 'per-row' | 'ambient' | 'indeterminate';

export interface FailedBatchNotice {
  batchId: string;
  classroomId: string;
  kind: BatchKind;
  behaviorName: string;
  behaviorIcon: string;
  // The intended per-student delta (sign drives display tone). Informational only;
  // zero points were actually written.
  points: number;
  studentCount: number;
  timestamp: number;
  classification: BatchFailureClassification;
  // Present only for the per-row (concurrent-delete) cause, resolved by the §3
  // recovery roster diff. Absent for ambient / indeterminate causes.
  failedStudentNames?: string[];
}

// Shared frozen reference so getByClassroom returns a STABLE snapshot when a
// classroom has no notices — required for useSyncExternalStore (a fresh [] each
// call would loop the store).
const EMPTY: readonly FailedBatchNotice[] = Object.freeze([]);

const byClassroom = new Map<string, FailedBatchNotice[]>();
const listeners = new Set<() => void>();

export function record(notice: FailedBatchNotice): void {
  const prev = byClassroom.get(notice.classroomId) ?? [];
  // New array reference on every write (newest-first, matching the feed's DESC
  // order) so subscribers re-read; the previous reference stays untouched.
  byClassroom.set(notice.classroomId, [notice, ...prev]);
  listeners.forEach((l) => l());
}

export function getByClassroom(classroomId: string): readonly FailedBatchNotice[] {
  // Return the cached per-classroom array (or the shared frozen EMPTY) so
  // useSyncExternalStore's getSnapshot is referentially stable across renders.
  return byClassroom.get(classroomId) ?? EMPTY;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clear(): void {
  byClassroom.clear();
  listeners.forEach((l) => l());
}
