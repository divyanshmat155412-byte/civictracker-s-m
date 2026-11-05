CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  head_name TEXT,
  contact_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Departments are publicly viewable" ON public.departments FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.complaints ADD COLUMN department_id UUID REFERENCES public.departments(id);

CREATE TABLE public.sla_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  deadline_hours INTEGER NOT NULL DEFAULT 72,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SLA config publicly viewable" ON public.sla_config FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage SLA" ON public.sla_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.sla_config (category, deadline_hours) VALUES
  ('garbage', 48), ('waterlogging', 24), ('broken-road', 72), ('theft', 12),
  ('fire', 6), ('streetlight', 48), ('drainage', 48), ('encroachment', 96),
  ('noise', 72), ('other', 72);

CREATE TABLE public.complaint_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(complaint_id, user_id)
);
ALTER TABLE public.complaint_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Verifications publicly viewable" ON public.complaint_verifications FOR SELECT TO public USING (true);
CREATE POLICY "Auth users can verify" ON public.complaint_verifications FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own verification" ON public.complaint_verifications FOR DELETE TO public USING (auth.uid() = user_id);

CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL,
  icon TEXT DEFAULT '🎁',
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rewards publicly viewable" ON public.rewards FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage rewards" ON public.rewards FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.reward_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reward_id UUID NOT NULL REFERENCES public.rewards(id),
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own redemptions" ON public.reward_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can redeem" ON public.reward_redemptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all redemptions" ON public.reward_redemptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.complaints ADD COLUMN sentiment_score NUMERIC(3,2);
ALTER TABLE public.complaints ADD COLUMN sentiment_label TEXT;
ALTER TABLE public.complaints ADD COLUMN verification_count INTEGER NOT NULL DEFAULT 0;

INSERT INTO public.departments (name, description, head_name, contact_email) VALUES
  ('Public Works', 'Roads, bridges, and infrastructure maintenance', 'Dept Head', 'publicworks@civic.gov'),
  ('Sanitation', 'Waste management and cleanliness', 'Dept Head', 'sanitation@civic.gov'),
  ('Water Supply', 'Water supply and drainage', 'Dept Head', 'water@civic.gov'),
  ('Electricity', 'Streetlights and electrical infrastructure', 'Dept Head', 'electricity@civic.gov'),
  ('Law & Order', 'Security and law enforcement', 'Dept Head', 'law@civic.gov'),
  ('Fire Services', 'Fire prevention and response', 'Dept Head', 'fire@civic.gov'),
  ('Urban Planning', 'Encroachment and building regulations', 'Dept Head', 'planning@civic.gov'),
  ('Environment', 'Noise pollution and environmental issues', 'Dept Head', 'environment@civic.gov');

INSERT INTO public.rewards (title, description, points_cost, icon) VALUES
  ('Civic Hero Badge', 'Special digital badge for your profile', 50, '🏅'),
  ('Certificate of Appreciation', 'Printable certificate recognizing your civic contributions', 100, '📜'),
  ('Priority Complaint Status', 'Your next complaint gets priority handling', 150, '⚡'),
  ('Featured Citizen', 'Get featured on the leaderboard for a week', 200, '⭐'),
  ('Community Champion Award', 'Official recognition from the municipality', 500, '🏆');

ALTER PUBLICATION supabase_realtime ADD TABLE public.complaint_verifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;

CREATE TABLE public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Polls publicly viewable" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Admins can create polls" ON public.polls FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update polls" ON public.polls FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete polls" ON public.polls FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Poll options publicly viewable" ON public.poll_options FOR SELECT USING (true);
CREATE POLICY "Admins can manage poll options" ON public.poll_options FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can vote" ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own vote" ON public.poll_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users see their own votes" ON public.poll_votes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins see all votes" ON public.poll_votes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.worker_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'assigned',
  estimated_arrival TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE public.worker_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX worker_locations_worker_unique ON public.worker_locations(worker_id);
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workers publicly viewable" ON public.workers FOR SELECT USING (true);
CREATE POLICY "Admins manage workers" ON public.workers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Assignments publicly viewable" ON public.worker_assignments FOR SELECT USING (true);
CREATE POLICY "Admins manage assignments" ON public.worker_assignments FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view worker locations" ON public.worker_locations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage locations" ON public.worker_locations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
CREATE POLICY "WhatsApp webhook can insert complaints" ON public.complaints FOR INSERT TO anon WITH CHECK (source = 'whatsapp');

ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT 'Delhi';
CREATE INDEX IF NOT EXISTS idx_complaints_city ON public.complaints(city);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS city text;
CREATE INDEX IF NOT EXISTS idx_user_roles_city ON public.user_roles(city);

CREATE OR REPLACE FUNCTION public.admin_cities(_user_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT array_agg(city) FILTER (WHERE city IS NOT NULL)
  FROM public.user_roles
  WHERE user_id = _user_id AND role = 'admin'
$$;

CREATE OR REPLACE FUNCTION public.admin_can_manage_city(_user_id uuid, _city text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin' AND (city IS NULL OR city = _city)
  )
$$;

DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can delete complaints" ON public.complaints;
CREATE POLICY "Admins can update complaints in their city" ON public.complaints FOR UPDATE TO authenticated
USING (public.admin_can_manage_city(auth.uid(), city)) WITH CHECK (public.admin_can_manage_city(auth.uid(), city));
CREATE POLICY "Admins can delete complaints in their city" ON public.complaints FOR DELETE TO authenticated
USING (public.admin_can_manage_city(auth.uid(), city));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_city text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_home_city_format CHECK (
  home_city IS NULL OR (char_length(btrim(home_city)) BETWEEN 2 AND 80 AND home_city ~ '^[[:alpha:]][[:alpha:][:space:].''\-]*$')
);

CREATE TABLE IF NOT EXISTS public.sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'simulated',
  provider text NOT NULL DEFAULT 'simulated',
  complaint_id uuid REFERENCES public.complaints(id) ON DELETE SET NULL,
  user_id uuid,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all SMS logs" ON public.sms_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own SMS logs" ON public.sms_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert SMS logs" ON public.sms_log FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_sms_log_created_at ON public.sms_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_log_user ON public.sms_log(user_id);

CREATE OR REPLACE FUNCTION public.sync_complaint_verification_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.complaints SET verification_count = COALESCE(verification_count, 0) + 1, updated_at = now() WHERE id = NEW.complaint_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.complaints SET verification_count = GREATEST(COALESCE(verification_count, 0) - 1, 0), updated_at = now() WHERE id = OLD.complaint_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER complaint_verifications_sync_count AFTER INSERT OR DELETE ON public.complaint_verifications FOR EACH ROW EXECUTE FUNCTION public.sync_complaint_verification_count();

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can add timeline entries" ON public.complaint_timeline;

ALTER TABLE public.departments REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.rewards REPLICA IDENTITY FULL;
ALTER TABLE public.reward_redemptions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rewards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reward_redemptions;