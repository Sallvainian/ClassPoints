-- Harden Supabase linter findings without removing REST/Data API access.
--
-- The app does not use Supabase GraphQL, but it does use supabase-js table
-- queries. Disabling pg_graphql resolves GraphQL schema exposure warnings
-- without revoking table SELECT grants that the REST API needs.
DROP EXTENSION IF EXISTS pg_graphql;

-- Keep trigger-only SECURITY DEFINER helpers out of the exposed public schema.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- Recreate public trigger/RPC functions with an explicit, immutable search path.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_sound_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_seating_chart_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_student_point_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.students SET
      point_total = point_total + NEW.points,
      positive_total = positive_total + greatest(NEW.points, 0),
      negative_total = negative_total + least(NEW.points, 0)
    WHERE id = NEW.student_id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.students SET
      point_total = point_total - OLD.points,
      positive_total = positive_total - greatest(OLD.points, 0),
      negative_total = negative_total - least(OLD.points, 0)
    WHERE id = OLD.student_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_time_totals(
  p_classroom_id uuid,
  p_start_of_today timestamptz,
  p_start_of_week timestamptz
)
RETURNS TABLE (
  student_id uuid,
  today_total integer,
  this_week_total integer
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.student_id,
    COALESCE(SUM(CASE WHEN pt.created_at >= p_start_of_today THEN pt.points ELSE 0 END)::integer, 0) AS today_total,
    COALESCE(SUM(CASE WHEN pt.created_at >= p_start_of_week THEN pt.points ELSE 0 END)::integer, 0) AS this_week_total
  FROM public.point_transactions AS pt
  WHERE pt.classroom_id = p_classroom_id
    AND pt.created_at >= p_start_of_week
  GROUP BY pt.student_id;
END;
$$;

-- Private SECURITY DEFINER trigger helpers.
CREATE OR REPLACE FUNCTION private.set_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        NEW.user_id = auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.auto_create_group_seats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.seating_seats (seating_group_id, position_in_group)
  VALUES
    (NEW.id, 1),
    (NEW.id, 2),
    (NEW.id, 3),
    (NEW.id, 4);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.ensure_student_single_seat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  chart_id uuid;
  existing_seat_id uuid;
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    SELECT sg.seating_chart_id INTO chart_id
    FROM public.seating_groups AS sg
    WHERE sg.id = NEW.seating_group_id;

    SELECT ss.id INTO existing_seat_id
    FROM public.seating_seats AS ss
    JOIN public.seating_groups AS sg ON sg.id = ss.seating_group_id
    WHERE sg.seating_chart_id = chart_id
      AND ss.student_id = NEW.student_id
      AND ss.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF existing_seat_id IS NOT NULL THEN
      RAISE EXCEPTION 'Student is already assigned to another seat in this seating chart';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Move existing triggers to the private helpers, then remove the exposed copies.
DROP TRIGGER IF EXISTS set_classrooms_user_id ON public.classrooms;
CREATE TRIGGER set_classrooms_user_id
    BEFORE INSERT ON public.classrooms
    FOR EACH ROW
    EXECUTE FUNCTION private.set_user_id();

DROP TRIGGER IF EXISTS set_behaviors_user_id ON public.behaviors;
CREATE TRIGGER set_behaviors_user_id
    BEFORE INSERT ON public.behaviors
    FOR EACH ROW
    EXECUTE FUNCTION private.set_user_id();

DROP TRIGGER IF EXISTS trigger_auto_create_group_seats ON public.seating_groups;
CREATE TRIGGER trigger_auto_create_group_seats
  AFTER INSERT ON public.seating_groups
  FOR EACH ROW
  EXECUTE FUNCTION private.auto_create_group_seats();

DROP TRIGGER IF EXISTS trigger_ensure_student_single_seat ON public.seating_seats;
CREATE TRIGGER trigger_ensure_student_single_seat
  BEFORE INSERT OR UPDATE OF student_id ON public.seating_seats
  FOR EACH ROW
  EXECUTE FUNCTION private.ensure_student_single_seat();

DROP FUNCTION IF EXISTS public.set_user_id();
DROP FUNCTION IF EXISTS public.auto_create_group_seats();
DROP FUNCTION IF EXISTS public.ensure_student_single_seat();

-- Remove direct RPC execution from trigger-only functions.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_sound_settings_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_seating_chart_timestamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_student_point_totals() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION private.set_user_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.auto_create_group_seats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.ensure_student_single_seat() FROM PUBLIC, anon, authenticated;

-- Keep the one app-facing RPC callable by signed-in users.
REVOKE EXECUTE ON FUNCTION public.get_student_time_totals(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_time_totals(uuid, timestamptz, timestamptz) TO authenticated, service_role;
