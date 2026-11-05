
-- 1. Achievements definitions table
CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  threshold_type TEXT NOT NULL, -- 'complaints_count' or 'green_points'
  threshold_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Achievements are publicly viewable"
  ON public.achievements FOR SELECT
  USING (true);

-- 2. User achievements (unlocked badges)
CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User achievements are publicly viewable"
  ON public.user_achievements FOR SELECT
  USING (true);

CREATE POLICY "System can insert user achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (true);

-- 3. Seed default achievements
INSERT INTO public.achievements (key, title, description, icon, threshold_type, threshold_value) VALUES
  ('first_complaint', 'First Complaint', 'Submit your first complaint', '🎯', 'complaints_count', 1),
  ('active_citizen', 'Active Citizen', 'Submit 5 complaints', '🔥', 'complaints_count', 5),
  ('champion', 'Champion', 'Submit 10 complaints', '🏆', 'complaints_count', 10),
  ('rising_star', 'Rising Star', 'Earn 50+ green points', '⭐', 'green_points', 50),
  ('legend', 'Legend', 'Earn 500+ green points', '💎', 'green_points', 500);

-- 4. Trigger: auto-unlock achievements on profile update
CREATE OR REPLACE FUNCTION public.check_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check complaints_count based achievements
  INSERT INTO public.user_achievements (user_id, achievement_id)
  SELECT NEW.user_id, a.id
  FROM public.achievements a
  WHERE a.threshold_type = 'complaints_count'
    AND NEW.complaints_count >= a.threshold_value
    AND NOT EXISTS (
      SELECT 1 FROM public.user_achievements ua
      WHERE ua.user_id = NEW.user_id AND ua.achievement_id = a.id
    );

  -- Check green_points based achievements
  INSERT INTO public.user_achievements (user_id, achievement_id)
  SELECT NEW.user_id, a.id
  FROM public.achievements a
  WHERE a.threshold_type = 'green_points'
    AND NEW.green_points >= a.threshold_value
    AND NOT EXISTS (
      SELECT 1 FROM public.user_achievements ua
      WHERE ua.user_id = NEW.user_id AND ua.achievement_id = a.id
    );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_update_check_achievements
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_achievements();

-- 5. Trigger: +2 green points to complaint author on upvote
CREATE OR REPLACE FUNCTION public.award_upvote_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  complaint_author UUID;
BEGIN
  -- Get the complaint author
  SELECT user_id INTO complaint_author
  FROM public.complaints
  WHERE id = NEW.complaint_id;

  -- Only award if author exists and is not the upvoter
  IF complaint_author IS NOT NULL AND complaint_author != NEW.user_id THEN
    UPDATE public.profiles
    SET green_points = green_points + 2, updated_at = now()
    WHERE user_id = complaint_author;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_upvote_award_points
  AFTER INSERT ON public.complaint_upvotes
  FOR EACH ROW
  EXECUTE FUNCTION public.award_upvote_points();

-- 6. Enable realtime on complaints and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
