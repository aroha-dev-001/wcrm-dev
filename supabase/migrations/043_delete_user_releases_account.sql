-- ============================================================
-- 043_delete_user_releases_account
--
-- Deleting a user from Supabase Auth (dashboard or
-- auth.admin.deleteUser) failed with "Database error deleting user"
-- for every signup, because handle_new_user (migration 017) makes
-- each user the owner of a personal account and
-- `accounts.owner_user_id` is ON DELETE RESTRICT.
--
-- The RESTRICT stays — cascading it would wipe the account, and via
-- `profiles.account_id ON DELETE CASCADE` every teammate's profile
-- with it. Instead a BEFORE DELETE trigger on auth.users resolves
-- the owned account first:
--
--   - Nobody else is on it (solo account, or the personal account
--     left behind after the user joined someone else's): delete the
--     account, which cascades to all of its domain rows, then let
--     the user delete proceed.
--   - Teammates are still on it: abort with a message that says to
--     transfer ownership first (transfer_account_ownership, 018).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
BEGIN
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE owner_user_id = OLD.id;

  IF v_account_id IS NULL THEN
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE account_id = v_account_id
      AND user_id <> OLD.id
  ) THEN
    RAISE EXCEPTION 'User % owns an account that still has other members. Transfer ownership before deleting this user.', OLD.email
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.accounts WHERE id = v_account_id;

  RETURN OLD;
END;
$$;

ALTER FUNCTION public.handle_user_delete() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_user_delete() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();
