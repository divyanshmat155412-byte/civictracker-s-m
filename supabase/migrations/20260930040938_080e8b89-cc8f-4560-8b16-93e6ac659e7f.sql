CREATE TABLE IF NOT EXISTS public.app_config (key text PRIMARY KEY, value text NOT NULL);
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.main_admin_email() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT lower(value) FROM public.app_config WHERE key='main_admin_email' $$;
REVOKE EXECUTE ON FUNCTION public.main_admin_email() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_main_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(lower(auth.jwt() ->> 'email') = (SELECT lower(value) FROM public.app_config WHERE key='main_admin_email'), false) $$;
GRANT EXECUTE ON FUNCTION public.is_main_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.grant_main_admin_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF lower(NEW.email) = public.main_admin_email() THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::public.app_role) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_grant_role_by_email(_email text, _role app_role, _city text DEFAULT NULL::text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_main_admin() THEN RAISE EXCEPTION 'Forbidden: only the main admin can manage roles'; END IF;
  SELECT id INTO target_id FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF target_id IS NULL THEN RAISE EXCEPTION 'No user found with that email'; END IF;
  INSERT INTO public.user_roles (user_id, role, city) VALUES (target_id, _role, NULLIF(trim(COALESCE(_city,'')), '')) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('user_id', target_id, 'role', _role);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_role_by_email(_email text, _role app_role) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target_id uuid; deleted_count int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_main_admin() THEN RAISE EXCEPTION 'Forbidden: only the main admin can manage roles'; END IF;
  SELECT id INTO target_id FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF target_id IS NULL THEN RAISE EXCEPTION 'No user found with that email'; END IF;
  IF target_id = auth.uid() AND _role = 'admin'::public.app_role THEN RAISE EXCEPTION 'You cannot revoke your own admin role'; END IF;
  DELETE FROM public.user_roles WHERE user_id = target_id AND role = _role;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN jsonb_build_object('user_id', target_id, 'role', _role, 'deleted', deleted_count);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_role_assignments() RETURNS TABLE(user_id uuid, email text, role app_role, city text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_main_admin() THEN RAISE EXCEPTION 'Forbidden: only the main admin can list role assignments'; END IF;
  RETURN QUERY SELECT ur.user_id, u.email::text, ur.role, ur.city FROM public.user_roles ur JOIN auth.users u ON u.id = ur.user_id ORDER BY ur.role, u.email;
END; $$;