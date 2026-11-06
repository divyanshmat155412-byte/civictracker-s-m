CREATE TABLE public.worker_role_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,city text NOT NULL,status text NOT NULL DEFAULT 'pending',created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,UNIQUE(user_id,city),CHECK(status IN ('pending','approved','rejected')));
GRANT SELECT ON public.worker_role_requests TO authenticated;
GRANT ALL ON public.worker_role_requests TO service_role;
ALTER TABLE public.worker_role_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Worker requests owner or city admin read" ON public.worker_role_requests FOR SELECT TO authenticated USING(user_id=auth.uid() OR (public.has_role(auth.uid(),'admin') AND public.admin_can_manage_city(auth.uid(),city)));
CREATE FUNCTION public.request_field_worker_role(_city text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_city text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'Verified account required'; END IF;
 IF public.is_main_admin() THEN RAISE EXCEPTION 'Root account cannot request worker access'; END IF;
 SELECT name INTO v_city FROM public.cities WHERE lower(name)=lower(btrim(_city)) AND is_active LIMIT 1;
 IF v_city IS NULL AND btrim(_city) IN ('Ratlam','Delhi','Mumbai','Bangalore','Hyderabad','Chennai','Kolkata','Pune','Ahmedabad','Jaipur','Lucknow','Indore','Bhopal','Surat','Nagpur') THEN v_city:=btrim(_city); END IF;
 IF v_city IS NULL THEN RAISE EXCEPTION 'Choose an active city'; END IF;
 INSERT INTO public.worker_role_requests(user_id,city) VALUES(auth.uid(),v_city) ON CONFLICT(user_id,city) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.request_field_worker_role(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_field_worker_role(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_link_worker_account(_worker_id uuid,_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.workers; v_uid uuid; req public.worker_role_requests;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO w FROM public.workers WHERE id=_worker_id FOR UPDATE;
 IF w.id IS NULL OR w.city IS NULL OR NOT public.admin_can_manage_city(auth.uid(),w.city) THEN RAISE EXCEPTION 'Worker not available in your city'; END IF;
 SELECT id INTO v_uid FROM auth.users WHERE lower(email)=lower(btrim(_email)) AND email_confirmed_at IS NOT NULL;
 IF v_uid IS NULL OR v_uid=public.root_admin_id() THEN RAISE EXCEPTION 'Eligible verified worker account required'; END IF;
 SELECT * INTO req FROM public.worker_role_requests WHERE user_id=v_uid AND lower(city)=lower(w.city) AND status IN ('pending','approved') FOR UPDATE;
 IF req.id IS NULL THEN RAISE EXCEPTION 'Worker must request field_worker access in this city first'; END IF;
 IF w.user_id IS NOT NULL AND w.user_id<>v_uid THEN RAISE EXCEPTION 'An already linked worker cannot be reassigned'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='field_worker' AND (city IS NULL OR lower(city)<>lower(w.city) OR status<>'active')) THEN RAISE EXCEPTION 'Incompatible worker role'; END IF;
 UPDATE public.workers SET user_id=v_uid WHERE id=w.id;
 INSERT INTO public.user_roles(user_id,role,city,status,approved_at,approved_by) VALUES(v_uid,'field_worker',w.city,'active',now(),auth.uid()) ON CONFLICT DO NOTHING;
 UPDATE public.worker_role_requests SET status='approved',reviewed_at=now() WHERE id=req.id;
 PERFORM public.write_audit('worker_account_linked','worker',w.id::text,jsonb_build_object('request_id',req.id),w.city);
END $$;
REVOKE ALL ON FUNCTION public.admin_link_worker_account(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_link_worker_account(uuid,text) TO authenticated;
REVOKE INSERT,UPDATE ON public.workers FROM authenticated;
REVOKE INSERT(user_id),UPDATE(user_id) ON public.workers FROM authenticated;
GRANT INSERT(id,name,phone,department_id,is_active,created_at,city),UPDATE(name,phone,department_id,is_active,city) ON public.workers TO authenticated;
CREATE TABLE public.point_reward_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('complaint','upvote')),reward_key text NOT NULL,points integer NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(user_id,kind,reward_key));
GRANT ALL ON public.point_reward_events TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.point_reward_events_id_seq TO service_role;
ALTER TABLE public.point_reward_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX point_rewards_daily ON public.point_reward_events(user_id,kind,created_at);
CREATE FUNCTION public._award_capped_points(_uid uuid,_kind text,_key text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_points int; v_cap int; v_used int; v_start timestamptz; v_id bigint;
BEGIN
 IF _uid IS NULL OR _key IS NULL THEN RETURN 0; END IF;
 IF _kind='complaint' THEN v_points:=10; v_cap:=50; ELSIF _kind='upvote' THEN v_points:=2; v_cap:=20; ELSE RAISE EXCEPTION 'Invalid reward kind'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('points|'||_uid::text,0));
 v_start:=date_trunc('day',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 SELECT COALESCE(sum(points),0) INTO v_used FROM public.point_reward_events WHERE user_id=_uid AND kind=_kind AND created_at>=v_start;
 INSERT INTO public.point_reward_events(user_id,kind,reward_key,points) VALUES(_uid,_kind,_key,CASE WHEN v_used+v_points<=v_cap THEN v_points ELSE 0 END) ON CONFLICT DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL OR v_used+v_points>v_cap THEN RETURN 0; END IF;
 RETURN v_points;
END $$;
REVOKE ALL ON FUNCTION public._award_capped_points(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._award_capped_points(uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.update_profile_on_complaint() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_points int:=0; v_total int; v_key text;
BEGIN
 IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('points|'||NEW.user_id::text,0));
 v_key:=md5(lower(regexp_replace(btrim(NEW.city||'|'||NEW.category||'|'||NEW.title||'|'||NEW.description||'|'||NEW.location),'\s+',' ','g')));
 IF NOT EXISTS(SELECT 1 FROM public.complaints c WHERE c.id<>NEW.id AND c.user_id=NEW.user_id AND c.created_at>=clock_timestamp()-interval '7 days' AND lower(c.city)=lower(NEW.city) AND c.category=NEW.category AND ((NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL AND public.distance_m(NEW.latitude,NEW.longitude,c.latitude,c.longitude)<=300) OR md5(lower(regexp_replace(btrim(c.city||'|'||c.category||'|'||c.title||'|'||c.description||'|'||c.location),'\s+',' ','g')))=v_key)) THEN v_points:=public._award_capped_points(NEW.user_id,'complaint',v_key); END IF;
 INSERT INTO public.profiles(user_id,green_points,complaints_count,badge_level) VALUES(NEW.user_id,v_points,1,'bronze') ON CONFLICT(user_id) DO UPDATE SET green_points=profiles.green_points+v_points,complaints_count=profiles.complaints_count+1,updated_at=now() RETURNING green_points INTO v_total;
 UPDATE public.profiles SET badge_level=CASE WHEN v_total>=500 THEN 'diamond' WHEN v_total>=300 THEN 'platinum' WHEN v_total>=150 THEN 'gold' WHEN v_total>=50 THEN 'silver' ELSE 'bronze' END WHERE user_id=NEW.user_id;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.award_upvote_points() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_author uuid; v_points int;
BEGIN
 SELECT user_id INTO v_author FROM public.complaints WHERE id=NEW.complaint_id;
 IF v_author IS NULL OR v_author=NEW.user_id THEN RETURN NEW; END IF;
 v_points:=public._award_capped_points(v_author,'upvote',NEW.complaint_id::text||'|'||NEW.user_id::text);
 IF v_points>0 THEN UPDATE public.profiles SET green_points=green_points+v_points,updated_at=now() WHERE user_id=v_author; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.update_profile_on_complaint(),public.award_upvote_points() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_on_complaint(),public.award_upvote_points() TO service_role;
REVOKE SELECT(user_id,home_city,created_at,updated_at) ON public.profiles FROM anon;
DROP POLICY "Profiles are publicly viewable" ON public.profiles;
CREATE POLICY "Named public leaderboard profiles" ON public.profiles FOR SELECT TO anon USING(full_name IS NOT NULL);
CREATE POLICY "Own profile read" ON public.profiles FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION public.public_leaderboard() RETURNS TABLE(id uuid,full_name text,avatar_url text,badge_level text,green_points integer,complaints_count integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT p.id,p.full_name,p.avatar_url,p.badge_level,p.green_points,p.complaints_count FROM public.profiles p ORDER BY p.green_points DESC,p.id LIMIT 50 $$;
REVOKE ALL ON FUNCTION public.public_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_leaderboard() TO anon,authenticated;
DROP POLICY "Assignments publicly viewable" ON public.worker_assignments;
REVOKE SELECT ON public.worker_assignments FROM anon;
CREATE POLICY "Assigned worker reads assignments" ON public.worker_assignments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.workers w WHERE w.id=worker_id AND w.user_id=auth.uid()));
CREATE FUNCTION public.public_complaint_assignment(_complaint_id uuid) RETURNS TABLE(status text,worker_name text,latitude double precision,longitude double precision,location text,worker_latitude double precision,worker_longitude double precision) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT a.status,w.name,c.latitude,c.longitude,c.location,l.latitude,l.longitude FROM public.worker_assignments a JOIN public.complaints c ON c.id=a.complaint_id JOIN public.workers w ON w.id=a.worker_id LEFT JOIN public.worker_locations l ON l.worker_id=w.id WHERE c.id=_complaint_id AND a.status<>'completed' ORDER BY a.assigned_at DESC LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.public_complaint_assignment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_complaint_assignment(uuid) TO anon,authenticated;
DROP POLICY "Notifications are publicly viewable" ON public.notifications;
CREATE POLICY "Public admin broadcasts only" ON public.notifications FOR SELECT TO anon,authenticated USING(complaint_id IS NULL AND type IN ('announcement','broadcast'));
CREATE POLICY "Complaint notification owner or city staff" ON public.notifications FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.complaints c WHERE c.id=notifications.complaint_id AND (c.user_id=auth.uid() OR public.admin_can_manage_city(auth.uid(),c.city))));
