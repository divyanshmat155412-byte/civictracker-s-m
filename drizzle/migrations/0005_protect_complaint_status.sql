CREATE OR REPLACE FUNCTION public.guard_complaint_official_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.admin_can_manage_city(auth.uid(), OLD.city) THEN RETURN NEW; END IF;
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.after_photo_url IS DISTINCT FROM OLD.after_photo_url
     OR NEW.department_id IS DISTINCT FROM OLD.department_id OR NEW.due_at IS DISTINCT FROM OLD.due_at
     OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN
    -- allow the field-worker completion function (runs as definer, flagged via setting)
    IF current_setting('civic.worker_update', true) = 'on' THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Only officers can change status, department, deadline or proof photos';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_complaint_official_fields BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.guard_complaint_official_fields();

CREATE OR REPLACE FUNCTION public.worker_update_job(_assignment_id uuid, _status text, _after_photo_url text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_complaint uuid;
BEGIN
  IF _status NOT IN ('in-progress','completed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT a.complaint_id INTO v_complaint FROM public.worker_assignments a JOIN public.workers w ON w.id = a.worker_id
  WHERE a.id = _assignment_id AND w.user_id = auth.uid();
  IF v_complaint IS NULL THEN RAISE EXCEPTION 'Not your assignment'; END IF;
  IF _status = 'completed' AND NULLIF(_after_photo_url,'') IS NULL THEN RAISE EXCEPTION 'After-repair photo is required'; END IF;
  PERFORM set_config('civic.worker_update', 'on', true);
  UPDATE public.worker_assignments SET status = _status, completed_at = CASE WHEN _status='completed' THEN now() END WHERE id = _assignment_id;
  UPDATE public.complaints SET
    status = CASE WHEN _status='completed' THEN 'resolved' ELSE 'in-progress' END,
    after_photo_url = COALESCE(NULLIF(_after_photo_url,''), after_photo_url),
    before_photo_url = COALESCE(before_photo_url, photo_url),
    resolved_at = CASE WHEN _status='completed' THEN now() ELSE resolved_at END
  WHERE id = v_complaint;
  PERFORM set_config('civic.worker_update', 'off', true);
  INSERT INTO public.complaint_timeline (complaint_id, status, note, updated_by)
  VALUES (v_complaint, CASE WHEN _status='completed' THEN 'resolved' ELSE 'in-progress' END,
    COALESCE(_note, CASE WHEN _status='completed' THEN 'Field worker completed the job with after-repair photo' ELSE 'Field worker started work' END), auth.uid());
END; $$;