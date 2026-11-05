-- ===== A. Admin applications: identity comes from the session, never from the form =====
CREATE OR REPLACE FUNCTION public.guard_admin_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_email text; v_confirmed timestamptz;
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT email, email_confirmed_at INTO v_email, v_confirmed FROM auth.users WHERE id = auth.uid();
  IF v_confirmed IS NULL THEN RAISE EXCEPTION 'Verify your email address before applying'; END IF;
  IF public.is_main_admin() THEN RAISE EXCEPTION 'The Platform Super Admin cannot apply'; END IF;
  IF NULLIF(btrim(COALESCE(NEW.requested_city,'')),'') IS NULL THEN RAISE EXCEPTION 'Choose the city you work for'; END IF;
  NEW.user_id := auth.uid();
  NEW.email := v_email;           -- verified email from the account, ignore anything typed
  NEW.status := 'pending';
  NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; NEW.decision_note := NULL;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_admin_request ON public.admin_requests;
CREATE TRIGGER guard_admin_request BEFORE INSERT ON public.admin_requests FOR EACH ROW EXECUTE FUNCTION public.guard_admin_request();

-- per-user status notifications
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.user_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users mark own notifications read" ON public.user_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.root_decide_admin_request(_request_id uuid, _approve boolean, _city text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE req public.admin_requests; v_city text;
BEGIN
  IF NOT public.is_main_admin() THEN RAISE EXCEPTION 'Forbidden: only the Platform Super Admin can decide applications'; END IF;
  SELECT * INTO req FROM public.admin_requests WHERE id=_request_id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Application already decided'; END IF;
  v_city := NULLIF(trim(COALESCE(_city, req.requested_city, '')),'');
  IF _approve AND v_city IS NULL THEN RAISE EXCEPTION 'Choose a city for this City Admin'; END IF;
  UPDATE public.admin_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by=auth.uid(), reviewed_at=now(), decision_note=_note, requested_city=COALESCE(v_city, requested_city)
  WHERE id=_request_id;
  IF _approve THEN
    INSERT INTO public.user_roles(user_id, role, city, status, approved_at, approved_by)
    VALUES (req.user_id,'admin',v_city,'active',now(),auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_notifications(user_id, title, body, kind) VALUES (req.user_id,
    CASE WHEN _approve THEN 'City Admin application approved' ELSE 'City Admin application rejected' END,
    CASE WHEN _approve THEN 'You are now City Admin for ' || v_city || '.' ELSE 'Your application was not approved.' END
      || COALESCE(' Note: ' || NULLIF(_note,''), ''),
    CASE WHEN _approve THEN 'approved' ELSE 'rejected' END);
  PERFORM public.write_audit(CASE WHEN _approve THEN 'admin_application_approved' ELSE 'admin_application_rejected' END,
    'admin_request', _request_id::text, jsonb_build_object('applicant',req.user_id,'city',v_city,'note',_note), v_city);
  RETURN jsonb_build_object('ok',true);
END; $$;

-- ===== B/C. Ward boundaries (GeoJSON) and location status =====
ALTER TABLE public.wards ADD COLUMN IF NOT EXISTS boundary jsonb;
ALTER TABLE public.wards ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.wards ADD COLUMN IF NOT EXISTS source text;
UPDATE public.wards SET is_demo = true, source = COALESCE(source, 'Demonstration data — not official boundaries') WHERE lower(city) = 'ratlam';

ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS location_status text NOT NULL DEFAULT 'unchecked';
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS routing_status text NOT NULL DEFAULT 'unchecked';
COMMENT ON COLUMN public.complaints.location_status IS 'boundary | nearest_centre | needs_verification | corrected';
COMMENT ON COLUMN public.complaints.routing_status IS 'city | shared_fallback | manual_needed | corrected';

-- ray-casting point-in-polygon over GeoJSON Polygon / MultiPolygon ([lng,lat] order)
CREATE OR REPLACE FUNCTION public.point_in_ring(_lat double precision, _lng double precision, _ring jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE n int := jsonb_array_length(_ring); i int; j int; xi float8; yi float8; xj float8; yj float8; inside boolean := false;
BEGIN
  IF n < 3 THEN RETURN false; END IF;
  j := n - 1;
  FOR i IN 0..n-1 LOOP
    xi := (_ring->i->>0)::float8; yi := (_ring->i->>1)::float8;
    xj := (_ring->j->>0)::float8; yj := (_ring->j->>1)::float8;
    IF ((yi > _lat) <> (yj > _lat)) AND (_lng < (xj - xi) * (_lat - yi) / NULLIF(yj - yi, 0) + xi) THEN
      inside := NOT inside;
    END IF;
    j := i;
  END LOOP;
  RETURN inside;
END; $$;

CREATE OR REPLACE FUNCTION public.point_in_geojson(_lat double precision, _lng double precision, _geom jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE g jsonb := COALESCE(_geom->'geometry', _geom); poly jsonb; k int;
BEGIN
  IF g IS NULL OR g->'coordinates' IS NULL THEN RETURN false; END IF;
  IF g->>'type' = 'Polygon' THEN
    IF NOT public.point_in_ring(_lat,_lng,g->'coordinates'->0) THEN RETURN false; END IF;
    FOR k IN 1..jsonb_array_length(g->'coordinates')-1 LOOP
      IF public.point_in_ring(_lat,_lng,g->'coordinates'->k) THEN RETURN false; END IF; -- hole
    END LOOP;
    RETURN true;
  ELSIF g->>'type' = 'MultiPolygon' THEN
    FOR poly IN SELECT * FROM jsonb_array_elements(g->'coordinates') LOOP
      IF public.point_in_geojson(_lat,_lng, jsonb_build_object('type','Polygon','coordinates',poly)) THEN RETURN true; END IF;
    END LOOP;
  END IF;
  RETURN false;
END; $$;

CREATE OR REPLACE FUNCTION public.distance_m(_lat1 float8, _lng1 float8, _lat2 float8, _lng2 float8)
RETURNS float8 LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT 6371000 * 2 * asin(sqrt(power(sin(radians(_lat2 - _lat1)/2),2) + cos(radians(_lat1)) * cos(radians(_lat2)) * power(sin(radians(_lng2 - _lng1)/2),2)))
$$;

-- resolve a GPS point to city/ward; used by the trigger and the complaint form preview
CREATE OR REPLACE FUNCTION public.locate_point(_lat double precision, _lng double precision, _city text DEFAULT NULL)
RETURNS TABLE(city text, ward_id uuid, ward_name text, ward_number int, zone text, method text, distance_m double precision, is_demo boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w record;
BEGIN
  IF _lat IS NULL OR _lng IS NULL THEN
    RETURN QUERY SELECT _city, NULL::uuid, NULL::text, NULL::int, NULL::text, 'no_gps'::text, NULL::float8, false; RETURN;
  END IF;
  -- 1. official/configured boundary in any city
  SELECT x.* INTO w FROM public.wards x
   WHERE x.boundary IS NOT NULL AND public.point_in_geojson(_lat,_lng,x.boundary)
   ORDER BY (lower(x.city) = lower(COALESCE(_city,''))) DESC LIMIT 1;
  IF w.id IS NOT NULL THEN
    RETURN QUERY SELECT w.city, w.id, w.name, w.ward_number, w.zone, 'boundary'::text, 0::float8, w.is_demo; RETURN;
  END IF;
  -- 2. fallback: nearest ward centre within that ward's radius (any city, chosen city preferred)
  SELECT x.*, public.distance_m(_lat,_lng,x.center_lat,x.center_lng) AS d INTO w FROM public.wards x
   WHERE public.distance_m(_lat,_lng,x.center_lat,x.center_lng) <= GREATEST(x.radius_m, 200)
   ORDER BY (lower(x.city) = lower(COALESCE(_city,''))) DESC, public.distance_m(_lat,_lng,x.center_lat,x.center_lng) LIMIT 1;
  IF w.id IS NOT NULL THEN
    RETURN QUERY SELECT w.city, w.id, w.name, w.ward_number, w.zone, 'nearest_centre'::text, w.d, w.is_demo; RETURN;
  END IF;
  RETURN QUERY SELECT _city, NULL::uuid, NULL::text, NULL::int, NULL::text, 'outside_coverage'::text, NULL::float8, false;
END; $$;
GRANT EXECUTE ON FUNCTION public.locate_point(double precision, double precision, text) TO anon, authenticated;

-- ===== D. City-specific category routing =====
CREATE TABLE IF NOT EXISTS public.city_category_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  category text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  deadline_hours integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS city_category_routing_key ON public.city_category_routing (lower(city), category);
GRANT SELECT ON public.city_category_routing TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.city_category_routing TO authenticated;
GRANT ALL ON public.city_category_routing TO service_role;
ALTER TABLE public.city_category_routing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "City routing is public" ON public.city_category_routing FOR SELECT USING (true);
CREATE POLICY "City admins manage own city routing" ON public.city_category_routing FOR ALL TO authenticated
  USING (public.is_main_admin() OR (public.has_role(auth.uid(),'admin') AND public.admin_can_manage_city(auth.uid(), city)))
  WITH CHECK (public.is_main_admin() OR (public.has_role(auth.uid(),'admin') AND public.admin_can_manage_city(auth.uid(), city)));

CREATE OR REPLACE FUNCTION public.guard_city_routing() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.department_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.id = NEW.department_id
      AND (d.city IS NULL OR lower(d.city) = lower(NEW.city))) THEN
    RAISE EXCEPTION 'Department belongs to a different city';
  END IF;
  IF NEW.deadline_hours IS NOT NULL AND (NEW.deadline_hours < 1 OR NEW.deadline_hours > 2160) THEN
    RAISE EXCEPTION 'Deadline must be between 1 and 2160 hours';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_city_routing BEFORE INSERT OR UPDATE ON public.city_category_routing FOR EACH ROW EXECUTE FUNCTION public.guard_city_routing();

-- shared routing is platform-wide: only the Super Admin may change it
DROP POLICY IF EXISTS "Admins manage routing" ON public.category_routing;
CREATE POLICY "Root manages shared routing" ON public.category_routing FOR ALL TO authenticated
  USING (public.is_main_admin()) WITH CHECK (public.is_main_admin());

CREATE OR REPLACE FUNCTION public.route_new_complaint() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_hours int; v_loc record; v_rule record; v_shared uuid; v_local uuid;
BEGIN
  -- location: city + ward + zone from GPS
  IF NEW.ward_id IS NULL THEN
    SELECT * INTO v_loc FROM public.locate_point(NEW.latitude, NEW.longitude, NEW.city);
    IF v_loc.ward_id IS NOT NULL THEN
      NEW.city := v_loc.city; NEW.ward_id := v_loc.ward_id; NEW.zone := v_loc.zone;
      NEW.location_status := v_loc.method;
    ELSE
      NEW.zone := NULL; NEW.location_status := 'needs_verification';
    END IF;
  ELSE
    SELECT w.zone INTO NEW.zone FROM public.wards w WHERE w.id = NEW.ward_id AND lower(w.city) = lower(NEW.city);
    IF NOT FOUND THEN NEW.ward_id := NULL; NEW.location_status := 'needs_verification'; ELSE NEW.location_status := 'needs_verification'; END IF;
  END IF;

  -- department: city rule -> same-named city department -> shared fallback
  IF NEW.department_id IS NULL THEN
    SELECT r.department_id, r.deadline_hours INTO v_rule FROM public.city_category_routing r
      WHERE lower(r.city) = lower(NEW.city) AND r.category = NEW.category;
    IF v_rule.department_id IS NOT NULL THEN
      NEW.department_id := v_rule.department_id; NEW.routing_status := 'city';
    ELSE
      SELECT department_id INTO v_shared FROM public.category_routing WHERE category = NEW.category;
      IF v_shared IS NOT NULL THEN
        SELECT d2.id INTO v_local FROM public.departments d1 JOIN public.departments d2
          ON lower(d2.name) = lower(d1.name) AND lower(d2.city) = lower(NEW.city)
          WHERE d1.id = v_shared LIMIT 1;
        NEW.department_id := COALESCE(v_local, v_shared);
        NEW.routing_status := CASE WHEN v_local IS NOT NULL THEN 'city' ELSE 'shared_fallback' END;
      ELSE
        NEW.routing_status := 'manual_needed';
      END IF;
    END IF;
  ELSE
    NEW.routing_status := 'city';
  END IF;

  v_hours := v_rule.deadline_hours;
  IF v_hours IS NULL THEN SELECT deadline_hours INTO v_hours FROM public.sla_config WHERE category = NEW.category; END IF;
  IF NEW.priority = 'emergency' THEN v_hours := LEAST(COALESCE(v_hours,72), 12); END IF;
  NEW.due_at := COALESCE(NEW.due_at, now() + make_interval(hours => COALESCE(v_hours, 72)));
  IF NEW.ai_summary IS NULL THEN
    NEW.ai_summary := initcap(replace(NEW.category,'-',' ')) || ' issue at ' || NEW.location || ': ' || left(NEW.description, 140);
  END IF;
  RETURN NEW;
END; $$;

-- citizens may not touch routing/location flags either
CREATE OR REPLACE FUNCTION public.guard_complaint_official_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' AND NULLIF(NEW.after_photo_url,'') IS NULL THEN
    RAISE EXCEPTION 'An after-repair photo is required before marking resolved';
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
END; $$;

-- authorized correction of ward/zone/department, audited
CREATE OR REPLACE FUNCTION public.admin_correct_complaint(_complaint_id uuid, _ward_id uuid, _department_id uuid, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.complaints; w public.wards; v_old jsonb;
BEGIN
  SELECT * INTO c FROM public.complaints WHERE id = _complaint_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Complaint not found'; END IF;
  IF NOT (public.is_main_admin() OR (public.has_role(auth.uid(),'admin') AND public.admin_can_manage_city(auth.uid(), c.city))) THEN
    RAISE EXCEPTION 'Forbidden: only this city''s admin can correct the assignment';
  END IF;
  IF _ward_id IS NOT NULL THEN
    SELECT * INTO w FROM public.wards WHERE id = _ward_id;
    IF w.id IS NULL OR lower(w.city) <> lower(c.city) THEN RAISE EXCEPTION 'Ward belongs to a different city'; END IF;
  END IF;
  IF _department_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.id = _department_id
      AND (d.city IS NULL OR lower(d.city) = lower(c.city))) THEN
    RAISE EXCEPTION 'Department belongs to a different city';
  END IF;
  v_old := jsonb_build_object('ward_id', c.ward_id, 'zone', c.zone, 'department_id', c.department_id,
    'location_status', c.location_status, 'routing_status', c.routing_status);
  UPDATE public.complaints SET
    ward_id = COALESCE(_ward_id, ward_id),
    zone = CASE WHEN _ward_id IS NOT NULL THEN w.zone ELSE zone END,
    location_status = CASE WHEN _ward_id IS NOT NULL THEN 'corrected' ELSE location_status END,
    department_id = COALESCE(_department_id, department_id),
    routing_status = CASE WHEN _department_id IS NOT NULL THEN 'corrected' ELSE routing_status END
  WHERE id = _complaint_id;
  PERFORM public.write_audit('complaint_assignment_corrected', 'complaint', _complaint_id::text,
    jsonb_build_object('before', v_old, 'ward_id', _ward_id, 'department_id', _department_id, 'note', _note), c.city);
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE ALL ON FUNCTION public.admin_correct_complaint(uuid, uuid, uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_correct_complaint(uuid, uuid, uuid, text) TO authenticated;

-- backfill flags on existing complaints
UPDATE public.complaints SET location_status = CASE WHEN ward_id IS NOT NULL THEN 'nearest_centre' ELSE 'needs_verification' END WHERE location_status = 'unchecked';
UPDATE public.complaints SET routing_status = CASE WHEN department_id IS NOT NULL THEN 'city' ELSE 'manual_needed' END WHERE routing_status = 'unchecked';