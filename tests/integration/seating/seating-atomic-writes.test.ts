import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { ClassroomFactory } from '../../support/fixtures/factories/classroom.factory';
import { UserFactory } from '../../support/fixtures/factories/user.factory';
import { createImpersonationPair } from '../../support/helpers/impersonation';
import { supabaseAdmin } from '../../support/helpers/supabase-admin';
import { uniqueSlug } from '../../support/helpers/unique';

// Integration proofs for the atomic seating RPCs (deferred #27, migration
// 20260610224711_seating_atomic_writes.sql): every DB-exercising row of the
// spec's I/O matrix, plus (a) a full-permutation randomize (breaks a
// merged-statement implementation), (b) a cross-tenant swap RLS-visibility
// proof, and (c) a happy path per RPC. Template: batch-award-atomicity.test.ts —
// service-role admin client (bypasses RLS; FK constraints and triggers STILL
// apply), forced failures, assert original state intact. The cross-tenant
// test uses authenticated anon-key clients so RLS actually filters.

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

async function seedChart(classroomId: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from('seating_charts')
    .insert({ classroom_id: classroomId })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`seedChart failed: ${error?.message ?? 'no chart returned'}`);
  }

  return data.id as string;
}

// Inserting a group fires trigger_auto_create_group_seats (4 seats per group);
// returns the auto-created seat ids ordered by position_in_group.
async function seedGroup(chartId: string, letter: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from('seating_groups')
    .insert({ seating_chart_id: chartId, letter, position_x: 0, position_y: 0 })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`seedGroup failed: ${error?.message ?? 'no group returned'}`);
  }

  const { data: seats, error: seatsError } = await supabaseAdmin()
    .from('seating_seats')
    .select('id')
    .eq('seating_group_id', data.id)
    .order('position_in_group', { ascending: true });

  if (seatsError || !seats || seats.length !== 4) {
    throw new Error(
      `seedGroup seat fetch failed: ${seatsError?.message ?? `expected 4 seats, got ${seats?.length ?? 0}`}`
    );
  }

  return seats.map((s) => s.id as string);
}

// Direct admin seed write — the single-seat trigger still applies, so each
// student goes into exactly one seat per chart.
async function setSeat(seatId: string, studentId: string | null): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('seating_seats')
    .update({ student_id: studentId })
    .eq('id', seatId);

  if (error) {
    throw new Error(`setSeat failed: ${error.message}`);
  }
}

async function fetchSeatOccupant(seatId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('seating_seats')
    .select('student_id')
    .eq('id', seatId)
    .single();

  if (error || !data) {
    throw new Error(`fetchSeatOccupant failed: ${error?.message ?? 'no seat returned'}`);
  }

  return data.student_id as string | null;
}

async function fetchChartSeatMap(chartId: string): Promise<Map<string, string | null>> {
  const { data: groups, error: groupsError } = await supabaseAdmin()
    .from('seating_groups')
    .select('id')
    .eq('seating_chart_id', chartId);

  if (groupsError) {
    throw new Error(`fetchChartSeatMap groups failed: ${groupsError.message}`);
  }

  const groupIds = (groups ?? []).map((g) => g.id as string);
  if (groupIds.length === 0) return new Map();

  const { data: seats, error: seatsError } = await supabaseAdmin()
    .from('seating_seats')
    .select('id, student_id')
    .in('seating_group_id', groupIds);

  if (seatsError) {
    throw new Error(`fetchChartSeatMap seats failed: ${seatsError.message}`);
  }

  return new Map((seats ?? []).map((s) => [s.id as string, s.student_id as string | null]));
}

type ChartSettings = {
  snap_enabled: boolean;
  grid_size: number;
  canvas_width: number;
  canvas_height: number;
};

async function fetchChartSettings(chartId: string): Promise<ChartSettings> {
  const { data, error } = await supabaseAdmin()
    .from('seating_charts')
    .select('snap_enabled, grid_size, canvas_width, canvas_height')
    .eq('id', chartId)
    .single();

  if (error || !data) {
    throw new Error(`fetchChartSettings failed: ${error?.message ?? 'no chart returned'}`);
  }

  return data as ChartSettings;
}

