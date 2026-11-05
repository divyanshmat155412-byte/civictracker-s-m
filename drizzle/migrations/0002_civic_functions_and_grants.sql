CREATE OR REPLACE FUNCTION public.get_my_profile_contact()
RETURNS TABLE(phone_number text, sms_opt_in boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT phone_number, sms_opt_in FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.update_my_profile_contact(_phone text, _opt_in boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profiles SET phone_number = NULLIF(trim(_phone), ''), sms_opt_in = COALESCE(_opt_in, false), updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_complaint_whatsapp(_complaint_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT whatsapp_number FROM public.complaints
  WHERE id = _complaint_id AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.list_complaints_for_admin_sms()
RETURNS TABLE(id uuid, complaint_id text, title text, status text, whatsapp_number text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, complaint_id, title, status, whatsapp_number FROM public.complaints
  WHERE public.has_role(auth.uid(), 'admin') ORDER BY created_at DESC LIMIT 100
$$;

CREATE OR REPLACE FUNCTION public.get_worker_phone(_worker_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT phone FROM public.workers WHERE id = _worker_id AND public.has_role(auth.uid(), 'admin') LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_poll_results(_poll_id uuid)
RETURNS TABLE(option_id uuid, vote_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT option_id, COUNT(*)::bigint AS vote_count FROM public.poll_votes WHERE poll_id = _poll_id GROUP BY option_id
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url, home_city)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url', NULLIF(NEW.raw_user_meta_data->>'home_city', ''));
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_my_home_city(_city text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_clean text; v_saved text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_clean := NULLIF(btrim(_city), '');
  IF v_clean IS NULL THEN RAISE EXCEPTION 'City is required'; END IF;
  IF length(v_clean) < 2 OR length(v_clean) > 80 THEN RAISE EXCEPTION 'City must be 2 to 80 characters'; END IF;
  IF v_clean !~ '^[\p{L}][\p{L}\s\.''\-]*$' THEN RAISE EXCEPTION 'City can only contain letters, spaces, hyphens, apostrophes, and dots'; END IF;
  INSERT INTO public.profiles (user_id, home_city) VALUES (v_uid, v_clean)
  ON CONFLICT (user_id) DO UPDATE SET home_city = EXCLUDED.home_city, updated_at = now()
  RETURNING home_city INTO v_saved;
  RETURN v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_known_cities()
RETURNS TABLE(city text, source text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_scope text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(v_uid, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  v_scope := public.admin_cities(v_uid);
  RETURN QUERY
  WITH src AS (
    SELECT btrim(c.city) AS city, 'complaints'::text AS source FROM public.complaints c WHERE c.city IS NOT NULL AND btrim(c.city) <> ''
    UNION ALL
    SELECT btrim(p.home_city) AS city, 'profiles'::text AS source FROM public.profiles p WHERE p.home_city IS NOT NULL AND btrim(p.home_city) <> ''
  ), agg AS (
    SELECT s.city, bool_or(s.source = 'profiles') AS in_profiles, bool_or(s.source = 'complaints') AS in_complaints
    FROM src s WHERE v_scope IS NULL OR s.city = ANY(v_scope) GROUP BY s.city
  )
  SELECT a.city, CASE WHEN a.in_profiles AND a.in_complaints THEN 'both' WHEN a.in_profiles THEN 'profiles' ELSE 'complaints' END
  FROM agg a ORDER BY a.city;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_reward(_reward_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_cost integer; v_available boolean; v_new_points integer; v_redemption_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT points_cost, available INTO v_cost, v_available FROM public.rewards WHERE id = _reward_id FOR UPDATE;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'Reward not found'; END IF;
  IF NOT v_available THEN RAISE EXCEPTION 'Reward is not available'; END IF;
  UPDATE public.profiles SET green_points = green_points - v_cost, updated_at = now()
  WHERE user_id = v_uid AND green_points >= v_cost RETURNING green_points INTO v_new_points;
  IF v_new_points IS NULL THEN RAISE EXCEPTION 'Insufficient points'; END IF;
  INSERT INTO public.reward_redemptions (user_id, reward_id, points_spent) VALUES (v_uid, _reward_id, v_cost) RETURNING id INTO v_redemption_id;
  RETURN jsonb_build_object('redemption_id', v_redemption_id, 'new_balance', v_new_points, 'points_spent', v_cost);
END;
$$;

CREATE TABLE IF NOT EXISTS public.app_config (key text PRIMARY KEY, value text NOT NULL);
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.main_admin_email() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT lower(value) FROM public.app_config WHERE key='main_admin_email' $$;

CREATE OR REPLACE FUNCTION public.is_main_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(lower(auth.jwt() ->> 'email') = (SELECT lower(value) FROM public.app_config WHERE key='main_admin_email'), false) $$;

CREATE OR REPLACE FUNCTION public.grant_main_admin_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF lower(NEW.email) = public.main_admin_email() THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::public.app_role) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created_grant_main_admin AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_main_admin_role();

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

-- Storage policies
CREATE POLICY "complaint-photos public read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'complaint-photos');
CREATE POLICY "complaint-photos owner update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'complaint-photos' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "complaint-photos owner delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'complaint-photos' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));

-- Data API grants
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'app_config' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
GRANT INSERT ON public.complaints TO anon;

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, user_id, full_name, avatar_url, badge_level, green_points, complaints_count, created_at, updated_at, home_city) ON public.profiles TO anon, authenticated;
REVOKE SELECT ON public.complaints FROM anon, authenticated;
GRANT SELECT (id, complaint_id, user_id, title, description, category, status, priority, photo_url, location, latitude, longitude, anonymous, submitted_by, upvotes, resolved_at, before_photo_url, after_photo_url, ai_summary, created_at, updated_at, department_id, sentiment_score, sentiment_label, verification_count, source, city) ON public.complaints TO anon, authenticated;
REVOKE SELECT ON public.workers FROM anon, authenticated;
GRANT SELECT (id, name, department_id, is_active, created_at) ON public.workers TO anon, authenticated;
REVOKE SELECT ON public.departments FROM anon;
GRANT SELECT (id, name, description, head_name, created_at) ON public.departments TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF r.proname IN ('get_poll_results','get_my_profile_contact','update_my_profile_contact','set_my_home_city',
      'redeem_reward','admin_list_known_cities','admin_list_role_assignments','admin_grant_role_by_email',
      'admin_revoke_role_by_email','list_complaints_for_admin_sms','has_role','admin_can_manage_city','admin_cities',
      'get_complaint_whatsapp','get_worker_phone','is_main_admin') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    ELSE
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    END IF;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.get_poll_results(uuid) TO anon;