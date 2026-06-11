-- Batch the time-totals RPC into one round-trip (deferred #8, closes #24).
--
-- get_student_time_totals_all_for_user replaces the per-classroom
-- get_student_time_totals: one call returns (classroom_id, student_id,
-- today_total, this_week_total) for every student in every classroom the
-- caller owns. Ownership is bounded by the existing point_transactions RLS
-- policy under SECURITY INVOKER — there is no classroom param to spoof.
-- Both client queryFns (useClassrooms / useStudents) call it once;
-- useStudents filters rows to its classroom client-side.
--
-- NOTE: this supersedes the function that the conventions comment in
-- 20260610224711_seating_atomic_writes.sql:9-10 cites
-- ("match get_student_time_totals hardening, 20260429181608...:73-97,202-203").
-- Historical migrations are not edited; the conventions themselves
-- (SECURITY INVOKER, SET search_path = '', REVOKE/GRANT wiring) carry over
-- unchanged and this function follows them.
--
-- Conventions (match 20260429181608_harden_database_linter_findings.sql):
--   * public schema, LANGUAGE plpgsql
--   * explicit SECURITY INVOKER — the point_transactions RLS policy
--     ("Users can view transactions in own classrooms",
--     002_add_user_auth.sql:113-121) remains the authz boundary; this
--     function adds NO privilege
--   * explicit SET search_path = '' — all schema refs fully qualified
--   * REVOKE FROM PUBLIC, anon + GRANT EXECUTE TO authenticated, service_role
--
-- Every column ref stays pt.-qualified: the OUT params (classroom_id,
-- student_id, ...) shadow same-named table columns inside plpgsql, and an
-- unqualified ref raises 42702 (ambiguous column).
--
-- Index note: the WHERE clause is a created_at-only prefilter, served by
-- idx_transactions_created_at (001_initial_schema.sql:67) — NOT by the
-- classroom-led idx_transactions_classroom_id, since classroom_id is no
-- longer in the predicate. No new indexes needed.

CREATE OR REPLACE FUNCTION public.get_student_time_totals_all_for_user(
  p_start_of_today timestamptz,
  p_start_of_week timestamptz
)
RETURNS TABLE (
  classroom_id uuid,
  student_id uuid,
  today_total integer,
  this_week_total integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Aggregation mirrors the dropped get_student_time_totals EXACTLY (same
  -- CASE WHEN created_at >= sums, same created_at >= p_start_of_week
  -- prefilter, same COALESCE(...)::integer), plus pt.classroom_id in
  -- SELECT/GROUP BY and minus the classroom param. Row visibility comes from
  -- the point_transactions RLS policy under SECURITY INVOKER.
  -- point_transactions.classroom_id is NOT NULL with ON DELETE CASCADE — no
  -- orphan/NULL groups possible.
  RETURN QUERY
  SELECT
    pt.classroom_id,
    pt.student_id,
    COALESCE(SUM(CASE WHEN pt.created_at >= p_start_of_today THEN pt.points ELSE 0 END)::integer, 0) AS today_total,
    COALESCE(SUM(CASE WHEN pt.created_at >= p_start_of_week THEN pt.points ELSE 0 END)::integer, 0) AS this_week_total
  FROM public.point_transactions AS pt
  WHERE pt.created_at >= p_start_of_week
  GROUP BY pt.classroom_id, pt.student_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_student_time_totals_all_for_user(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_time_totals_all_for_user(timestamptz, timestamptz) TO authenticated, service_role;

-- Drop the legacy per-classroom RPC in the same migration. All known callers
-- are migrated in the same commit (useClassrooms.queryFn, useStudents.queryFn,
-- the E2E watcher counter); the gitignored local dev script
-- scripts/verify-undo-fix.ts was ported on-disk alongside. Deploy window: a
-- previous Pages bundle still calling this degrades gracefully — both call
-- sites resolve {error} (postgrest never rejects) into the existing non-fatal
-- zero-fallback, and self-heal on the new deploy.
DROP FUNCTION public.get_student_time_totals(uuid, timestamptz, timestamptz);
