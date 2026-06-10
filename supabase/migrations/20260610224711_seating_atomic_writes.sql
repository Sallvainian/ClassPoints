-- Atomic seating multi-write RPCs (deferred #27).
--
-- Four single-transaction functions replacing the client-side multi-write
-- sequences in useSeatingChart.ts (assign / swap / randomize / apply-preset).
-- A plpgsql function body runs in ONE transaction: any RAISE or statement
-- error rolls back every prior statement, so partial seat state can no longer
-- persist (clear-success/set-fail, half-swap, partial randomize, preset wipe).
--
-- Conventions (match get_student_time_totals hardening,
-- 20260429181608_harden_database_linter_findings.sql:73-97,202-203):
--   * public schema, LANGUAGE plpgsql, RETURNS void
--   * explicit SECURITY INVOKER — the classroom-join RLS policies on
--     seating_charts/seating_groups/seating_seats/room_elements remain the
--     authz boundary; these functions add NO privilege
--   * explicit SET search_path = '' — all schema refs fully qualified
--   * REVOKE FROM PUBLIC, anon + GRANT EXECUTE TO authenticated, service_role
--
-- Trigger interplay (load-bearing): trigger_ensure_student_single_seat is a
-- BEFORE INSERT OR UPDATE OF student_id, FOR EACH ROW trigger that raises on a
-- duplicate student per chart. Within a single statement it sees earlier rows
-- of the SAME statement in unpredictable order, so every clear and every set
-- below is a SEPARATE SQL statement — a merged clear+set UPDATE would raise
-- flakily on permutations. The trigger stays the invariant enforcer.

-- ============================================
-- 1. seating_assign_student
-- ============================================
-- Clear-before-assign in one transaction. The clear is scoped by
-- student + chart (NOT a cache-supplied seat id) so a stale client cache can
-- never unassign an unrelated student (edge-4). The seat is verified to belong
-- to the chart BEFORE any write — a concurrently-deleted / RLS-filtered /
-- cross-chart seat raises instead of silently committing the clear and
-- stranding the student.
CREATE OR REPLACE FUNCTION public.seating_assign_student(
  p_chart_id uuid,
  p_seat_id uuid,
  p_student_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- A NULL student would silently turn a direct call into an unassign.
  IF p_student_id IS NULL THEN
    RAISE EXCEPTION 'seating_assign_student: student id must not be null';
  END IF;

  -- Verify + lock the target seat before writing anything. Raises (zero
  -- writes) when the seat is missing, RLS-invisible, or in another chart.
  PERFORM 1
  FROM public.seating_seats AS ss
  JOIN public.seating_groups AS sg ON sg.id = ss.seating_group_id
  WHERE ss.id = p_seat_id
    AND sg.seating_chart_id = p_chart_id
  FOR UPDATE OF ss;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'seating_assign_student: seat % not found in chart %', p_seat_id, p_chart_id;
  END IF;

  -- The student must belong to the chart's classroom. The seats FK alone is
  -- not enough: FK validation runs as the table owner and bypasses students
  -- RLS, so a foreign student uuid would otherwise seat successfully.
  PERFORM 1
  FROM public.students AS st
  JOIN public.seating_charts AS sc ON sc.classroom_id = st.classroom_id
  WHERE st.id = p_student_id
    AND sc.id = p_chart_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'seating_assign_student: student % is not in the classroom of chart %', p_student_id, p_chart_id;
  END IF;

  -- Clear the student's current seat(s) in THIS chart (separate statement —
  -- see trigger note in the header).
  UPDATE public.seating_seats AS ss
  SET student_id = NULL
  FROM public.seating_groups AS sg
  WHERE sg.id = ss.seating_group_id
    AND sg.seating_chart_id = p_chart_id
    AND ss.student_id = p_student_id;

  -- Set the new seat. The row is locked above, but IF NOT FOUND still guards
  -- the 0-row UPDATE path (e.g. an UPDATE RLS policy narrower than SELECT) —
  -- an invisible row must roll back the clear, never report success.
  UPDATE public.seating_seats
  SET student_id = p_student_id
  WHERE id = p_seat_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'seating_assign_student: seat % could not be updated', p_seat_id;
  END IF;
END;
$$;

-- ============================================
-- 2. seating_swap_students
-- ============================================
-- Reads both seats' occupants server-side under FOR UPDATE (never trusts
-- cache-passed student ids) and raises if either row is not visible — a
-- missing / RLS-filtered seat means zero writes, never a half-swap. Both
-- seats must belong to the same chart (assign has the equivalent guard).
CREATE OR REPLACE FUNCTION public.seating_swap_students(
  p_seat_id_1 uuid,
  p_seat_id_2 uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_locked_count integer;
  v_chart_count integer;
  v_student_1 uuid;
  v_student_2 uuid;
BEGIN
  -- Lock BOTH rows in ONE statement with deterministic (id-sorted) lock order
  -- so concurrent swap(A,B) / swap(B,A) calls cannot deadlock. Fewer than 2
  -- rows back means a seat is missing / RLS-invisible (or both ids are the
  -- same row) — raise, zero writes.
  SELECT count(*) INTO v_locked_count
  FROM (
    SELECT ss.id
    FROM public.seating_seats AS ss
    WHERE ss.id IN (p_seat_id_1, p_seat_id_2)
    ORDER BY ss.id
    FOR UPDATE
  ) AS locked;

  IF v_locked_count < 2 THEN
    RAISE EXCEPTION 'seating_swap_students: seat % or % not found', p_seat_id_1, p_seat_id_2;
  END IF;

  -- Both seats must belong to the SAME chart — a same-teacher cross-chart
  -- swap would otherwise silently move students between charts.
  SELECT count(DISTINCT sg.seating_chart_id) INTO v_chart_count
  FROM public.seating_seats AS ss
  JOIN public.seating_groups AS sg ON sg.id = ss.seating_group_id
  WHERE ss.id IN (p_seat_id_1, p_seat_id_2);

  IF v_chart_count <> 1 THEN
    RAISE EXCEPTION 'seating_swap_students: seats % and % are not in the same seating chart', p_seat_id_1, p_seat_id_2;
  END IF;

  -- Occupants read from the (already locked) rows, never from cache.
  SELECT ss.student_id INTO v_student_1
  FROM public.seating_seats AS ss
  WHERE ss.id = p_seat_id_1;

  SELECT ss.student_id INTO v_student_2
  FROM public.seating_seats AS ss
  WHERE ss.id = p_seat_id_2;

  -- Clear both first (NULL writes are ignored by the single-seat trigger),
  -- then set each seat in its own statement so the trigger sees the clear.
  UPDATE public.seating_seats
  SET student_id = NULL
  WHERE id IN (p_seat_id_1, p_seat_id_2);

  UPDATE public.seating_seats
  SET student_id = v_student_2
  WHERE id = p_seat_id_1;

  UPDATE public.seating_seats
  SET student_id = v_student_1
  WHERE id = p_seat_id_2;
END;
$$;

-- ============================================
-- 3. seating_randomize
-- ============================================
-- p_assignments: jsonb array of {"seat_id": uuid, "student_id": uuid}
-- (snake_case wire format — the client maps {seatId, studentId}).
-- Randomization stays CLIENT-side; only the apply is server-side. Raises
-- unless the payload is a non-empty array whose every seat_id belongs to the
-- chart (NULL-strict count-match, NOT `NOT IN` — a NULL seat_id fails the
-- match instead of vacuously passing). Clears ALL chart seats, then applies.
CREATE OR REPLACE FUNCTION public.seating_randomize(
  p_chart_id uuid,
  p_assignments jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_payload_count integer;
  v_distinct_seat_count integer;
  v_matched_count integer;
  v_student_match_count integer;
  v_applied integer;
BEGIN
  IF p_assignments IS NULL OR jsonb_typeof(p_assignments) <> 'array' THEN
    RAISE EXCEPTION 'seating_randomize: assignments must be a JSON array';
  END IF;

  IF jsonb_array_length(p_assignments) = 0 THEN
    RAISE EXCEPTION 'seating_randomize: assignments must not be empty';
  END IF;

  -- A NULL/missing student_id would silently unassign the target seat.
  PERFORM 1
  FROM jsonb_to_recordset(p_assignments) AS x(seat_id uuid, student_id uuid)
  WHERE x.student_id IS NULL;

  IF FOUND THEN
    RAISE EXCEPTION 'seating_randomize: every assignment must carry a student_id';
  END IF;

  SELECT count(*), count(DISTINCT x.seat_id)
    INTO v_payload_count, v_distinct_seat_count
  FROM jsonb_to_recordset(p_assignments) AS x(seat_id uuid, student_id uuid);

  SELECT count(*) INTO v_matched_count
  FROM jsonb_to_recordset(p_assignments) AS x(seat_id uuid, student_id uuid)
  JOIN public.seating_seats AS ss ON ss.id = x.seat_id
  JOIN public.seating_groups AS sg ON sg.id = ss.seating_group_id
  WHERE sg.seating_chart_id = p_chart_id;

  IF v_matched_count <> v_payload_count THEN
    RAISE EXCEPTION 'seating_randomize: every seat_id must belong to chart %', p_chart_id;
  END IF;

  -- Duplicate seat_ids would make the apply UPDATE nondeterministic
  -- (last-writer-wins on an arbitrary row order).
  IF v_distinct_seat_count <> v_payload_count THEN
    RAISE EXCEPTION 'seating_randomize: duplicate seat_id in assignments';
  END IF;

  -- Every student must belong to the chart's classroom (same rationale as
  -- seating_assign_student: FK validation bypasses students RLS).
  SELECT count(*) INTO v_student_match_count
  FROM jsonb_to_recordset(p_assignments) AS x(seat_id uuid, student_id uuid)
  JOIN public.students AS st ON st.id = x.student_id
  JOIN public.seating_charts AS sc ON sc.classroom_id = st.classroom_id
  WHERE sc.id = p_chart_id;

  IF v_student_match_count <> v_payload_count THEN
    RAISE EXCEPTION 'seating_randomize: every student_id must belong to the classroom of chart %', p_chart_id;
  END IF;

  -- Clear ALL chart seats (separate statement — see trigger note), then apply
  -- the new assignments. The apply is one statement over validated-distinct
  -- seats whose students were all cleared above, so the single-seat trigger
  -- cannot raise on ordering; a duplicate STUDENT in the payload still raises
  -- via the trigger and rolls everything back.
  UPDATE public.seating_seats AS ss
  SET student_id = NULL
  FROM public.seating_groups AS sg
  WHERE sg.id = ss.seating_group_id
    AND sg.seating_chart_id = p_chart_id;

  UPDATE public.seating_seats AS ss
  SET student_id = x.student_id
  FROM jsonb_to_recordset(p_assignments) AS x(seat_id uuid, student_id uuid)
  WHERE ss.id = x.seat_id;

  -- A seat deleted between validation and apply would otherwise commit a
  -- silent partial apply.
  GET DIAGNOSTICS v_applied = ROW_COUNT;
  IF v_applied <> v_payload_count THEN
    RAISE EXCEPTION 'seating_randomize: applied % of % assignments', v_applied, v_payload_count;
  END IF;
END;
$$;

-- ============================================
-- 4. seating_apply_preset
-- ============================================
-- p_layout: the stored camelCase layout_data jsonb, passed AS-IS — the server
-- maps camelCase jsonb keys to snake_case columns (it validates the same keys
-- the client wrote). Shape validation happens BEFORE any write (deferred #27
-- addendum, edge-5): a corrupt/legacy layout raises with the chart untouched
-- instead of failing after the deletes committed. Per-element/per-group
-- malformation MAY instead fail mid-transaction via raw constraint errors —
-- rollback (deletes included) is the guarantee there, not pre-validation.
CREATE OR REPLACE FUNCTION public.seating_apply_preset(
  p_chart_id uuid,
  p_layout jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Shape validation — zero writes before this block passes.
  IF p_layout IS NULL OR jsonb_typeof(p_layout) <> 'object' THEN
    RAISE EXCEPTION 'seating_apply_preset: layout must be a JSON object';
  END IF;

  IF jsonb_typeof(p_layout->'groups') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'seating_apply_preset: layout.groups must be an array';
  END IF;

  IF jsonb_typeof(p_layout->'roomElements') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'seating_apply_preset: layout.roomElements must be an array';
  END IF;

  IF jsonb_typeof(p_layout->'settings') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'seating_apply_preset: layout.settings must be an object';
  END IF;

  IF jsonb_typeof(p_layout->'settings'->'snapEnabled') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'seating_apply_preset: layout.settings.snapEnabled must be a boolean';
  END IF;

  IF jsonb_typeof(p_layout->'settings'->'gridSize') IS DISTINCT FROM 'number'
     OR (p_layout->'settings'->>'gridSize')::numeric < 1 THEN
    RAISE EXCEPTION 'seating_apply_preset: layout.settings.gridSize must be a number >= 1';
  END IF;

  IF jsonb_typeof(p_layout->'settings'->'canvasWidth') IS DISTINCT FROM 'number'
     OR (p_layout->'settings'->>'canvasWidth')::numeric < 1 THEN
    RAISE EXCEPTION 'seating_apply_preset: layout.settings.canvasWidth must be a number >= 1';
  END IF;

  IF jsonb_typeof(p_layout->'settings'->'canvasHeight') IS DISTINCT FROM 'number'
     OR (p_layout->'settings'->>'canvasHeight')::numeric < 1 THEN
    RAISE EXCEPTION 'seating_apply_preset: layout.settings.canvasHeight must be a number >= 1';
  END IF;

  -- One transaction: settings update -> deletes -> reinserts.
  UPDATE public.seating_charts
  SET snap_enabled = (p_layout->'settings'->>'snapEnabled')::boolean,
      grid_size = round((p_layout->'settings'->>'gridSize')::numeric)::integer,
      canvas_width = round((p_layout->'settings'->>'canvasWidth')::numeric)::integer,
      canvas_height = round((p_layout->'settings'->>'canvasHeight')::numeric)::integer
  WHERE id = p_chart_id;

  -- An invisible chart id (deleted / RLS-filtered) is NOT success.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'seating_apply_preset: chart % not found', p_chart_id;
  END IF;

  -- Delete existing layout (seats cascade with their groups).
  DELETE FROM public.seating_groups WHERE seating_chart_id = p_chart_id;
  DELETE FROM public.room_elements WHERE seating_chart_id = p_chart_id;

  -- Reinsert from the preset. Seats are auto-created per group by
  -- trigger_auto_create_group_seats (AFTER INSERT FOR EACH ROW).
  INSERT INTO public.seating_groups (seating_chart_id, letter, position_x, position_y, rotation)
  SELECT p_chart_id, g.letter, g.x, g.y, g.rotation
  FROM jsonb_to_recordset(p_layout->'groups')
    AS g(letter text, x double precision, y double precision, rotation double precision);

  INSERT INTO public.room_elements
    (seating_chart_id, element_type, label, position_x, position_y, width, height, rotation)
  SELECT p_chart_id, e.type::public.room_element_type, e.label, e.x, e.y,
         e.width, e.height, e.rotation
  FROM jsonb_to_recordset(p_layout->'roomElements')
    AS e(type text, label text, x double precision, y double precision,
         width double precision, height double precision, rotation double precision);
END;
$$;

-- ============================================
-- 5. Grants — app-facing RPCs callable by signed-in users only
-- ============================================
REVOKE EXECUTE ON FUNCTION public.seating_assign_student(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seating_assign_student(uuid, uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.seating_swap_students(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seating_swap_students(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.seating_randomize(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seating_randomize(uuid, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.seating_apply_preset(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seating_apply_preset(uuid, jsonb) TO authenticated, service_role;
