
CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  state text,
  municipal_body text,
  center_lat double precision,
  center_lng double precision,
  contact_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cities_name_lower_key ON public.cities (lower(name));
GRANT SELECT ON public.cities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cities TO authenticated;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cities are public" ON public.cities FOR SELECT USING (true);
CREATE POLICY "Root manages cities" ON public.cities FOR ALL TO authenticated
  USING (public.is_main_admin()) WITH CHECK (public.is_main_admin());
CREATE POLICY "City admins edit own city profile" ON public.cities FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND public.admin_can_manage_city(auth.uid(), name))
  WITH CHECK (public.has_role(auth.uid(),'admin') AND public.admin_can_manage_city(auth.uid(), name));

CREATE OR REPLACE FUNCTION public.guard_city_row() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.name := initcap(btrim(NEW.name));
  IF length(NEW.name) < 2 THEN RAISE EXCEPTION 'City name too short'; END IF;
  IF TG_OP='UPDATE' AND lower(NEW.name) <> lower(OLD.name) THEN
    RAISE EXCEPTION 'City names cannot be renamed (complaints reference them)';
  END IF;
  IF TG_OP='INSERT' THEN NEW.created_by := COALESCE(NEW.created_by, auth.uid()); END IF;
  PERFORM public.write_audit(CASE WHEN TG_OP='INSERT' THEN 'city_onboarded' ELSE 'city_updated' END,'city',NEW.id::text,
    jsonb_build_object('name',NEW.name,'active',NEW.is_active,'municipal_body',NEW.municipal_body), NEW.name);
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_city_row BEFORE INSERT OR UPDATE ON public.cities FOR EACH ROW EXECUTE FUNCTION public.guard_city_row();

-- city-specific departments (NULL city = shared across all cities)
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS city text;
DROP POLICY IF EXISTS "Root manages departments" ON public.departments;
CREATE POLICY "Root manages departments" ON public.departments FOR ALL TO authenticated
  USING (public.is_main_admin()) WITH CHECK (public.is_main_admin());
CREATE POLICY "City admins manage own city departments" ON public.departments FOR ALL TO authenticated
  USING (city IS NOT NULL AND public.has_role(auth.uid(),'admin') AND public.admin_can_manage_city(auth.uid(), city))
  WITH CHECK (city IS NOT NULL AND public.has_role(auth.uid(),'admin') AND public.admin_can_manage_city(auth.uid(), city));

-- routing prefers a same-named department belonging to the complaint's city
CREATE OR REPLACE FUNCTION public.route_new_complaint() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_hours int; v_ward record; v_local uuid;
BEGIN
  IF NEW.department_id IS NULL THEN
    SELECT department_id INTO NEW.department_id FROM public.category_routing WHERE category = NEW.category;
    IF NEW.department_id IS NOT NULL THEN
      SELECT d2.id INTO v_local FROM public.departments d1 JOIN public.departments d2
        ON lower(d2.name) = lower(d1.name) AND lower(d2.city) = lower(NEW.city)
      WHERE d1.id = NEW.department_id LIMIT 1;
      NEW.department_id := COALESCE(v_local, NEW.department_id);
    END IF;
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
