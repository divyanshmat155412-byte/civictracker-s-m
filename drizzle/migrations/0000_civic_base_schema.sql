CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  badge_level TEXT NOT NULL DEFAULT 'bronze' CHECK (badge_level IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  green_points INTEGER NOT NULL DEFAULT 0,
  complaints_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are publicly viewable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE SEQUENCE IF NOT EXISTS complaint_id_seq START 1;

CREATE TABLE public.complaints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id TEXT NOT NULL DEFAULT '',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('garbage', 'waterlogging', 'broken-road', 'theft', 'fire', 'streetlight', 'drainage', 'encroachment', 'noise', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'resolved', 'escalated')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'emergency')),
  photo_url TEXT,
  location TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  anonymous BOOLEAN NOT NULL DEFAULT false,
  submitted_by TEXT NOT NULL DEFAULT 'Anonymous',
  upvotes INTEGER NOT NULL DEFAULT 0,
  resolved_at TIMESTAMP WITH TIME ZONE,
  before_photo_url TEXT,
  after_photo_url TEXT,
  ai_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Complaints are publicly viewable" ON public.complaints FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create complaints" ON public.complaints FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own complaints" ON public.complaints FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_complaints_updated_at BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_complaint_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.complaint_id = 'CT-' || LPAD(nextval('complaint_id_seq')::TEXT, 2, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_complaint_id BEFORE INSERT ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.generate_complaint_id();

CREATE TABLE public.complaint_upvotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(complaint_id, user_id)
);
ALTER TABLE public.complaint_upvotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Upvotes are publicly viewable" ON public.complaint_upvotes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can upvote" ON public.complaint_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own upvote" ON public.complaint_upvotes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.complaint_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.complaint_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Timeline is publicly viewable" ON public.complaint_timeline FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add timeline entries" ON public.complaint_timeline FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update complaints" ON public.complaints FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete complaints" ON public.complaints FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert timeline entries" ON public.complaint_timeline FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.admin_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own request" ON public.admin_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own request" ON public.admin_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all requests" ON public.admin_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update requests" ON public.admin_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete requests" ON public.admin_requests FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'complaint_update',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notifications are publicly viewable" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own subscriptions" ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subscriptions" ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_new_complaint()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (title, body, complaint_id, type)
  VALUES ('🚨 New Complaint: ' || NEW.title, NEW.category || ' issue reported at ' || NEW.location || '. ' || LEFT(NEW.description, 100), NEW.id, 'new_complaint');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_complaint_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (title, body, complaint_id, type)
    VALUES ('✅ Update: ' || NEW.title, 'Status changed to ' || NEW.status || ' at ' || NEW.location, NEW.id, 'complaint_update');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_complaint_notify AFTER INSERT ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.notify_new_complaint();
CREATE TRIGGER on_complaint_update_notify AFTER UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.notify_complaint_update();

CREATE TABLE public.complaint_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'Anonymous',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.complaint_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are publicly viewable" ON public.complaint_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add comments" ON public.complaint_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.complaint_comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any comment" ON public.complaint_comments FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_comments_complaint ON public.complaint_comments(complaint_id);

CREATE TABLE public.complaint_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(complaint_id, user_id)
);
ALTER TABLE public.complaint_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ratings are publicly viewable" ON public.complaint_ratings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can rate" ON public.complaint_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rating" ON public.complaint_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX idx_ratings_complaint ON public.complaint_ratings(complaint_id);

CREATE OR REPLACE FUNCTION public.update_profile_on_complaint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_points integer;
  new_count integer;
  new_badge text;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.profiles (user_id, green_points, complaints_count, badge_level)
  VALUES (NEW.user_id, 10, 1, 'bronze')
  ON CONFLICT (user_id) DO UPDATE SET
    green_points = profiles.green_points + 10,
    complaints_count = profiles.complaints_count + 1,
    updated_at = now()
  RETURNING green_points, complaints_count INTO new_points, new_count;
  IF new_points >= 500 THEN new_badge := 'diamond';
  ELSIF new_points >= 300 THEN new_badge := 'platinum';
  ELSIF new_points >= 150 THEN new_badge := 'gold';
  ELSIF new_points >= 50 THEN new_badge := 'silver';
  ELSE new_badge := 'bronze';
  END IF;
  UPDATE public.profiles SET badge_level = new_badge WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_complaint_update_profile AFTER INSERT ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.update_profile_on_complaint();

CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  threshold_type TEXT NOT NULL,
  threshold_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Achievements are publicly viewable" ON public.achievements FOR SELECT USING (true);

CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User achievements are publicly viewable" ON public.user_achievements FOR SELECT USING (true);

INSERT INTO public.achievements (key, title, description, icon, threshold_type, threshold_value) VALUES
  ('first_complaint', 'First Complaint', 'Submit your first complaint', '🎯', 'complaints_count', 1),
  ('active_citizen', 'Active Citizen', 'Submit 5 complaints', '🔥', 'complaints_count', 5),
  ('champion', 'Champion', 'Submit 10 complaints', '🏆', 'complaints_count', 10),
  ('rising_star', 'Rising Star', 'Earn 50+ green points', '⭐', 'green_points', 50),
  ('legend', 'Legend', 'Earn 500+ green points', '💎', 'green_points', 500);

CREATE OR REPLACE FUNCTION public.check_achievements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_achievements (user_id, achievement_id)
  SELECT NEW.user_id, a.id FROM public.achievements a
  WHERE a.threshold_type = 'complaints_count' AND NEW.complaints_count >= a.threshold_value
    AND NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = NEW.user_id AND ua.achievement_id = a.id);
  INSERT INTO public.user_achievements (user_id, achievement_id)
  SELECT NEW.user_id, a.id FROM public.achievements a
  WHERE a.threshold_type = 'green_points' AND NEW.green_points >= a.threshold_value
    AND NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = NEW.user_id AND ua.achievement_id = a.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_update_check_achievements AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_achievements();

CREATE OR REPLACE FUNCTION public.award_upvote_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE complaint_author UUID;
BEGIN
  SELECT user_id INTO complaint_author FROM public.complaints WHERE id = NEW.complaint_id;
  IF complaint_author IS NOT NULL AND complaint_author != NEW.user_id THEN
    UPDATE public.profiles SET green_points = green_points + 2, updated_at = now() WHERE user_id = complaint_author;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_upvote_award_points AFTER INSERT ON public.complaint_upvotes FOR EACH ROW EXECUTE FUNCTION public.award_upvote_points();

CREATE POLICY "Authenticated users can upload complaint photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'complaint-photos' AND auth.uid() IS NOT NULL);

ALTER TABLE public.complaints REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.complaint_comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaint_comments;