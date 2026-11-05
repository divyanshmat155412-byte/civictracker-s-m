ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'field_worker';

CREATE TABLE public.wards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  ward_number integer NOT NULL,
  name text NOT NULL,
  zone text NOT NULL,
  center_lat double precision NOT NULL,
  center_lng double precision NOT NULL,
  radius_m integer NOT NULL DEFAULT 1200,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city, ward_number)
);
GRANT SELECT ON public.wards TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.wards TO authenticated;
GRANT ALL ON public.wards TO service_role;
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wards are public" ON public.wards FOR SELECT USING (true);
CREATE POLICY "City admins manage wards" ON public.wards FOR ALL TO authenticated
  USING (public.admin_can_manage_city(auth.uid(), city)) WITH CHECK (public.admin_can_manage_city(auth.uid(), city));
CREATE INDEX idx_wards_city ON public.wards(city);

CREATE TABLE public.category_routing (
  category text PRIMARY KEY,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL
);
GRANT SELECT ON public.category_routing TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.category_routing TO authenticated;
GRANT ALL ON public.category_routing TO service_role;
ALTER TABLE public.category_routing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Routing is public" ON public.category_routing FOR SELECT USING (true);
CREATE POLICY "Admins manage routing" ON public.category_routing FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.category_routing (category, department_id)
SELECT c.category, d.id FROM (VALUES
  ('garbage','Sanitation'),('waterlogging','Water Supply'),('drainage','Water Supply'),
  ('broken-road','Public Works'),('streetlight','Electricity'),('theft','Law & Order'),
  ('fire','Fire Services'),('encroachment','Urban Planning'),('noise','Environment'),('other','Public Works')
) AS c(category, dept) JOIN public.departments d ON d.name = c.dept;

ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS ward_id uuid REFERENCES public.wards(id) ON DELETE SET NULL;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS zone text;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS due_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_complaints_ward ON public.complaints(ward_id);
CREATE INDEX IF NOT EXISTS idx_complaints_geo ON public.complaints(category, created_at, latitude, longitude);
GRANT SELECT (ward_id, zone, due_at) ON public.complaints TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.route_new_complaint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hours int; v_ward record;
BEGIN
  IF NEW.department_id IS NULL THEN
    SELECT department_id INTO NEW.department_id FROM public.category_routing WHERE category = NEW.category;
  END IF;
  SELECT deadline_hours INTO v_hours FROM public.sla_config WHERE category = NEW.category;
  IF NEW.priority = 'emergency' THEN v_hours := LEAST(COALESCE(v_hours,72), 12); END IF;
  NEW.due_at := COALESCE(NEW.due_at, now() + make_interval(hours => COALESCE(v_hours, 72)));
  IF NEW.ward_id IS NULL AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    SELECT w.id, w.zone INTO v_ward FROM public.wards w
    WHERE lower(w.city) = lower(NEW.city)
    ORDER BY (power(w.center_lat - NEW.latitude, 2) + power((w.center_lng - NEW.longitude) * cos(radians(NEW.latitude)), 2))
    LIMIT 1;
    IF v_ward.id IS NOT NULL THEN NEW.ward_id := v_ward.id; NEW.zone := v_ward.zone; END IF;
  END IF;
  IF NEW.ai_summary IS NULL THEN
    NEW.ai_summary := initcap(replace(NEW.category,'-',' ')) || ' issue at ' || NEW.location || ': ' || left(NEW.description, 140);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER route_new_complaint BEFORE INSERT ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.route_new_complaint();

CREATE OR REPLACE FUNCTION public.find_nearby_duplicates(_lat double precision, _lng double precision, _category text, _radius_m int DEFAULT 300, _days int DEFAULT 7)
RETURNS TABLE(id uuid, complaint_id text, title text, status text, distance_m double precision, created_at timestamptz)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT * FROM (
    SELECT c.id, c.complaint_id, c.title, c.status,
      6371000 * 2 * asin(sqrt(power(sin(radians(c.latitude - _lat)/2),2) + cos(radians(_lat)) * cos(radians(c.latitude)) * power(sin(radians(c.longitude - _lng)/2),2))) AS distance_m,
      c.created_at
    FROM public.complaints c
    WHERE c.category = _category AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
      AND c.created_at >= now() - make_interval(days => _days)
      AND c.latitude BETWEEN _lat - 0.01 AND _lat + 0.01
  ) s WHERE s.distance_m <= _radius_m ORDER BY s.distance_m LIMIT 5