async function fetchGroupLetters(chartId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from('seating_groups')
    .select('letter')
    .eq('seating_chart_id', chartId)
    .order('letter', { ascending: true });

  if (error) {
    throw new Error(`fetchGroupLetters failed: ${error.message}`);
  }

  return (data ?? []).map((g) => g.letter as string);
}

async function fetchElementTypes(chartId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from('room_elements')
    .select('element_type')
    .eq('seating_chart_id', chartId);

  if (error) {
    throw new Error(`fetchElementTypes failed: ${error.message}`);
  }

  return (data ?? []).map((e) => e.element_type as string).sort();
}

// Anon-key client with NO session — exercises the `anon` role, which has
// EXECUTE revoked on all four RPCs (REVOKE/GRANT wiring proof).
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

// Valid camelCase layout — the shape the client stores in layout_data and the
// server validates BEFORE any write.
function validLayout() {
  return {
    groups: [
      { letter: 'A', x: 0, y: 0, rotation: 0 },
      { letter: 'B', x: 200, y: 0, rotation: 90 },
    ],
    roomElements: [
      { type: 'teacher_desk', label: 'Teacher', x: 400, y: 0, width: 120, height: 80, rotation: 0 },
    ],
    settings: { snapEnabled: false, gridSize: 20, canvasWidth: 1000, canvasHeight: 600 },
  };
}

describe('seating_assign_student', () => {
  it('[P0][SEAT.27-INT-01] assigns to an empty seat, then moves the student with a chart-scoped clear that never touches unrelated students (happy + stale-cache rows)', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const chartId = await seedChart(classroom.id);
      const seats = await seedGroup(chartId, 'A');
      const studentA = await seedStudent(classroom.id);
      const studentB = await seedStudent(classroom.id);
      await setSeat(seats[2], studentB); // unrelated student, must never move

      // Happy: empty seat.
      const first = await supabaseAdmin().rpc('seating_assign_student', {
        p_chart_id: chartId,
        p_seat_id: seats[0],
        p_student_id: studentA,
      });
      expect(first.error).toBeNull();
      expect(await fetchSeatOccupant(seats[0])).toBe(studentA);

      // Move: no seat id supplied for the clear — the server clears by
      // student + chart scope, so at-most-one-seat holds regardless of any
      // stale client cache, and studentB's seat is untouched.
      const second = await supabaseAdmin().rpc('seating_assign_student', {
        p_chart_id: chartId,
        p_seat_id: seats[1],
        p_student_id: studentA,
      });
      expect(second.error).toBeNull();
      expect(await fetchSeatOccupant(seats[1])).toBe(studentA);
      expect(await fetchSeatOccupant(seats[0])).toBeNull();
      expect(await fetchSeatOccupant(seats[2])).toBe(studentB);
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][SEAT.27-INT-02] raises on a concurrently-deleted student — the seat keeps its original occupant', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const chartId = await seedChart(classroom.id);
      const seats = await seedGroup(chartId, 'A');
      const studentA = await seedStudent(classroom.id);
      await setSeat(seats[0], studentA);

      // Concurrently-deleted student: passes the seat pre-check, then fails
      // the student-classroom-membership guard (which preempts the FK error —
      // the FK remains the in-transaction backstop either way).
      const deletedStudent = await seedStudent(classroom.id);
      const { error: deleteError } = await supabaseAdmin()
        .from('students')
        .delete()
        .eq('id', deletedStudent);
      expect(deleteError).toBeNull();

      const { error } = await supabaseAdmin().rpc('seating_assign_student', {
        p_chart_id: chartId,
        p_seat_id: seats[0],
        p_student_id: deletedStudent,
      });
      expect(error).toBeTruthy();
      expect(error?.code).toBe('P0001');
      expect(error?.message).toMatch(/not in the classroom/);

      // Zero writes: the seat keeps its original occupant.
      expect(await fetchSeatOccupant(seats[0])).toBe(studentA);
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][SEAT.27-INT-03] raises on a cross-chart or deleted seat id and rolls back the clear — the student keeps the original seat', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom1 = await classrooms.create({ userId: user.id });
      const classroom2 = await classrooms.create({ userId: user.id });
      const chart1 = await seedChart(classroom1.id);
      const chart2 = await seedChart(classroom2.id);
      const seats1 = await seedGroup(chart1, 'A');
      const seats2 = await seedGroup(chart2, 'A');
      const studentA = await seedStudent(classroom1.id);
      await setSeat(seats1[0], studentA);

      // Cross-chart seat (edge: stale cache pointing at another chart's seat).
      const crossChart = await supabaseAdmin().rpc('seating_assign_student', {
        p_chart_id: chart1,
        p_seat_id: seats2[0],
        p_student_id: studentA,
      });
      expect(crossChart.error).toBeTruthy();
      expect(crossChart.error?.code).toBe('P0001');

      // Concurrently-deleted seat (nonexistent id).
      const missingSeat = await supabaseAdmin().rpc('seating_assign_student', {
        p_chart_id: chart1,
        p_seat_id: crypto.randomUUID(),
        p_student_id: studentA,
      });
      expect(missingSeat.error).toBeTruthy();
      expect(missingSeat.error?.code).toBe('P0001');

      // Zero writes either time: the student is NOT stranded seatless, and the
      // foreign chart's seat was never touched.
      expect(await fetchSeatOccupant(seats1[0])).toBe(studentA);
      expect(await fetchSeatOccupant(seats2[0])).toBeNull();
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][SEAT.27-INT-17] raises when the student belongs to a different classroom — no writes (FK validation bypasses students RLS)', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom1 = await classrooms.create({ userId: user.id });
      const classroom2 = await classrooms.create({ userId: user.id });
      const chartId = await seedChart(classroom1.id);
      const seats = await seedGroup(chartId, 'A');
      const studentA = await seedStudent(classroom1.id);
      const foreignStudent = await seedStudent(classroom2.id);
      await setSeat(seats[0], studentA);

      const { error } = await supabaseAdmin().rpc('seating_assign_student', {
        p_chart_id: chartId,
        p_seat_id: seats[0],
        p_student_id: foreignStudent,
      });
      expect(error).toBeTruthy();
      expect(error?.code).toBe('P0001');
      expect(error?.message).toMatch(/not in the classroom/);

      // Zero writes: the seat keeps its occupant, the foreign student was
      // never seated.
      expect(await fetchSeatOccupant(seats[0])).toBe(studentA);
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });
});

