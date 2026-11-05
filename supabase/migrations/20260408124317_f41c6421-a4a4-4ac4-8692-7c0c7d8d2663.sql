
-- Function to update profile stats on new complaint
CREATE OR REPLACE FUNCTION public.update_profile_on_complaint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_points integer;
  new_count integer;
  new_badge text;
BEGIN
  -- Only process if user_id is set
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Upsert profile: increment points and count
  INSERT INTO public.profiles (user_id, green_points, complaints_count, badge_level)
  VALUES (NEW.user_id, 10, 1, 'bronze')
  ON CONFLICT (user_id) DO UPDATE SET
    green_points = profiles.green_points + 10,
    complaints_count = profiles.complaints_count + 1,
    updated_at = now()
  RETURNING green_points, complaints_count INTO new_points, new_count;

  -- Determine badge level based on points
  IF new_points >= 500 THEN new_badge := 'diamond';
  ELSIF new_points >= 300 THEN new_badge := 'platinum';
  ELSIF new_points >= 150 THEN new_badge := 'gold';
  ELSIF new_points >= 50 THEN new_badge := 'silver';
  ELSE new_badge := 'bronze';
  END IF;

  -- Update badge
  UPDATE public.profiles SET badge_level = new_badge WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Add unique constraint on user_id if not exists (needed for ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Create trigger
DROP TRIGGER IF EXISTS on_complaint_update_profile ON public.complaints;
CREATE TRIGGER on_complaint_update_profile
  AFTER INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_on_complaint();
