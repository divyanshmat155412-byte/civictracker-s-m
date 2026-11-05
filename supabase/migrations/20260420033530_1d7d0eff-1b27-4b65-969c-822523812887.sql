-- Function for the main admin to grant a role to a user by email.
-- Restricted: only the hardcoded main admin (main-admin@example.com) can call it.
CREATE OR REPLACE FUNCTION public.admin_grant_role_by_email(
  _email text,
  _role public.app_role,
  _city text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text;
  target_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(email) INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'main-admin@example.com' THEN
    RAISE EXCEPTION 'Forbidden: only the main admin can manage roles';
  END IF;

  SELECT id INTO target_id FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF target_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email %', _email;
  END IF;

  INSERT INTO public.user_roles (user_id, role, city)
  VALUES (target_id, _role, NULLIF(trim(COALESCE(_city,'')), ''))
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('user_id', target_id, 'role', _role);
END;
$$;

-- Function for the main admin to revoke a role from a user by email.
CREATE OR REPLACE FUNCTION public.admin_revoke_role_by_email(
  _email text,
  _role public.app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text;
  target_id uuid;
  deleted_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(email) INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'main-admin@example.com' THEN
    RAISE EXCEPTION 'Forbidden: only the main admin can manage roles';
  END IF;

  SELECT id INTO target_id FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF target_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email %', _email;
  END IF;

  -- Never let the main admin revoke their own admin role
  IF target_id = auth.uid() AND _role = 'admin'::public.app_role THEN
    RAISE EXCEPTION 'You cannot revoke your own admin role';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = target_id AND role = _role;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('user_id', target_id, 'role', _role, 'deleted', deleted_count);
END;
$$;

-- Function for the main admin to list all users with elevated roles, including emails.
CREATE OR REPLACE FUNCTION public.admin_list_role_assignments()
RETURNS TABLE(user_id uuid, email text, role public.app_role, city text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(u.email) INTO caller_email FROM auth.users u WHERE u.id = auth.uid();
  IF caller_email IS DISTINCT FROM 'main-admin@example.com' THEN
    RAISE EXCEPTION 'Forbidden: only the main admin can list role assignments';
  END IF;

  RETURN QUERY
  SELECT ur.user_id, u.email::text, ur.role, ur.city
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  ORDER BY ur.role, u.email;
END;
$$;