describe('seating_swap_students', () => {
  it('[P0][SEAT.27-INT-04] swaps two occupied seats and moves into an empty seat (server reads occupants, not cache values)', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const chartId = await seedChart(classroom.id);
      const seats = await seedGroup(chartId, 'A');
      const studentA = await seedStudent(classroom.id);
      const studentB = await seedStudent(classroom.id);
      await setSeat(seats[0], studentA);
      await setSeat(seats[1], studentB);

      // Occupied <-> occupied.
      const swap = await supabaseAdmin().rpc('seating_swap_students', {
        p_seat_id_1: seats[0],
        p_seat_id_2: seats[1],
      });
      expect(swap.error).toBeNull();
      expect(await fetchSeatOccupant(seats[0])).toBe(studentB);
      expect(await fetchSeatOccupant(seats[1])).toBe(studentA);

      // Occupied <-> empty (move semantics).
      const move = await supabaseAdmin().rpc('seating_swap_students', {
        p_seat_id_1: seats[0],
        p_seat_id_2: seats[2],
      });
      expect(move.error).toBeNull();
      expect(await fetchSeatOccupant(seats[0])).toBeNull();
      expect(await fetchSeatOccupant(seats[2])).toBe(studentB);
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][SEAT.27-INT-05] raises when the second seat is missing — both seats unchanged (no half-swap)', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const chartId = await seedChart(classroom.id);
      const seats = await seedGroup(chartId, 'A');
      const studentA = await seedStudent(classroom.id);
      await setSeat(seats[0], studentA);

      const { error } = await supabaseAdmin().rpc('seating_swap_students', {
        p_seat_id_1: seats[0],
        p_seat_id_2: crypto.randomUUID(),
      });
      expect(error).toBeTruthy();
      expect(error?.code).toBe('P0001');

      expect(await fetchSeatOccupant(seats[0])).toBe(studentA);
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][SEAT.27-INT-06] cross-tenant swap: an RLS-invisible seat raises with zero writes (authenticated client, RLS-visibility proof)', async () => {
    const pair = await createImpersonationPair();
    const classrooms = new ClassroomFactory();

    try {
      // Teacher A's chart + seated student.
      const classroomA = await classrooms.create({ userId: pair.userARecord.id });
      const chartA = await seedChart(classroomA.id);
      const seatsA = await seedGroup(chartA, 'A');
      const studentA = await seedStudent(classroomA.id);
      await setSeat(seatsA[0], studentA);

      // Teacher B's chart + seated student.
      const classroomB = await classrooms.create({ userId: pair.userBRecord.id });
      const chartB = await seedChart(classroomB.id);
      const seatsB = await seedGroup(chartB, 'A');
      const studentB = await seedStudent(classroomB.id);
      await setSeat(seatsB[0], studentB);

      // SECURITY INVOKER: teacher A's authenticated client cannot see teacher
      // B's seat through the classroom-join RLS policies, so the FOR UPDATE
      // read raises — never a one-sided clear/set.
      const { error } = await pair.userA.rpc('seating_swap_students', {
        p_seat_id_1: seatsA[0],
        p_seat_id_2: seatsB[0],
      });
      expect(error).toBeTruthy();
      expect(error?.code).toBe('P0001');

      // Zero writes on BOTH sides (admin-verified).
      expect(await fetchSeatOccupant(seatsA[0])).toBe(studentA);
      expect(await fetchSeatOccupant(seatsB[0])).toBe(studentB);
    } finally {
      await classrooms.cleanup();
      await pair.cleanup();
    }
  });

  it('[P0][SEAT.27-INT-15] raises on a same-teacher cross-chart swap — zero writes (same-chart guard)', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom1 = await classrooms.create({ userId: user.id });
      const classroom2 = await classrooms.create({ userId: user.id });
      const chart1 = await seedChart(classroom1.id);
      const chart2 = await seedChart(classroom2.id);
      const seats1 = await seedGroup(chart1, 'A');
      const seats2 = await seedGroup(chart2, 'A');
      const studentA = await seedStudent(classroom1.id);
      const studentB = await seedStudent(classroom2.id);
      await setSeat(seats1[0], studentA);
      await setSeat(seats2[0], studentB);

      // Both seats are visible to the same teacher (and to the admin client),
      // so only the same-chart guard stands between this call and a silent
      // cross-chart student leak.
      const { error } = await supabaseAdmin().rpc('seating_swap_students', {
        p_seat_id_1: seats1[0],
        p_seat_id_2: seats2[0],
      });
      expect(error).toBeTruthy();
      expect(error?.code).toBe('P0001');
      expect(error?.message).toMatch(/not in the same seating chart/);

      expect(await fetchSeatOccupant(seats1[0])).toBe(studentA);
      expect(await fetchSeatOccupant(seats2[0])).toBe(studentB);
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });
});

