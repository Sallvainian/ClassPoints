// Module-level (singleton) store mapping a batch_id to the kind of batch award
// that produced it: 'class' (entire class) vs 'subset' (multi-select). The
// UndoToast labels these differently ('Entire Class' vs 'N students') but the DB
// row carries no kind marker, so we record the kind at award time here.
//
// MUST be module scope, NOT hook state: the writer (`useBatchAward`, mounted in
// the award modals) and the reader (`useUndoableAction`, mounted in
// `DashboardView`) are DIFFERENT component mounts. A per-hook ref/state would not
// share the Map and undo labels would break.
//
// Device-local ephemeral state. Cross-device undo of a subset award (or a
// page reload mid-window) falls back to the 'Entire Class' label — an
// acknowledged limitation; the real fix is the deferred `batch_kind` DB column.

export type BatchKind = 'class' | 'subset';

const batchKinds = new Map<string, BatchKind>();

export function tag(batchId: string, kind: BatchKind): void {
  batchKinds.set(batchId, kind);
}

export function get(batchId: string): BatchKind | undefined {
  return batchKinds.get(batchId);
}

export function forget(batchId: string): void {
  batchKinds.delete(batchId);
}

export function clear(): void {
  batchKinds.clear();
}
