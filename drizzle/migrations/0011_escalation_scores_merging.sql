CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.complaints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz;
CREATE INDEX IF NOT EXISTS complaints_open_due_idx ON public.complaints (due_at) WHERE status <> 'resolved';

-- citizens must not touch the new official fields
CREATE OR REPLACE FUNCTION public.guard_complaint_official_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' AND NULLIF(NEW.after_photo_url,'') IS NULL THEN
    RAISE EXCEPTION 'An after-repair photo is required before marking resolved';
  END IF;
  IF current_setting('civic.system_update', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.escalation_level IS DISTINCT FROM OLD.escalation_level OR NEW.escalated_at IS DISTINCT FROM OLD.escalated_at
     OR NEW.merged_into IS DISTINCT FROM OLD.merged_into OR NEW.merged_at IS DISTINCT FROM OLD.merged_at THEN
    RAISE EXCEPTION 'Escalation and merge fields are managed by the system';
  END IF;
  IF public.admin_can_manage_city(auth.uid(), OLD.city) THEN
    IF NEW.city IS DISTINCT FROM OLD.city AND NOT public.admin_can_manage_city(auth.uid(), NEW.city) THEN
      RAISE EXCEPTION 'You cannot move a complaint to a city you do not manage';
    END IF;
    RETURN NEW;
  END IF;
  IF current_setting('civic.worker_update', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.after_photo_url IS DISTINCT FROM OLD.after_photo_url
     OR NEW.department_id IS DISTINCT FROM OLD.department_id OR NEW.due_at IS DISTINCT FROM OLD.due_at
     OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.city IS DISTINCT FROM OLD.city OR NEW.ward_id IS DISTINCT FROM OLD.ward_id OR NEW.zone IS DISTINCT FROM OLD.zone
     OR NEW.location_status IS DISTINCT FROM OLD.location_status OR NEW.routing_status IS DISTINCT FROM OLD.routing_status
     OR NEW.verification_count IS DISTINCT FROM OLD.verification_count OR NEW.upvotes IS DISTINCT FROM OLD.upvotes THEN
    RAISE EXCEPTION 'Only officers can change status, priority, department, deadline, city, ward or proof photos';
  END IF;
  RETURN NEW;
END; $function$;

-- ===== A. Escalation =====
-- L1 at deadline (officers), L2 at +24h (City Admins), L3 at +72h (Root). One step per level, never repeated.
CREATE OR REPLACE FUNCTION public.escalate_overdue_complaints(_now timestamptz DEFAULT now())
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c record; target int; n int := 0; who text;
BEGIN
  PERFORM set_config('civic.system_update', 'on', true);
  FOR c IN SELECT * FROM public.complaints
    WHERE status <> 'resolved' AND merged_into IS NULL AND due_at IS NOT NULL AND due_at < _now AND escalation_level < 3
    FOR UPDATE SKIP LOCKED
  LOOP
    target := CASE WHEN _now >= c.due_at + interval '72 hours' THEN 3
                   WHEN _now >= c.due_at + interval '24 hours' THEN 2 ELSE 1 END;
    IF target <= c.escalation_level THEN CONTINUE; END IF;
    UPDATE public.complaints SET escalation_level = target, escalated_at = _now WHERE id = c.id;
    who := CASE target WHEN 1 THEN 'officers' WHEN 2 THEN 'City Admin' ELSE 'Super Admin' END;
    INSERT INTO public.user_notifications(user_id, title, body, kind)
    SELECT DISTINCT r.user_id, 'Deadline missed: #' || c.complaint_id,
      c.title || ' is overdue (' || c.city || '). Escalated to ' || who || ' — level ' || target || '.', 'escalation'
    FROM public.user_roles r
    WHERE r.status = 'active' AND (
      (target = 1 AND r.role = 'moderator' AND lower(r.city) = lower(c.city)) OR
      (target = 2 AND r.role = 'admin' AND lower(r.city) = lower(c.city)) OR
      (target = 3 AND r.user_id = public.root_admin_id()));
    IF c.user_id IS NOT NULL THEN
      INSERT INTO public.user_notifications(user_id, title, body, kind)
      VALUES (c.user_id, 'Your complaint was escalated', '#' || c.complaint_id || ' passed its deadline and was escalated to ' || who || '.', 'escalation');
    END IF;
    INSERT INTO public.complaint_timeline(complaint_id, status, note)
    VALUES (c.id, c.status, 'Automatically escalated to level ' || target || ' (' || who || ') — deadline missed');
    PERFORM public.write_audit('complaint_escalated', 'complaint', c.id::text,
      jsonb_build_object('from', c.escalation_level, 'to', target, 'due_at', c.due_at), c.city);
    n := n + 1;
  END LOOP;
  RETURN n;
END; $function$;
REVOKE ALL ON FUNCTION public.escalate_overdue_complaints(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_overdue_complaints(timestamptz) TO service_role;

-- reset escalation when a deadline is extended into the future
CREATE OR REPLACE FUNCTION public.reset_escalation_on_new_deadline()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.due_at IS DISTINCT FROM OLD.due_at AND NEW.due_at > now() THEN
    NEW.escalation_level := 0; NEW.escalated_at := NULL;
  END IF;
  RETURN NEW;
END; $function$;
DROP TRIGGER IF EXISTS trg_reset_escalation ON public.complaints;
CREATE TRIGGER trg_reset_escalation BEFORE UPDATE OF due_at ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.reset_escalation_on_new_deadline();

-- ===== B. Public accountability score =====
CREATE OR REPLACE FUNCTION public.department_scores(_city text DEFAULT NULL)
 RETURNS TABLE(department_id uuid, department_name text, city text, total integer, resolved_with_proof integer,
   resolved_on_time integer, open_overdue integer, avg_resolution_hours numeric, score numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH s AS (
    SELECT d.id, d.name, d.city,
      count(c.id)::int AS total,
      count(*) FILTER (WHERE c.status = 'resolved' AND NULLIF(c.after_photo_url,'') IS NOT NULL)::int AS proof,
      count(*) FILTER (WHERE c.status = 'resolved' AND NULLIF(c.after_photo_url,'') IS NOT NULL
                       AND (c.due_at IS NULL OR c.resolved_at <= c.due_at))::int AS ontime,
      count(*) FILTER (WHERE c.status <> 'resolved' AND c.due_at < now())::int AS overdue,
      round((avg(extract(epoch FROM c.resolved_at - c.created_at)/3600)
        FILTER (WHERE c.status = 'resolved' AND c.resolved_at IS NOT NULL))::numeric, 1) AS avg_h
    FROM public.departments d
    LEFT JOIN public.complaints c ON c.department_id = d.id AND c.merged_into IS NULL
      AND (_city IS NULL OR lower(c.city) = lower(_city))
    WHERE _city IS NULL OR d.city IS NULL OR lower(d.city) = lower(_city)
    GROUP BY d.id, d.name, d.city)
  SELECT id, name, city, total, proof, ontime, overdue, avg_h,
    CASE WHEN total < 5 THEN NULL ELSE round(100 * (
      0.5 * proof::numeric / total
      + 0.3 * CASE WHEN proof = 0 THEN 0 ELSE ontime::numeric / proof END
      + 0.2 * (1 - overdue::numeric / total)), 0) END
  FROM s ORDER BY 9 DESC NULLS LAST, 2
$function$;
GRANT EXECUTE ON FUNCTION public.department_scores(text) TO anon, authenticated, service_role;

-- ===== C. Duplicates with text similarity + safe merging =====
CREATE OR REPLACE FUNCTION public.find_similar_complaints(_complaint_id uuid, _radius_m integer DEFAULT 300, _days integer DEFAULT 7)
 RETURNS TABLE(id uuid, complaint_id text, title text, status text, distance_m double precision, similarity real, created_at timestamptz, merged_into uuid)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE c public.complaints;
BEGIN
  SELECT * INTO c FROM public.complaints x WHERE x.id = _complaint_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Complaint not found'; END IF;
  IF NOT public.admin_can_manage_city(auth.uid(), c.city) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT o.id, o.complaint_id, o.title, o.status,
    public.distance_m(c.latitude, c.longitude, o.latitude, o.longitude),
    extensions.similarity(lower(c.title || ' ' || c.description), lower(o.title || ' ' || o.description)),
    o.created_at, o.merged_into
  FROM public.complaints o
  WHERE o.id <> c.id AND lower(o.city) = lower(c.city) AND o.category = c.category
    AND c.latitude IS NOT NULL AND o.latitude IS NOT NULL
    AND abs(extract(epoch FROM o.created_at - c.created_at)) <= _days * 86400
    AND public.distance_m(c.latitude, c.longitude, o.latitude, o.longitude) <= _radius_m
  ORDER BY 6 DESC, 5 LIMIT 10;
END; $function$;
REVOKE ALL ON FUNCTION public.find_similar_complaints(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_similar_complaints(uuid, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_merge_complaint(_duplicate uuid, _primary uuid, _note text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d public.complaints; p public.complaints;
BEGIN
  IF _duplicate = _primary THEN RAISE EXCEPTION 'Cannot merge a complaint into itself'; END IF;
  SELECT * INTO d FROM public.complaints WHERE id = _duplicate FOR UPDATE;
  SELECT * INTO p FROM public.complaints WHERE id = _primary FOR UPDATE;
  IF d.id IS NULL OR p.id IS NULL THEN RAISE EXCEPTION 'Complaint not found'; END IF;
  IF lower(d.city) <> lower(p.city) THEN RAISE EXCEPTION 'Complaints are in different cities'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') AND public.admin_can_manage_city(auth.uid(), d.city)) THEN
    RAISE EXCEPTION 'Forbidden: only this city''s admin can merge complaints';
  END IF;
  IF d.merged_into IS NOT NULL THEN RAISE EXCEPTION 'Already merged'; END IF;
  IF p.merged_into IS NOT NULL THEN RAISE EXCEPTION 'Target is itself merged; pick its primary complaint'; END IF;
  PERFORM set_config('civic.system_update', 'on', true);
  UPDATE public.complaints SET merged_into = _primary, merged_at = now() WHERE id = _duplicate;
  INSERT INTO public.complaint_timeline(complaint_id, status, note, updated_by)
  VALUES (_duplicate, d.status, 'Merged into #' || p.complaint_id || COALESCE(' — ' || _note, ''), auth.uid());
  IF d.user_id IS NOT NULL THEN
    INSERT INTO public.user_notifications(user_id, title, body, kind)
    VALUES (d.user_id, 'Complaint linked to an existing report',
      'Your complaint #' || d.complaint_id || ' was linked to #' || p.complaint_id || '. You can follow progress there.', 'merge');
  END IF;
  PERFORM public.write_audit('complaint_merged', 'complaint', _duplicate::text,
    jsonb_build_object('into', _primary, 'note', _note), d.city);
  RETURN jsonb_build_object('ok', true);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_unmerge_complaint(_duplicate uuid, _note text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d public.complaints;
BEGIN
  SELECT * INTO d FROM public.complaints WHERE id = _duplicate FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Complaint not found'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') AND public.admin_can_manage_city(auth.uid(), d.city)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF d.merged_into IS NULL THEN RAISE EXCEPTION 'Not merged'; END IF;
  PERFORM set_config('civic.system_update', 'on', true);
  UPDATE public.complaints SET merged_into = NULL, merged_at = NULL WHERE id = _duplicate;
  INSERT INTO public.complaint_timeline(complaint_id, status, note, updated_by)
  VALUES (_duplicate, d.status, 'Unmerged' || COALESCE(' — ' || _note, ''), auth.uid());
  PERFORM public.write_audit('complaint_unmerged', 'complaint', _duplicate::text,
    jsonb_build_object('was_merged_into', d.merged_into, 'note', _note), d.city);
  RETURN jsonb_build_object('ok', true);
END; $function$;
REVOKE ALL ON FUNCTION public.admin_merge_complaint(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_unmerge_complaint(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_merge_complaint(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_unmerge_complaint(uuid, text) TO authenticated, service_role;

SELECT cron.schedule('escalate-overdue-complaints', '0 * * * *', $$SELECT public.escalate_overdue_complaints()$$);