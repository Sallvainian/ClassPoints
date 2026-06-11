import { describe, it, expect } from 'vitest';
import { ClassroomFactory } from '../../support/fixtures/factories/classroom.factory';
import { UserFactory } from '../../support/fixtures/factories/user.factory';
import { supabaseAdmin } from '../../support/helpers/supabase-admin';
import { uniqueSlug } from '../../support/helpers/unique';

// Integration target G1:atomicity-integration — the ONLY level that proves CAP-1:
// `supabase.from('point_transactions').insert(rows).select()` is all-or-none
// (SPEC §2). Uses the service-role admin client (bypasses RLS) but FK
// constraints STILL apply (failure-handling.md §1.4), which is how the
// per-row failure in CAP-1 is triggered.

type StudentTotals = {
  point_total: number;
  positive_total: number;
  negative_total: number;
};

async function fetchStudentTotals(studentId: string): Promise<StudentTotals> {
  const { data, error } = await supabaseAdmin()
    .from('students')
    .select('point_total, positive_total, negative_total')
    .eq('id', studentId)
    .single();

  if (error || !data) {
    throw new Error(`fetchStudentTotals failed: ${error?.message ?? 'no student returned'}`);
  }

  return data;
}

async function fetchBatchRowIds(batchId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from('point_transactions')
    .select('id')
    .eq('batch_id', batchId);

  if (error) {
    throw new Error(`fetchBatchRowIds failed: ${error.message}`);
  }

  return (data ?? []).map((row) => row.id as string);
}

async function seedStudent(classroomId: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from('students')
    .insert({
      classroom_id: classroomId,
      name: `Student ${uniqueSlug()}`,
      avatar_color: '#4f46e5',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`seedStudent failed: ${error?.message ?? 'no student returned'}`);
  }

  return data.id as string;
}

// One row per targeted student, all sharing batchId — mirrors the single
// multi-row insert payload the rewritten useBatchAward emits (SPEC §2). +1
// positive points so the totals trigger bumps point_total/positive_total.
// Required NOT-NULL columns: behavior_name, behavior_icon, points,
// classroom_id, student_id (001_initial_schema.sql:54-59). behavior_id is
// nullable (line 56), batch_id is the CAP-5 correlation key, batch_kind is the
// deferred-#7 undo-label kind persisted on every batch row.
function buildBatchRows(classroomId: string, studentIds: string[], batchId: string) {
  return studentIds.map((studentId) => ({
    student_id: studentId,
    classroom_id: classroomId,
    behavior_id: null,
    behavior_name: 'Participation',
    behavior_icon: 'star',
    points: 1,
    note: null,
    batch_id: batchId,
    batch_kind: 'class',
  }));
}

