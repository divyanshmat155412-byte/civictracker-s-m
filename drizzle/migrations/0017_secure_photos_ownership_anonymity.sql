-- 1. Complaint ownership: server decides the owner
CREATE OR REPLACE FUNCTION public.enforce_complaint_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF v_uid IS NULL THEN
      NEW.user_id := NULL;                       -- WhatsApp / signed-out inserts never claim an account
    ELSIF NEW.user_id IS DISTINCT FROM v_uid THEN
      PERFORM public.write_audit('complaint_owner_spoof_blocked','complaint',NULL,
        jsonb_build_object('supplied_user_id', NEW.user_id), NEW.city);
      NEW.user_id := v_uid;
    END IF;
    IF NEW.anonymous THEN NEW.submitted_by := 'Anonymous'; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NOT public.is_main_admin() THEN
      RAISE EXCEPTION 'Complaint ownership cannot be changed';
    END IF;
    IF NEW.anonymous AND NOT OLD.anonymous THEN NEW.submitted_by := 'Anonymous'; END IF;
    IF OLD.anonymous AND NOT NEW.anonymous AND NOT public.is_main_admin() THEN
      RAISE EXCEPTION 'An anonymous complaint cannot be made public';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS a_enforce_complaint_owner ON public.complaints;
CREATE TRIGGER a_enforce_complaint_owner BEFORE INSERT OR UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.enforce_complaint_owner();

-- 2. Anonymous privacy: account ids of complaint filers are not readable through the public API
REVOKE SELECT (user_id) ON public.complaints FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_complaint_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.complaints WHERE auth.uid() IS NOT NULL AND user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.my_complaint_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_complaint_ids() TO authenticated;

-- 3. Photo storage: no direct reads for everyone; uploads only into your own folder, images only
DROP POLICY IF EXISTS "complaint-photos public read" ON storage.objects;
CREATE POLICY "complaint-photos owner or staff read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'complaint-photos' AND (owner = auth.uid()
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')));

DROP POLICY IF EXISTS "Authenticated users can upload complaint photos" ON storage.objects;
CREATE POLICY "complaint-photos upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'complaint-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif','heic','heif'));

DROP POLICY IF EXISTS "complaint-photos owner update" ON storage.objects;
CREATE POLICY "complaint-photos owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'complaint-photos' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'complaint-photos' AND owner = auth.uid()
    AND (storage.foldername(name))[1] = auth.uid()::text);