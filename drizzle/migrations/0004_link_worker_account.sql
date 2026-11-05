CREATE OR REPLACE FUNCTION public.admin_link_worker_account(_worker_id uuid, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'moderator') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No account with that email — ask the worker to sign up first'; END IF;
  UPDATE public.workers SET user_id = v_uid WHERE id = _worker_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'field_worker') ON CONFLICT DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.admin_link_worker_account(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_link_worker_account(uuid, text) TO authenticated;