describe('Batch award atomicity integration', () => {
  it('[P0][BATCH.01-INT-01] commits exactly N rows sharing one batch_id and bumps every total (CAP-1 happy path + CAP-5)', async () => {
    // CAP-1: all-valid inputs commit exactly N rows. CAP-5: N rows share one
    // batch_id. Totals trigger (011_add_student_point_totals.sql:45-47) fires
    // per row inside the same transaction.
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const studentIds = [
        await seedStudent(classroom.id),
        await seedStudent(classroom.id),
        await seedStudent(classroom.id),
      ];

      const before = await Promise.all(studentIds.map((id) => fetchStudentTotals(id)));

      const batchId = crypto.randomUUID();
      const { data, error } = await supabaseAdmin()
        .from('point_transactions')
        .insert(buildBatchRows(classroom.id, studentIds, batchId))
        .select();

      // CAP-1 success signal: no error, exactly N rows returned.
      expect(error).toBeNull();
      expect(data).toHaveLength(studentIds.length);

      // CAP-5: every committed row carries the single shared batch_id.
      // Deferred #7: every committed row also persists the batch_kind it was
      // inserted with — the durable cross-device undo-label source.
      for (const row of data!) {
        expect(row.batch_id).toBe(batchId);
        expect(row.batch_kind).toBe('class');
      }

      // SPEC success signal: SELECT WHERE batch_id = X shows exactly N rows.
      const persistedIds = await fetchBatchRowIds(batchId);
      expect(persistedIds).toHaveLength(studentIds.length);

      // CAP-1: the totals trigger bumped each student by the row's points (+1).
      for (let i = 0; i < studentIds.length; i += 1) {
        const after = await fetchStudentTotals(studentIds[i]);
        expect(after.point_total).toBe(before[i].point_total + 1);
        expect(after.positive_total).toBe(before[i].positive_total + 1);
        expect(after.negative_total).toBe(before[i].negative_total);
      }
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][BATCH.01-INT-02] rejects the whole batch with FK 23503 and writes zero rows when one student was deleted (CAP-1 all-or-none)', async () => {
    // CAP-1 — THE proof: one row in the batch references a concurrently-deleted
    // student (the canonical per-row cause, failure-handling.md §1.4). Postgres
    // rolls the whole INSERT...VALUES statement back: 0 rows, never a partial 2.
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const studentIds = [
        await seedStudent(classroom.id),
        await seedStudent(classroom.id),
        await seedStudent(classroom.id),
      ];

      // Concurrent-delete simulation: remove one student before the insert lands.
      const deletedStudentId = studentIds[2];
      const { error: deleteError } = await supabaseAdmin()
        .from('students')
        .delete()
        .eq('id', deletedStudentId);
      expect(deleteError).toBeNull();

      const survivingIds = [studentIds[0], studentIds[1]];
      const totalsBefore = await Promise.all(survivingIds.map((id) => fetchStudentTotals(id)));

      // Attempt a 3-row batch referencing ALL 3 original ids incl. the deleted one.
      const batchId = crypto.randomUUID();
      const { data, error } = await supabaseAdmin()
        .from('point_transactions')
        .insert(buildBatchRows(classroom.id, studentIds, batchId))
        .select();

      // CAP-1: any single FK rejection fails the entire batch loudly.
      // student_id FK = point_transactions_student_id_fkey → Postgres 23503.
      expect(data).toBeNull();
      expect(error).toBeTruthy();
      expect(error?.code).toBe('23503');

      // CAP-1 all-or-none: SELECT WHERE batch_id = X returns 0, NOT 2.
      const persistedIds = await fetchBatchRowIds(batchId);
      expect(persistedIds).toHaveLength(0);

      // CAP-1: the two SURVIVING students' totals are UNCHANGED — no partial
      // movement (the per-row trigger rolled back with the statement).
      for (let i = 0; i < survivingIds.length; i += 1) {
        const after = await fetchStudentTotals(survivingIds[i]);
        expect(after.point_total).toBe(totalsBefore[i].point_total);
        expect(after.positive_total).toBe(totalsBefore[i].positive_total);
        expect(after.negative_total).toBe(totalsBefore[i].negative_total);
      }
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][BATCH.01-INT-03] undo deletes exactly the N batch rows and walks totals back to pre-batch values (CAP-5)', async () => {
    // CAP-5: undo is a single delete-by-batch_id (useTransactions.ts:283) that
    // removes exactly the N rows and walks totals back. The totals trigger fires
    // per-row on DELETE too, so the round-trip is symmetric with the insert.
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const studentIds = [
        await seedStudent(classroom.id),
        await seedStudent(classroom.id),
        await seedStudent(classroom.id),
      ];

      const preBatch = await Promise.all(studentIds.map((id) => fetchStudentTotals(id)));

      const batchId = crypto.randomUUID();
      const { error: insertError } = await supabaseAdmin()
        .from('point_transactions')
        .insert(buildBatchRows(classroom.id, studentIds, batchId))
        .select();
      expect(insertError).toBeNull();

      // Sanity: the batch committed N rows before undo.
      expect(await fetchBatchRowIds(batchId)).toHaveLength(studentIds.length);

      // Undo: one delete-by-batch_id.
      const { error: undoError } = await supabaseAdmin()
        .from('point_transactions')
        .delete()
        .eq('batch_id', batchId);
      expect(undoError).toBeNull();

      // CAP-5: SELECT WHERE batch_id = X now returns 0 — exactly those N gone.
      expect(await fetchBatchRowIds(batchId)).toHaveLength(0);

      // CAP-5: totals walked back to pre-batch values.
      for (let i = 0; i < studentIds.length; i += 1) {
        const after = await fetchStudentTotals(studentIds[i]);
        expect(after.point_total).toBe(preBatch[i].point_total);
        expect(after.positive_total).toBe(preBatch[i].positive_total);
        expect(after.negative_total).toBe(preBatch[i].negative_total);
      }
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P1][BATCH.01-INT-04] rejects a bogus batch_kind with CHECK 23514 on the named constraint (deferred #7)', async () => {
    // Pins migration 20260611173650_add_batch_kind.sql: batch_kind is constrained
    // to ('class','subset') OR NULL by the NAMED constraint
    // point_transactions_batch_kind_check. A direct insert with any other value
    // must fail with Postgres 23514 (check_violation) and write zero rows.
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const studentId = await seedStudent(classroom.id);

      const batchId = crypto.randomUUID();
      const { data, error } = await supabaseAdmin()
        .from('point_transactions')
        .insert({
          student_id: studentId,
          classroom_id: classroom.id,
          behavior_id: null,
          behavior_name: 'Participation',
          behavior_icon: 'star',
          points: 1,
          note: null,
          batch_id: batchId,
          batch_kind: 'bogus',
        })
        .select();

      expect(data).toBeNull();
      expect(error).toBeTruthy();
      expect(error?.code).toBe('23514');
      expect(error?.message).toContain('point_transactions_batch_kind_check');

      // CHECK rejection wrote nothing.
      expect(await fetchBatchRowIds(batchId)).toHaveLength(0);
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });
});
