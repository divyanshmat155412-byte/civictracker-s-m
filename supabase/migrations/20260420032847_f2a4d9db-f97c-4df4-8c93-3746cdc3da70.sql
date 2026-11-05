-- Ensure the main admin (main-admin@example.com) always has the admin role in user_roles
-- so RLS policies that depend on has_role(auth.uid(), 'admin') succeed.

-- 1) Backfill: if the user already exists in auth.users, insert the admin role now.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'main-admin@example.com'
ON CONFLICT DO NOTHING;

-- 2) Trigger: whenever this user signs up (or already exists and we need to keep it in sync),
--    grant the admin role automatically.
CREATE OR REPLACE FUNCTION public.grant_main_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'main-admin@example.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_main_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_main_admin
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.grant_main_admin_role();