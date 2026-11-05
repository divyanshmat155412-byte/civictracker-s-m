CREATE OR REPLACE FUNCTION public.reveal_anonymous_complainant(_complaint_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c record;
  _name text;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 10 OR length(_reason) > 500 THEN
    RAISE EXCEPTION 'a reason of 10-500 characters is required';
  END IF;
  SELECT id, complaint_id, city, user_id, anonymous INTO _c FROM public.complaints WHERE id = _complaint_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'complaint not found'; END IF;
  IF NOT (_uid = public.root_admin_id() OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'admin' AND status = 'active'
        AND city IS NOT NULL AND lower(city) = lower(_c.city))) THEN
    RAISE EXCEPTION 'not authorised for this city';
  END IF;
  IF NOT _c.anonymous THEN RAISE EXCEPTION 'complaint is not anonymous'; END IF;
  SELECT full_name INTO _name FROM public.profiles WHERE user_id = _c.user_id;
  PERFORM public.write_audit('anonymous_identity_revealed', 'complaint', _c.id::text,
    jsonb_build_object('complaint_code', _c.complaint_id, 'reason', btrim(_reason), 'has_account', _c.user_id IS NOT NULL), _c.city);
  RETURN jsonb_build_object('complaint_code', _c.complaint_id, 'has_account', _c.user_id IS NOT NULL,
    'account_id', _c.user_id, 'full_name', _name);
END $$;
REVOKE ALL ON FUNCTION public.reveal_anonymous_complainant(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reveal_anonymous_complainant(uuid, text) TO authenticated;