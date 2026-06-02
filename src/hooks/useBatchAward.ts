import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAwardPointsBatch } from './useTransactions';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import * as batchKindStore from '../lib/batchKindStore';
import type { BatchKind } from '../lib/batchKindStore';
import * as failedBatchStore from '../lib/failedBatchStore';
import type { BatchFailureClassification } from '../lib/failedBatchStore';
import type { StudentWithPoints } from '../types/transforms';
import type { PointTransaction as DbPointTransaction } from '../types/database';
import type { Behavior as AppBehavior } from '../types';

// Batch-award orchestrator (class-wide `awardClass`, multi-select `awardSubset`).
// Reads the roster from the useStudents cache (no second subscription), mints one
// shared batchId + timestamp, tags the kind in batchKindStore for the undo toast,
// and fires ONE atomic multi-row insert via useAwardPointsBatch.
//
// All-or-nothing (SPEC cluster #2 fix): the prior per-student fan-out with a silent
// `.catch(() => null)` filter is gone. awardClass/awardSubset THROW on any failure.
// On failure they run a deterministic recovery re-query (§3) to (a) name the
// offending student(s) via a fresh server roster diff and (b) disambiguate a lost
// network ack (was it actually committed?), record a session-ephemeral notice in
// failedBatchStore for the activity feed (CAP-3), then throw a BatchAwardError whose
// message the modal surfaces. A lost ack that DID commit is suppressed as success.

export class BatchAwardError extends Error {
  readonly classification: BatchFailureClassification;
  readonly batchId: string;
  readonly failedStudentNames?: string[];

  constructor(
    message: string,
    opts: {
      classification: BatchFailureClassification;
      batchId: string;
      failedStudentNames?: string[];
    }
  ) {
    super(message);
    this.name = 'BatchAwardError';
    this.classification = opts.classification;
    this.batchId = opts.batchId;
    this.failedStudentNames = opts.failedStudentNames;
  }
}

type RecoverResult =
  | { outcome: 'committed' }
  | {
      outcome: 'failed';
      classification: BatchFailureClassification;
      failedStudentNames?: string[];
    };

// A bounded ceiling on each recovery re-query. supabase-js GETs are retryable
// (up to 3 retries with exponential backoff ≈ 1s+2s+4s), which would otherwise hang
// the modal's "Awarding points..." spinner on a dead connection. AbortSignal.timeout
// caps a single slow/looping read so the network-class path falls through to the
// honest "could not confirm" state within ~2s (cf. the bounded fetch in AuthContext).
const RECOVERY_TIMEOUT_MS = 2000;

// §3 classification. The bulk mutationFn throws the raw error, so a server-reached
// failure is a PostgrestError carrying a SQLSTATE `.code`; a network-class failure
// (fetch rejected, no ack) has no such code. Both recovery reads are bounded by
// AbortSignal.timeout and wrapped so an abort/throw degrades to a definite outcome
// rather than escaping past the caller's catch.
async function classifyAndRecover(
  classroomId: string,
  batchId: string,
  attempted: StudentWithPoints[],
  err: unknown
): Promise<RecoverResult> {
  const code = (err as { code?: unknown } | null)?.code;
  const serverReached = typeof code === 'string' && code !== '';

  if (!serverReached) {
    // Network-class: no server ack. Did the rows commit anyway (at-least-once)?
    try {
      const { data, error } = await supabase
        .from('point_transactions')
        .select('id')
        .eq('batch_id', batchId)
        .abortSignal(AbortSignal.timeout(RECOVERY_TIMEOUT_MS));
      if (error || !data) return { outcome: 'failed', classification: 'indeterminate' };
      if (data.length === attempted.length && attempted.length > 0) {
        return { outcome: 'committed' };
      }
      return { outcome: 'failed', classification: 'ambient' };
    } catch {
      // Timed out / still offline → cannot confirm either way.
      return { outcome: 'failed', classification: 'indeterminate' };
    }
  }

  // Server reached → the whole statement rolled back (0 rows). Name the cause by
  // diffing the attempted ids against a FRESH server roster: the cache still lists
  // a concurrently-deleted student until its realtime invalidation lands (the very
  // lag that caused the FK reject), so diffing the cache against itself would find
  // nothing missing. Names for the missing ids come from the cached attempted
  // roster (it still has the deleted student's name).
  try {
    const { data: roster, error } = await supabase
      .from('students')
      .select('id')
      .eq('classroom_id', classroomId)
      .abortSignal(AbortSignal.timeout(RECOVERY_TIMEOUT_MS));
    if (error || !roster) return { outcome: 'failed', classification: 'ambient' };

    const present = new Set(roster.map((r) => r.id));
    const missing = attempted.filter((s) => !present.has(s.id));
    if (missing.length > 0) {
      return {
        outcome: 'failed',
        classification: 'per-row',
        failedStudentNames: missing.map((s) => s.name),
      };
    }
    return { outcome: 'failed', classification: 'ambient' };
  } catch {
    // Roster read failed after a server-reached error; can't name the cause.
    return { outcome: 'failed', classification: 'ambient' };
  }
}

function formatNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function buildMessage(result: RecoverResult, kind: BatchKind, attemptedCount: number): string {
  if (result.outcome === 'committed') return ''; // never surfaced
  if (result.classification === 'indeterminate') {
    return "Couldn't confirm the award — check your connection and the students' points before re-awarding.";
  }
  if (result.classification === 'per-row' && result.failedStudentNames?.length) {
    const names = formatNames(result.failedStudentNames);
    const verb = result.failedStudentNames.length === 1 ? 'is' : 'are';
    return `Couldn't award points — ${names} ${verb} no longer in this class. No points were awarded.`;
  }
  const who =
    kind === 'class'
      ? 'the class'
      : `the ${attemptedCount} selected student${attemptedCount === 1 ? '' : 's'}`;
  return `Couldn't award points to ${who}. No points were awarded — please try again.`;
}

export function useBatchAward(classroomId: string): {
  awardClass: (behavior: AppBehavior) => Promise<DbPointTransaction[]>;
  awardSubset: (
    studentIds: string[],
    behavior: AppBehavior,
    note?: string
  ) => Promise<DbPointTransaction[]>;
} {
  const qc = useQueryClient();
  const batchMutation = useAwardPointsBatch();

  const readRoster = useCallback(
    (): StudentWithPoints[] =>
      qc.getQueryData<StudentWithPoints[]>(queryKeys.students.byClassroom(classroomId)) ?? [],
    [qc, classroomId]
  );

  const runBatch = useCallback(
    async (
      attempted: StudentWithPoints[],
      behavior: AppBehavior,
      kind: BatchKind,
      note: string | null
    ): Promise<DbPointTransaction[]> => {
      const batchId = crypto.randomUUID();
      const timestamp = Date.now();

      // Tag AFTER the caller's early-return guards (handled in awardClass/awardSubset)
      // so no-op calls never reach here and never leak a Map entry.
      batchKindStore.tag(batchId, kind);

      try {
        return await batchMutation.mutateAsync({
          classroomId,
          batchId,
          timestamp,
          behavior,
          note,
          studentIds: attempted.map((s) => s.id),
        });
      } catch (err) {
        const result = await classifyAndRecover(classroomId, batchId, attempted, err);

        if (result.outcome === 'committed') {
          // CAP-6: a lost ack hid a server-side commit. Keep the tag (undo may
          // apply) and treat as success — the mutation's onSettled invalidation
          // already refetched the committed rows into the cache.
          return [];
        }

        // Real failure → zero rows written, so undo will never reference this
        // batchId; drop the tag to avoid a batchKindStore leak.
        batchKindStore.forget(batchId);

        const message = buildMessage(result, kind, attempted.length);
        failedBatchStore.record({
          batchId,
          classroomId,
          kind,
          behaviorName: behavior.name,
          behaviorIcon: behavior.icon,
          points: behavior.points,
          studentCount: attempted.length,
          timestamp,
          classification: result.classification,
          failedStudentNames: result.failedStudentNames,
        });

        throw new BatchAwardError(message, {
          classification: result.classification,
          batchId,
          failedStudentNames: result.failedStudentNames,
        });
      }
    },
    [batchMutation, classroomId]
  );

  const awardClass = useCallback(
    async (behavior: AppBehavior): Promise<DbPointTransaction[]> => {
      const students = readRoster();
      if (students.length === 0) return [];
      return runBatch(students, behavior, 'class', null);
    },
    [readRoster, runBatch]
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
      return runBatch(validStudents, behavior, 'subset', note ?? null);
    },
    [readRoster, runBatch]
  );

  return { awardClass, awardSubset };
}