describe('seating_randomize', () => {
  it('[P0][SEAT.27-INT-07] applies a full permutation across 8 seats — every student changes seats (breaks a merged-statement implementation)', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const chartId = await seedChart(classroom.id);
      const seats = [...(await seedGroup(chartId, 'A')), ...(await seedGroup(chartId, 'B'))];
      const students: string[] = [];
      for (let i = 0; i < seats.length; i += 1) {
        const studentId = await seedStudent(classroom.id);
        students.push(studentId);
        await setSeat(seats[i], studentId);
      }

      // Cyclic shift: seat i gets the student currently in seat i-1 — a
      // derangement (no fixed points), so every student changes seats. A
      // merged clear+set UPDATE would trip the single-seat BEFORE trigger on
      // some row orderings; the separate clear statement makes this
      // deterministic.
      const assignments = seats.map((seatId, i) => ({
        seat_id: seatId,
        student_id: students[(i + seats.length - 1) % seats.length],
      }));

      const { error } = await supabaseAdmin().rpc('seating_randomize', {
        p_chart_id: chartId,
        p_assignments: assignments,
      });
      expect(error).toBeNull();

      const after = await fetchChartSeatMap(chartId);
      for (const { seat_id, student_id } of assignments) {
        expect(after.get(seat_id)).toBe(student_id);
      }
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][SEAT.27-INT-08] rejects empty and non-array payloads before any write', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const chartId = await seedChart(classroom.id);
      const seats = await seedGroup(chartId, 'A');
      const studentA = await seedStudent(classroom.id);
      await setSeat(seats[0], studentA);

      const empty = await supabaseAdmin().rpc('seating_randomize', {
        p_chart_id: chartId,
        p_assignments: [],
      });
      expect(empty.error).toBeTruthy();
      expect(empty.error?.code).toBe('P0001');

      const nonArray = await supabaseAdmin().rpc('seating_randomize', {
        p_chart_id: chartId,
        p_assignments: { seat_id: seats[0], student_id: studentA },
      });
      expect(nonArray.error).toBeTruthy();
      expect(nonArray.error?.code).toBe('P0001');

      expect(await fetchSeatOccupant(seats[0])).toBe(studentA);
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][SEAT.27-INT-09] rolls back ALL seats on a failing assignment (mid-apply trigger raise, foreign seat id, or deleted student) — original assignments intact', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom1 = await classrooms.create({ userId: user.id });
      const classroom2 = await classrooms.create({ userId: user.id });
      const chart1 = await seedChart(classroom1.id);
      const chart2 = await seedChart(classroom2.id);
      const seats = await seedGroup(chart1, 'A');
      const foreignSeats = await seedGroup(chart2, 'A');
      const studentA = await seedStudent(classroom1.id);
      const studentB = await seedStudent(classroom1.id);
      await setSeat(seats[0], studentA);
      await setSeat(seats[1], studentB);
      const before = await fetchChartSeatMap(chart1);

      // Duplicate STUDENT across two distinct seats passes every pre-write
      // guard, so the clear runs inside the transaction and the apply then
      // trips the single-seat trigger mid-statement — EVERYTHING rolls back,
      // seats keep their original students (THE mid-apply rollback proof).
      const midApplyFail = await supabaseAdmin().rpc('seating_randomize', {
        p_chart_id: chart1,
        p_assignments: [
          { seat_id: seats[0], student_id: studentB },
          { seat_id: seats[1], student_id: studentB },
        ],
      });
      expect(midApplyFail.error).toBeTruthy();
      expect(midApplyFail.error?.code).toBe('P0001');
      expect(midApplyFail.error?.message).toMatch(/already assigned/);
      expect(await fetchChartSeatMap(chart1)).toEqual(before);

      // A concurrently-deleted student fails the classroom-membership guard
      // before any write (preempts the FK; the FK stays the backstop).
      const deletedStudent = await seedStudent(classroom1.id);
      await supabaseAdmin().from('students').delete().eq('id', deletedStudent);

      const deletedFail = await supabaseAdmin().rpc('seating_randomize', {
        p_chart_id: chart1,
        p_assignments: [
          { seat_id: seats[0], student_id: studentB },
          { seat_id: seats[1], student_id: deletedStudent },
        ],
      });
      expect(deletedFail.error).toBeTruthy();
      expect(deletedFail.error?.code).toBe('P0001');
      expect(deletedFail.error?.message).toMatch(/classroom/);
      expect(await fetchChartSeatMap(chart1)).toEqual(before);

      // A seat id from another chart fails the NULL-strict count-match guard
      // before any write.
      const foreignSeat = await supabaseAdmin().rpc('seating_randomize', {
        p_chart_id: chart1,
        p_assignments: [{ seat_id: foreignSeats[0], student_id: studentA }],
      });
      expect(foreignSeat.error).toBeTruthy();
      expect(foreignSeat.error?.code).toBe('P0001');
      expect(await fetchChartSeatMap(chart1)).toEqual(before);
      expect(await fetchSeatOccupant(foreignSeats[0])).toBeNull();
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][SEAT.27-INT-16] raises on duplicate seat_ids in the payload — original assignments intact', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const chartId = await seedChart(classroom.id);
      const seats = await seedGroup(chartId, 'A');
      const studentA = await seedStudent(classroom.id);
      const studentB = await seedStudent(classroom.id);
      await setSeat(seats[0], studentA);
      await setSeat(seats[1], studentB);
      const before = await fetchChartSeatMap(chartId);

      // Two rows targeting the same seat would make the apply UPDATE
      // last-writer-wins on an arbitrary row order — must raise instead.
      const { error } = await supabaseAdmin().rpc('seating_randomize', {
        p_chart_id: chartId,
        p_assignments: [
          { seat_id: seats[0], student_id: studentB },
          { seat_id: seats[0], student_id: studentA },
        ],
      });
      expect(error).toBeTruthy();
      expect(error?.code).toBe('P0001');
      expect(error?.message).toMatch(/duplicate seat_id/);

      expect(await fetchChartSeatMap(chartId)).toEqual(before);
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });
});

