
-- Batch 3: Departments table
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

-- Add department_id to complaints
ALTER TABLE public.complaints ADD COLUMN department_id UUID REFERENCES public.departments(id);

-- SLA tracking: deadline per category
CREATE TABLE public.sla_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  deadline_hours INTEGER NOT NULL DEFAULT 72,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SLA config publicly viewable" ON public.sla_config FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage SLA" ON public.sla_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default SLA configs
INSERT INTO public.sla_config (category, deadline_hours) VALUES
  ('garbage', 48), ('waterlogging', 24), ('broken-road', 72), ('theft', 12),
  ('fire', 6), ('streetlight', 48), ('drainage', 48), ('encroachment', 96),
  ('noise', 72), ('other', 72);

-- Batch 3: Complaint verification
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

-- Batch 4: Audit logs
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

-- Batch 5: Rewards store
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

-- Add sentiment_score to complaints
ALTER TABLE public.complaints ADD COLUMN sentiment_score NUMERIC(3,2);
ALTER TABLE public.complaints ADD COLUMN sentiment_label TEXT;

-- Add verification_count to complaints
ALTER TABLE public.complaints ADD COLUMN verification_count INTEGER NOT NULL DEFAULT 0;

-- Insert sample departments
INSERT INTO public.departments (name, description, head_name, contact_email) VALUES
  ('Public Works', 'Roads, bridges, and infrastructure maintenance', 'Dept Head', 'publicworks@civic.gov'),
  ('Sanitation', 'Waste management and cleanliness', 'Dept Head', 'sanitation@civic.gov'),
  ('Water Supply', 'Water supply and drainage', 'Dept Head', 'water@civic.gov'),
  ('Electricity', 'Streetlights and electrical infrastructure', 'Dept Head', 'electricity@civic.gov'),
  ('Law & Order', 'Security and law enforcement', 'Dept Head', 'law@civic.gov'),
  ('Fire Services', 'Fire prevention and response', 'Dept Head', 'fire@civic.gov'),
  ('Urban Planning', 'Encroachment and building regulations', 'Dept Head', 'planning@civic.gov'),
  ('Environment', 'Noise pollution and environmental issues', 'Dept Head', 'environment@civic.gov');

-- Insert sample rewards
INSERT INTO public.rewards (title, description, points_cost, icon) VALUES
  ('Civic Hero Badge', 'Special digital badge for your profile', 50, '🏅'),
  ('Certificate of Appreciation', 'Printable certificate recognizing your civic contributions', 100, '📜'),
  ('Priority Complaint Status', 'Your next complaint gets priority handling', 150, '⚡'),
  ('Featured Citizen', 'Get featured on the leaderboard for a week', 200, '⭐'),
  ('Community Champion Award', 'Official recognition from the municipality', 500, '🏆');

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaint_verifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
