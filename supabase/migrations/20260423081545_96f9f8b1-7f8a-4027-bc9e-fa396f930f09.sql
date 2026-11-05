-- Grant missing column privileges so authenticated users can read/write their own profile fields
GRANT SELECT (home_city, phone_number, sms_opt_in) ON public.profiles TO anon, authenticated;
GRANT INSERT (user_id, home_city, phone_number, sms_opt_in, full_name, avatar_url) ON public.profiles TO authenticated;
GRANT UPDATE (home_city, phone_number, sms_opt_in, full_name, avatar_url) ON public.profiles TO authenticated;

-- Server-side safeguard: always upserts the row for the current user and returns the saved value.
CREATE OR REPLACE FUNCTION public.set_my_home_city(_city text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean text;
  v_saved text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_clean := NULLIF(btrim(_city), '');
  IF v_clean IS NULL THEN
    RAISE EXCEPTION 'City is required';
  END IF;
  IF length(v_clean) < 2 OR length(v_clean) > 80 THEN
    RAISE EXCEPTION 'City must be 2 to 80 characters';
  END IF;
  IF v_clean !~ '^[\p{L}][\p{L}\s\.''\-]*$' THEN
    RAISE EXCEPTION 'City can only contain letters, spaces, hyphens, apostrophes, and dots';
  END IF;

  INSERT INTO public.profiles (user_id, home_city)
  VALUES (v_uid, v_clean)
  ON CONFLICT (user_id) DO UPDATE
    SET home_city = EXCLUDED.home_city,
        updated_at = now()
  RETURNING home_city INTO v_saved;

  RETURN v_saved;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_home_city(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_home_city(text) TO authenticated;