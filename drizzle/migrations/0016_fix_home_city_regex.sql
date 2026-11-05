CREATE OR REPLACE FUNCTION public.set_my_home_city(_city text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_clean text; v_saved text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_clean := NULLIF(btrim(_city), '');
  IF v_clean IS NULL THEN RAISE EXCEPTION 'City is required'; END IF;
  IF length(v_clean) < 2 OR length(v_clean) > 80 THEN RAISE EXCEPTION 'City must be 2 to 80 characters'; END IF;
  IF v_clean !~ '^[[:alpha:]][^[:digit:][:cntrl:]<>@#$%^&*()_+=|\\/:;"?!,~`{}\[\]]*$' THEN
    RAISE EXCEPTION 'City can only contain letters, spaces, hyphens, apostrophes, and dots';
  END IF;
  INSERT INTO public.profiles (user_id, home_city) VALUES (v_uid, v_clean)
  ON CONFLICT (user_id) DO UPDATE SET home_city = EXCLUDED.home_city, updated_at = now()
  RETURNING home_city INTO v_saved;
  RETURN v_saved;
END;
$function$;