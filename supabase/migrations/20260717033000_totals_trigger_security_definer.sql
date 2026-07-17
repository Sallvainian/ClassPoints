-- update_student_point_totals must run as its owner (SECURITY DEFINER).
--
-- Found by the delete-account integration test [DEL.INT-01]: deleting an auth
-- user cascades auth.users → classrooms → students → point_transactions, and
-- the AFTER DELETE trigger on point_transactions fires this function AS THE
-- ROLE THAT INITIATED THE DELETE. When GoTrue's auth.admin.deleteUser drives
-- the cascade, that role is supabase_auth_admin, which holds no grants on
-- public.students — so the trigger's UPDATE fails with SQLSTATE 42501 and the
-- whole user deletion 500s ("Database error deleting user"). Any cascade
-- initiator without public-schema grants would hit the same wall.
--
-- Body and pinned empty search_path are identical to the harden migration
-- (20260429181608); the only change is SECURITY DEFINER. Owner (postgres)
-- holds the students grants, and the existing REVOKE EXECUTE ... FROM PUBLIC,
-- anon, authenticated (which CREATE OR REPLACE preserves) keeps the definer
-- function uncallable outside its trigger.
CREATE OR REPLACE FUNCTION public.update_student_point_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
