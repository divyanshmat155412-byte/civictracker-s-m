CREATE OR REPLACE FUNCTION public.grant_main_admin_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF lower(NEW.email) = public.main_admin_email() THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::public.app_role) ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'moderator'::public.app_role) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
INSERT INTO public.app_config(key, value) VALUES ('main_admin_email','divyanshmat155412@gmail.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;