
-- ===== Root identity: immutable user id, not email =====
CREATE OR REPLACE FUNCTION public.root_admin_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT NULLIF(value,'')::uuid FROM public.app_config WHERE key='root_admin_user_id' $$;
REVOKE ALL ON FUNCTION public.root_admin_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.root_admin_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_main_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(auth.uid() IS NOT NULL AND auth.uid() = public.root_admin_id(), false) $$;

INSERT INTO public.app_config(key,value)
SELECT 'root_admin_user_id', id::text FROM auth.users WHERE lower(email)=lower((SELECT value FROM public.app_config WHERE key='main_admin_email'))
ON CONFLICT (key) DO NOTHING;

-- signup never grants admin anymore
CREATE OR REPLACE FUNCTION public.grant_main_admin_role() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN RETURN NEW; END; $$;

-- ===== Role status (suspend / deactivate) =====
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS approved_at timestamptz DEFAULT now();
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS approved_by uuid;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (_user_id = public.root_admin_id() AND _role IN ('admin','moderator'))
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role AND status='active') $$;

-- only root has all-city access; everyone else must have an explicit active city
CREATE OR REPLACE FUNCTION public.admin_can_manage_city(_user_id uuid, _city text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _user_id = public.root_admin_id() OR EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id=_user_id AND role::text IN ('admin','moderator') AND status='active'
      AND city IS NOT NULL AND lower(city)=lower(_city)) $$;

CREATE OR REPLACE FUNCTION public.admin_cities(_user_id uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT array_agg(DISTINCT city) FILTER (WHERE city IS NOT NULL) FROM public.user_roles
  WHERE user_id=_user_id AND role IN ('admin','moderator') AND status='active' $$;

-- ===== Audit log =====
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS city text;
CREATE OR REPLACE FUNCTION public.write_audit(_action text, _target_type text, _target_id text, _details jsonb, _city text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.audit_logs(user_id, action, target_type, target_id, details, city)
  VALUES (COALESCE(auth.uid(),'00000000-0000-0000-0000-000000000000'::uuid), _action, _target_type, _target_id, _details, _city) $$;
REVOKE ALL ON FUNCTION public.write_audit(text,text,text,jsonb,text) FROM anon, authenticated, public;

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Root views all audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_main_admin());
CREATE POLICY "City admins view own city logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (city IS NOT NULL AND public.has_role(auth.uid(),'admin') AND public.admin_can_manage_city(auth.uid(), city));

-- ===== user_roles: root-only management, root rows immutable =====
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Root manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_main_admin()) WITH CHECK (public.is_main_admin());

CREATE OR REPLACE FUNCTION public.guard_user_roles() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r uuid := public.root_admin_id();
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.user_id = r THEN
    RAISE EXCEPTION 'The Platform Super Admin cannot be modified or removed';
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF NEW.user_id <> COALESCE(r,'00000000-0000-0000-0000-000000000000'::uuid)
       AND NEW.role IN ('admin','moderator') AND NULLIF(trim(COALESCE(NEW.city,'')),'') IS NULL THEN
      RAISE EXCEPTION 'City admins and officers must be assigned a city (only one platform super admin exists)';
    END IF;
    IF NEW.status NOT IN ('active','suspended','deactivated') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN
    PERFORM public.write_audit('role_removed','user_role',OLD.user_id::text, jsonb_build_object('role',OLD.role,'city',OLD.city), OLD.city);
    RETURN OLD;
  END IF;
  PERFORM public.write_audit(CASE WHEN TG_OP='INSERT' THEN 'role_granted' ELSE 'role_changed' END,'user_role',NEW.user_id::text,
    jsonb_build_object('role',NEW.role,'city',NEW.city,'status',NEW.status), NEW.city);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_user_roles ON public.user_roles;
CREATE TRIGGER guard_user_roles BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_roles();

-- ===== Admin applications: root-only inbox =====
ALTER TABLE public.admin_requests ADD COLUMN IF NOT EXISTS requested_city text;
ALTER TABLE public.admin_requests ADD COLUMN IF NOT EXISTS decision_note text;
DROP POLICY IF EXISTS "Admins can delete requests" ON public.admin_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.admin_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.admin_requests;
DROP POLICY IF EXISTS "Users can insert their own request" ON public.admin_requests;
CREATE POLICY "Users submit own pending request" ON public.admin_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);
CREATE POLICY "Root views all requests" ON public.admin_requests FOR SELECT TO authenticated USING (public.is_main_admin());

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
  PERFORM public.write_audit(CASE WHEN _approve THEN 'admin_application_approved' ELSE 'admin_application_rejected' END,
    'admin_request', _request_id::text, jsonb_build_object('applicant',req.user_id,'city',v_city,'note',_note), v_city);
  RETURN jsonb_build_object('ok',true);
