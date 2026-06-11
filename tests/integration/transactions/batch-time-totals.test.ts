import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { ClassroomFactory } from '../../support/fixtures/factories/classroom.factory';
import { createImpersonationPair } from '../../support/helpers/impersonation';
import { supabaseAdmin } from '../../support/helpers/supabase-admin';
import { uniqueSlug } from '../../support/helpers/unique';

// Integration proofs for the batched time-totals RPC (deferred #8, migration
// 20260611145458_batch_time_totals_rpc.sql): a SINGLE
// get_student_time_totals_all_for_user call returns correct per-classroom
// totals across ≥2 classrooms (legacy per-classroom aggregation semantics
// preserved), and SECURITY INVOKER + the point_transactions RLS policy bound
// the rows — teacher A's call returns ZERO rows for teacher B's classrooms.
// Template: seating-atomic-writes.test.ts — admin client seeds (bypasses RLS),
// authenticated impersonation clients exercise the RLS boundary.

type RpcRow = {
  classroom_id: string;
  student_id: string;
  today_total: number;
  this_week_total: number;
};

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

// Admin insert with an explicit created_at — point_transactions.created_at is
// DEFAULT NOW() but accepts a supplied value, which is how rows land inside /
// outside the today/week windows deterministically.
async function seedTransaction(
  classroomId: string,
  studentId: string,
  points: number,
  createdAt: Date
): Promise<void> {
  const { error } = await supabaseAdmin().from('point_transactions').insert({
    student_id: studentId,
    classroom_id: classroomId,
    behavior_id: null,
    behavior_name: 'Totals seed',
    behavior_icon: 'star',
    points,
    created_at: createdAt.toISOString(),
  });

  if (error) {
    throw new Error(`seedTransaction failed: ${error.message}`);
  }
}

// Anon-key client with NO session — exercises the `anon` role, which has
// EXECUTE revoked (REVOKE/GRANT wiring proof).
function unauthenticatedClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'unauthenticatedClient() requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. ' +
        'Set them in .env.test (values come from `supabase status`).'
    );
  }

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Window boundaries are RPC params, so the test pins them relative to now()
// instead of real calendar boundaries — no Monday/midnight flakiness:
//   today window starts 1h ago, week window starts 72h ago.
function windows() {
  const now = Date.now();
  return {
    startOfToday: new Date(now - 1 * 60 * 60 * 1000),
    startOfWeek: new Date(now - 72 * 60 * 60 * 1000),
    insideToday: new Date(now - 10 * 60 * 1000), // counts in today AND week
    insideWeekOnly: new Date(now - 24 * 60 * 60 * 1000), // counts in week only
    outsideWeek: new Date(now - 100 * 60 * 60 * 1000), // excluded entirely
  };
}

describe('get_student_time_totals_all_for_user', () => {
  it('[P0][BATCH8-INT-01] one call returns correct per-classroom totals across two classrooms (legacy aggregation semantics)', async () => {
    const pair = await createImpersonationPair();
    const classrooms = new ClassroomFactory();

    try {
      const w = windows();

      // Two classrooms for teacher A, one student each, plus a quiet student.
      const classroom1 = await classrooms.create({ userId: pair.userARecord.id });
      const classroom2 = await classrooms.create({ userId: pair.userARecord.id });
      const student1 = await seedStudent(classroom1.id);
      const student2 = await seedStudent(classroom2.id);
      const quietStudent = await seedStudent(classroom1.id);

      // classroom1/student1: +5 today, -2 week-only, +100 outside the week
      // (the prefilter excludes it from BOTH sums) → today=5, week=3.
      await seedTransaction(classroom1.id, student1, 5, w.insideToday);
      await seedTransaction(classroom1.id, student1, -2, w.insideWeekOnly);
      await seedTransaction(classroom1.id, student1, 100, w.outsideWeek);
      // classroom2/student2: +7 week-only → today=0, week=7.
      await seedTransaction(classroom2.id, student2, 7, w.insideWeekOnly);

      const { data, error } = await pair.userA.rpc('get_student_time_totals_all_for_user', {
        p_start_of_today: w.startOfToday.toISOString(),
        p_start_of_week: w.startOfWeek.toISOString(),
      });
      expect(error).toBeNull();

      const rows = (data ?? []) as RpcRow[];
      const row1 = rows.find((r) => r.student_id === student1);
      const row2 = rows.find((r) => r.student_id === student2);

      // Per-classroom attribution + window sums in ONE round-trip.
      expect(row1).toEqual({
        classroom_id: classroom1.id,
        student_id: student1,
        today_total: 5,
        this_week_total: 3,
      });
      expect(row2).toEqual({
        classroom_id: classroom2.id,
        student_id: student2,
        today_total: 0,
        this_week_total: 7,
      });

      // Quiet student (zero transactions this week): NO row — clients default
      // missing rows to 0, same as the dropped per-classroom RPC.
      expect(rows.find((r) => r.student_id === quietStudent)).toBeUndefined();
    } finally {
      await classrooms.cleanup();
      await pair.cleanup();
    }
  });

  it('[P0][BATCH8-INT-02] RLS proof: teacher A gets ZERO rows for teacher B classrooms (SECURITY INVOKER, no classroom param to spoof)', async () => {
    const pair = await createImpersonationPair();
    const classrooms = new ClassroomFactory();

    try {
      const w = windows();

      const classroomA = await classrooms.create({ userId: pair.userARecord.id });
      const classroomB = await classrooms.create({ userId: pair.userBRecord.id });
      const studentA = await seedStudent(classroomA.id);
      const studentB = await seedStudent(classroomB.id);
      await seedTransaction(classroomA.id, studentA, 3, w.insideToday);
      await seedTransaction(classroomB.id, studentB, 9, w.insideToday);

      const args = {
        p_start_of_today: w.startOfToday.toISOString(),
        p_start_of_week: w.startOfWeek.toISOString(),
      };

      // Teacher A sees ONLY their own classroom's rows.
      const aResult = await pair.userA.rpc('get_student_time_totals_all_for_user', args);
      expect(aResult.error).toBeNull();
      const aRows = (aResult.data ?? []) as RpcRow[];
      expect(aRows.some((r) => r.classroom_id === classroomB.id)).toBe(false);
      expect(aRows.find((r) => r.student_id === studentA)).toMatchObject({
        classroom_id: classroomA.id,
        today_total: 3,
      });

      // Symmetric check: teacher B never sees teacher A's rows either.
      const bResult = await pair.userB.rpc('get_student_time_totals_all_for_user', args);
      expect(bResult.error).toBeNull();
      const bRows = (bResult.data ?? []) as RpcRow[];
      expect(bRows.some((r) => r.classroom_id === classroomA.id)).toBe(false);
      expect(bRows.find((r) => r.student_id === studentB)).toMatchObject({
        classroom_id: classroomB.id,
        today_total: 9,
      });
    } finally {
      await classrooms.cleanup();
      await pair.cleanup();
    }
  });

  it('[P1][BATCH8-INT-03] denies EXECUTE (42501) to an unauthenticated anon-key client (REVOKE/GRANT wiring proof)', async () => {
    const w = windows();
    const { error } = await unauthenticatedClient().rpc('get_student_time_totals_all_for_user', {
      p_start_of_today: w.startOfToday.toISOString(),
      p_start_of_week: w.startOfWeek.toISOString(),
    });
    expect(error).toBeTruthy();
    expect(error?.code).toBe('42501');
  });
});