describe('seating_apply_preset', () => {
  it('[P0][SEAT.27-INT-10] replaces the layout atomically: settings updated, old groups/elements gone, seats auto-created per new group', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const chartId = await seedChart(classroom.id);
      await seedGroup(chartId, 'Z'); // pre-existing layout to be replaced
      await supabaseAdmin().from('room_elements').insert({
        seating_chart_id: chartId,
        element_type: 'door',
        position_x: 0,
        position_y: 0,
      });

      const { error } = await supabaseAdmin().rpc('seating_apply_preset', {
        p_chart_id: chartId,
        p_layout: validLayout(),
      });
      expect(error).toBeNull();

      expect(await fetchChartSettings(chartId)).toEqual({
        snap_enabled: false,
        grid_size: 20,
        canvas_width: 1000,
        canvas_height: 600,
      });
      expect(await fetchGroupLetters(chartId)).toEqual(['A', 'B']);
      expect(await fetchElementTypes(chartId)).toEqual(['teacher_desk']);

      // trigger_auto_create_group_seats: 4 empty seats per reinserted group.
      const seatMap = await fetchChartSeatMap(chartId);
      expect(seatMap.size).toBe(8);
      expect([...seatMap.values()].every((occupant) => occupant === null)).toBe(true);
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][SEAT.27-INT-11] raises a named validation error BEFORE any write on a corrupt layout — chart fully intact', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const chartId = await seedChart(classroom.id);
      await seedGroup(chartId, 'Z');
      const settingsBefore = await fetchChartSettings(chartId);

      const layout = validLayout();
      const corruptVariants: { name: string; layout: unknown; message: RegExp }[] = [
        {
          name: 'missing groups array',
          layout: { roomElements: layout.roomElements, settings: layout.settings },
          message: /groups must be an array/,
        },
        {
          name: 'mistyped gridSize (string)',
          layout: { ...layout, settings: { ...layout.settings, gridSize: '20' } },
          message: /gridSize must be a number/,
        },
        {
          name: 'missing snapEnabled',
          layout: {
            ...layout,
            settings: {
              gridSize: 20,
              canvasWidth: 1000,
              canvasHeight: 600,
            },
          },
          message: /snapEnabled must be a boolean/,
        },
        {
          name: 'null canvasWidth',
          layout: { ...layout, settings: { ...layout.settings, canvasWidth: null } },
          message: /canvasWidth must be a number/,
        },
      ];

      for (const variant of corruptVariants) {
        const { error } = await supabaseAdmin().rpc('seating_apply_preset', {
          p_chart_id: chartId,
          p_layout: variant.layout,
        });
        expect(error, variant.name).toBeTruthy();
        expect(error?.code, variant.name).toBe('P0001');
        expect(error?.message, variant.name).toMatch(variant.message);
      }

      // ZERO writes across all corrupt attempts.
      expect(await fetchChartSettings(chartId)).toEqual(settingsBefore);
      expect(await fetchGroupLetters(chartId)).toEqual(['Z']);
      expect((await fetchChartSeatMap(chartId)).size).toBe(4);
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][SEAT.27-INT-12] rolls back the deletes when a reinsert fails mid-transaction (duplicate letter 23505) — chart intact', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const chartId = await seedChart(classroom.id);
      await seedGroup(chartId, 'Z');
      const settingsBefore = await fetchChartSettings(chartId);

      // Passes shape validation, then the group reinsert violates
      // UNIQUE(seating_chart_id, letter) AFTER the deletes ran in-transaction.
      const layout = validLayout();
      layout.groups = [
        { letter: 'A', x: 0, y: 0, rotation: 0 },
        { letter: 'A', x: 200, y: 0, rotation: 0 },
      ];

      const { error } = await supabaseAdmin().rpc('seating_apply_preset', {
        p_chart_id: chartId,
        p_layout: layout,
      });
      expect(error).toBeTruthy();
      expect(error?.code).toBe('23505');

      // Full rollback INCLUDING the deletes: the old layout survives.
      expect(await fetchChartSettings(chartId)).toEqual(settingsBefore);
      expect(await fetchGroupLetters(chartId)).toEqual(['Z']);
      expect((await fetchChartSeatMap(chartId)).size).toBe(4);
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][SEAT.27-INT-13] applies a valid empty layout as an intentional full wipe', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });
      const chartId = await seedChart(classroom.id);
      await seedGroup(chartId, 'Z');

      const layout = validLayout();
      layout.groups = [];
      layout.roomElements = [];

      const { error } = await supabaseAdmin().rpc('seating_apply_preset', {
        p_chart_id: chartId,
        p_layout: layout,
      });
      expect(error).toBeNull();

      expect(await fetchGroupLetters(chartId)).toEqual([]);
      expect(await fetchElementTypes(chartId)).toEqual([]);
      expect((await fetchChartSeatMap(chartId)).size).toBe(0);
      expect(await fetchChartSettings(chartId)).toEqual({
        snap_enabled: false,
        grid_size: 20,
        canvas_width: 1000,
        canvas_height: 600,
      });
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });

  it('[P0][SEAT.27-INT-14] raises on an invisible chart id — zero writes, never a silent no-op success', async () => {
    const { error } = await supabaseAdmin().rpc('seating_apply_preset', {
      p_chart_id: crypto.randomUUID(),
      p_layout: validLayout(),
    });
    expect(error).toBeTruthy();
    expect(error?.code).toBe('P0001');
    expect(error?.message).toMatch(/not found/);
  });
});