END; $$;
REVOKE ALL ON FUNCTION public.root_decide_admin_request(uuid,boolean,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.root_decide_admin_request(uuid,boolean,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.root_set_admin_status(_user_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_main_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _user_id = public.root_admin_id() THEN RAISE EXCEPTION 'The Platform Super Admin cannot be modified'; END IF;
  IF _status = 'removed' THEN
    DELETE FROM public.user_roles WHERE user_id=_user_id AND role IN ('admin','moderator');
  ELSE
    UPDATE public.user_roles SET status=_status WHERE user_id=_user_id AND role IN ('admin','moderator');
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.root_set_admin_status(uuid,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.root_set_admin_status(uuid,text) TO authenticated;

-- role grant / revoke / list: root only, never touch root
CREATE OR REPLACE FUNCTION public.admin_grant_role_by_email(_email text, _role app_role, _city text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE target_id uuid;
BEGIN
  IF NOT public.is_main_admin() THEN RAISE EXCEPTION 'Forbidden: only the Platform Super Admin can manage roles'; END IF;
  SELECT id INTO target_id FROM auth.users WHERE lower(email)=lower(trim(_email)) LIMIT 1;
  IF target_id IS NULL THEN RAISE EXCEPTION 'No user found with that email'; END IF;
  IF target_id = public.root_admin_id() THEN RAISE EXCEPTION 'The Platform Super Admin already has full access'; END IF;
  INSERT INTO public.user_roles(user_id, role, city, status, approved_at, approved_by)
  VALUES (target_id,_role,NULLIF(trim(COALESCE(_city,'')),''),'active',now(),auth.uid()) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('user_id',target_id,'role',_role);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_role_by_email(_email text, _role app_role)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE target_id uuid; n int;
BEGIN
  IF NOT public.is_main_admin() THEN RAISE EXCEPTION 'Forbidden: only the Platform Super Admin can manage roles'; END IF;
  SELECT id INTO target_id FROM auth.users WHERE lower(email)=lower(trim(_email)) LIMIT 1;
  IF target_id IS NULL THEN RAISE EXCEPTION 'No user found with that email'; END IF;
  IF target_id = public.root_admin_id() THEN RAISE EXCEPTION 'The Platform Super Admin cannot be modified'; END IF;
  DELETE FROM public.user_roles WHERE user_id=target_id AND role=_role;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('user_id',target_id,'role',_role,'deleted',n);
END; $$;

DROP FUNCTION IF EXISTS public.admin_list_role_assignments();
CREATE FUNCTION public.admin_list_role_assignments()
RETURNS TABLE(user_id uuid, email text, role app_role, city text, status text, approved_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_main_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT ur.user_id, u.email::text, ur.role, ur.city, ur.status, ur.approved_at
    FROM public.user_roles ur JOIN auth.users u ON u.id=ur.user_id
    WHERE ur.user_id <> public.root_admin_id() ORDER BY ur.city NULLS FIRST, ur.role, u.email;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_role_assignments() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_role_assignments() TO authenticated;

-- ===== Complaints =====
DROP POLICY IF EXISTS "Admins can delete complaints in their city" ON public.complaints;
CREATE POLICY "Only root deletes complaints" ON public.complaints FOR DELETE TO authenticated USING (public.is_main_admin());

CREATE OR REPLACE FUNCTION public.guard_complaint_official_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  -- resolution always needs after-repair proof
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
     OR NEW.city IS DISTINCT FROM OLD.city OR NEW.ward_id IS DISTINCT FROM OLD.ward_id
     OR NEW.verification_count IS DISTINCT FROM OLD.verification_count OR NEW.upvotes IS DISTINCT FROM OLD.upvotes THEN
    RAISE EXCEPTION 'Only officers can change status, priority, department, deadline, city or proof photos';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.audit_complaint_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ch jsonb := '{}'::jsonb; k text;
BEGIN
  FOREACH k IN ARRAY ARRAY['title','description','category','status','priority','department_id','due_at','city','ward_id','after_photo_url','resolved_at'] LOOP
    IF (to_jsonb(OLD)->k) IS DISTINCT FROM (to_jsonb(NEW)->k) THEN
      ch := ch || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(OLD)->k, 'to', to_jsonb(NEW)->k));
    END IF;
  END LOOP;
  IF ch <> '{}'::jsonb THEN
    PERFORM public.write_audit('complaint_updated','complaint',NEW.complaint_id, ch, NEW.city);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS audit_complaint_change ON public.complaints;
CREATE TRIGGER audit_complaint_change AFTER UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.audit_complaint_change();

CREATE OR REPLACE FUNCTION public.audit_complaint_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN PERFORM public.write_audit('complaint_deleted','complaint',OLD.complaint_id, jsonb_build_object('title',OLD.title), OLD.city); RETURN OLD; END; $$;
DROP TRIGGER IF EXISTS audit_complaint_delete ON public.complaints;
CREATE TRIGGER audit_complaint_delete AFTER DELETE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.audit_complaint_delete();

-- assignments audit
CREATE OR REPLACE FUNCTION public.audit_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.complaints;
BEGIN
  SELECT * INTO c FROM public.complaints WHERE id = COALESCE(NEW.complaint_id, OLD.complaint_id);
  PERFORM public.write_audit('worker_assignment_'||lower(TG_OP),'complaint',c.complaint_id,
    jsonb_build_object('worker_id',COALESCE(NEW.worker_id,OLD.worker_id),'status',COALESCE(NEW.status,OLD.status)), c.city);
  RETURN COALESCE(NEW,OLD);
END; $$;
DROP TRIGGER IF EXISTS audit_assignment ON public.worker_assignments;
CREATE TRIGGER audit_assignment AFTER INSERT OR UPDATE OR DELETE ON public.worker_assignments FOR EACH ROW EXECUTE FUNCTION public.audit_assignment();

-- ===== Remove global "any admin" bypass policies =====
DROP POLICY IF EXISTS "Admins can insert timeline entries" ON public.complaint_timeline;
DROP POLICY IF EXISTS "Admins manage assignments" ON public.worker_assignments;
DROP POLICY IF EXISTS "Admins manage workers" ON public.workers;
CREATE POLICY "City admins manage workers in city" ON public.workers FOR ALL TO authenticated
  USING (public.is_main_admin() OR (city IS NOT NULL AND public.has_role(auth.uid(),'admin') AND public.admin_can_manage_city(auth.uid(), city)))
  WITH CHECK (public.is_main_admin() OR (city IS NOT NULL AND public.has_role(auth.uid(),'admin') AND public.admin_can_manage_city(auth.uid(), city)));
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "Root manages departments" ON public.departments FOR ALL TO authenticated
  USING (public.is_main_admin()) WITH CHECK (public.is_main_admin());

-- ===== Root dashboard data =====
CREATE OR REPLACE FUNCTION public.root_platform_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_main_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN jsonb_build_object(
    'cities', (SELECT count(DISTINCT lower(city)) FROM (SELECT city FROM public.complaints UNION SELECT city FROM public.wards) x),
    'wards', (SELECT count(*) FROM public.wards),
    'zones', (SELECT count(DISTINCT city||'/'||zone) FROM public.wards),
    'citizens', (SELECT count(*) FROM public.profiles),
    'city_admins', (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role='admin' AND user_id <> public.root_admin_id()),
    'officers', (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role='moderator' AND user_id <> public.root_admin_id()),
    'field_workers', (SELECT count(*) FROM public.workers),
    'complaints', (SELECT count(*) FROM public.complaints),
    'resolved', (SELECT count(*) FROM public.complaints WHERE status='resolved'),
    'pending', (SELECT count(*) FROM public.complaints WHERE status <> 'resolved'),
    'overdue', (SELECT count(*) FROM public.complaints WHERE status <> 'resolved' AND due_at < now()),
    'pending_applications', (SELECT count(*) FROM public.admin_requests WHERE status='pending'),
    'by_city', (SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) FROM (
       SELECT city, count(*) total, count(*) FILTER (WHERE status='resolved') resolved,
         count(*) FILTER (WHERE status<>'resolved' AND due_at<now()) overdue,
         round(avg(EXTRACT(epoch FROM resolved_at-created_at)/3600) FILTER (WHERE resolved_at IS NOT NULL)::numeric,1) avg_hours
       FROM public.complaints GROUP BY city ORDER BY 2 DESC) t),
    'by_department', (SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) FROM (
       SELECT COALESCE(d.name,'Unassigned') department, count(*) total, count(*) FILTER (WHERE c.status='resolved') resolved,
         count(*) FILTER (WHERE c.status<>'resolved' AND c.due_at<now()) overdue
       FROM public.complaints c LEFT JOIN public.departments d ON d.id=c.department_id GROUP BY 1 ORDER BY 2 DESC) t),
    'by_admin', (SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) FROM (
       SELECT a.user_id, count(*) actions, max(a.created_at) last_action
       FROM public.audit_logs a WHERE a.user_id <> public.root_admin_id()
         AND a.user_id IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin','moderator'))
       GROUP BY a.user_id ORDER BY 2 DESC LIMIT 50) t)
  );
END; $$;
REVOKE ALL ON FUNCTION public.root_platform_overview() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.root_platform_overview() TO authenticated;

-- admin login/logout event logging (client-reported, server-stamped)
CREATE OR REPLACE FUNCTION public.log_session_event(_event text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR _event NOT IN ('login','logout') THEN RETURN; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN RETURN; END IF;
  PERFORM public.write_audit('admin_'||_event,'session',auth.uid()::text,'{}'::jsonb,(public.admin_cities(auth.uid()))[1]);
END; $$;
REVOKE ALL ON FUNCTION public.log_session_event(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_session_event(text) TO authenticated;
