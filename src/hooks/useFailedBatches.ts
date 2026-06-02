import { useSyncExternalStore } from 'react';
import { subscribe, getByClassroom, type FailedBatchNotice } from '../lib/failedBatchStore';

// Shared stable reference for the "no classroom selected" case.
const EMPTY: readonly FailedBatchNotice[] = Object.freeze([]);

// Reactive read of the device-local failed-batch notices for one classroom.
// useSyncExternalStore keeps DashboardView in sync with failedBatchStore writes
// made from useBatchAward (a different mount). getSnapshot returns the store's
// cached per-classroom array reference, which is stable until a notice is
// recorded or cleared — so this does not loop.
export function useFailedBatches(classroomId: string | null): readonly FailedBatchNotice[] {
  return useSyncExternalStore(
    subscribe,
    () => (classroomId ? getByClassroom(classroomId) : EMPTY),
    () => EMPTY
  );
}