$$;
GRANT EXECUTE ON FUNCTION public.find_nearby_duplicates(double precision, double precision, text, int, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_can_manage_city(_user_id uuid, _city text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role::text IN ('admin','moderator') AND (city IS NULL OR lower(city) = lower(_city)))
$$;
CREATE POLICY "Officers add timeline entries" ON public.complaint_timeline FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_timeline.complaint_id AND public.admin_can_manage_city(auth.uid(), c.city)));
CREATE POLICY "Officers manage assignments in city" ON public.worker_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = worker_assignments.complaint_id AND public.admin_can_manage_city(auth.uid(), c.city)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = worker_assignments.complaint_id AND public.admin_can_manage_city(auth.uid(), c.city)));

ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS city text;
GRANT SELECT (user_id, city) ON public.workers TO authenticated;

CREATE OR REPLACE FUNCTION public.my_worker_jobs()
RETURNS TABLE(assignment_id uuid, assignment_status text, assigned_at timestamptz, complaint uuid, complaint_code text, title text, description text, category text, priority text, location text, latitude double precision, longitude double precision, photo_url text, after_photo_url text, due_at timestamptz, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.status, a.assigned_at, c.id, c.complaint_id, c.title, c.description, c.category, c.priority, c.location, c.latitude, c.longitude, c.photo_url, c.after_photo_url, c.due_at, c.status
  FROM public.worker_assignments a JOIN public.workers w ON w.id = a.worker_id JOIN public.complaints c ON c.id = a.complaint_id
  WHERE w.user_id = auth.uid() ORDER BY (a.status = 'completed'), c.due_at NULLS LAST
$$;
GRANT EXECUTE ON FUNCTION public.my_worker_jobs() TO authenticated;

CREATE OR REPLACE FUNCTION public.worker_update_job(_assignment_id uuid, _status text, _after_photo_url text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_complaint uuid;
BEGIN
  IF _status NOT IN ('in-progress','completed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT a.complaint_id INTO v_complaint FROM public.worker_assignments a JOIN public.workers w ON w.id = a.worker_id
  WHERE a.id = _assignment_id AND w.user_id = auth.uid();
  IF v_complaint IS NULL THEN RAISE EXCEPTION 'Not your assignment'; END IF;
  IF _status = 'completed' AND NULLIF(_after_photo_url,'') IS NULL THEN RAISE EXCEPTION 'After-repair photo is required'; END IF;
  UPDATE public.worker_assignments SET status = _status, completed_at = CASE WHEN _status='completed' THEN now() END WHERE id = _assignment_id;
  UPDATE public.complaints SET
    status = CASE WHEN _status='completed' THEN 'resolved' ELSE 'in-progress' END,
    after_photo_url = COALESCE(NULLIF(_after_photo_url,''), after_photo_url),
    before_photo_url = COALESCE(before_photo_url, photo_url),
    resolved_at = CASE WHEN _status='completed' THEN now() ELSE resolved_at END
  WHERE id = v_complaint;
  INSERT INTO public.complaint_timeline (complaint_id, status, note, updated_by)
  VALUES (v_complaint, CASE WHEN _status='completed' THEN 'resolved' ELSE 'in-progress' END,
    COALESCE(_note, CASE WHEN _status='completed' THEN 'Field worker completed the job with after-repair photo' ELSE 'Field worker started work' END), auth.uid());
END; $$;
GRANT EXECUTE ON FUNCTION public.worker_update_job(uuid, text, text, text) TO authenticated;

INSERT INTO public.wards (city, ward_number, name, zone, center_lat, center_lng) VALUES
 ('Ratlam',1,'Station Road','Zone A - Central',23.3315,75.0367),
 ('Ratlam',2,'Chandni Chowk','Zone A - Central',23.3335,75.0410),
 ('Ratlam',3,'Do Batti','Zone A - Central',23.3290,75.0430),
 ('Ratlam',4,'Dongre Nagar','Zone B - North',23.3450,75.0390),
 ('Ratlam',5,'Kasturba Nagar','Zone B - North',23.3480,75.0480),
 ('Ratlam',6,'Shastri Nagar','Zone C - East',23.3320,75.0560),
 ('Ratlam',7,'Sailana Road','Zone C - East',23.3360,75.0650),
 ('Ratlam',8,'Juna Ratlam','Zone D - West',23.3270,75.0250),
 ('Ratlam',9,'Mhow Road','Zone D - West',23.3200,75.0330),
 ('Ratlam',10,'Railway Colony','Zone E - South',23.3150,75.0420);