describe('seating RPC grants', () => {
  it('[P0][SEAT.27-INT-18] denies EXECUTE (42501) to an unauthenticated anon-key client on all four RPCs (REVOKE/GRANT wiring proof)', async () => {
    const anon = unauthenticatedClient();
    const dummyId = crypto.randomUUID();

    const assign = await anon.rpc('seating_assign_student', {
      p_chart_id: dummyId,
      p_seat_id: dummyId,
      p_student_id: dummyId,
    });
    expect(assign.error, 'seating_assign_student').toBeTruthy();
    expect(assign.error?.code, 'seating_assign_student').toBe('42501');

    const swap = await anon.rpc('seating_swap_students', {
      p_seat_id_1: dummyId,
      p_seat_id_2: dummyId,
    });
    expect(swap.error, 'seating_swap_students').toBeTruthy();
    expect(swap.error?.code, 'seating_swap_students').toBe('42501');

    const randomize = await anon.rpc('seating_randomize', {
      p_chart_id: dummyId,
      p_assignments: [{ seat_id: dummyId, student_id: dummyId }],
    });
    expect(randomize.error, 'seating_randomize').toBeTruthy();
    expect(randomize.error?.code, 'seating_randomize').toBe('42501');

    const applyPreset = await anon.rpc('seating_apply_preset', {
      p_chart_id: dummyId,
      p_layout: validLayout(),
    });
    expect(applyPreset.error, 'seating_apply_preset').toBeTruthy();
    expect(applyPreset.error?.code, 'seating_apply_preset').toBe('42501');
  });
});
