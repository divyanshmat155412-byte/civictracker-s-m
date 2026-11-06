-- EMERGENCY ROLLBACK ONLY: restores previous weaker protections; requires explicit approval.

-- Does not delete ledger/request rows or touch existing account/complaint/photo data.

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

CREATE OR REPLACE FUNCTION public.admin_link_worker_account(_worker_id uuid, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'moderator') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No account with that email — ask the worker to sign up first'; END IF;
  UPDATE public.workers SET user_id = v_uid WHERE id = _worker_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'field_worker') ON CONFLICT DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.admin_link_worker_account(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_link_worker_account(uuid, text) TO authenticated;

DROP TRIGGER IF EXISTS guard_linked_worker_city ON public.workers;
GRANT INSERT,UPDATE ON public.workers TO authenticated;
DROP POLICY IF EXISTS "Named public leaderboard profiles" ON public.profiles;
DROP POLICY IF EXISTS "Own profile read" ON public.profiles;
CREATE POLICY "Profiles are publicly viewable" ON public.profiles FOR SELECT USING(true);
GRANT SELECT(user_id,home_city,created_at,updated_at) ON public.profiles TO anon;
DROP POLICY IF EXISTS "Assigned worker reads assignments" ON public.worker_assignments;
CREATE POLICY "Assignments publicly viewable" ON public.worker_assignments FOR SELECT USING(true);
GRANT SELECT ON public.worker_assignments TO anon;
DROP POLICY IF EXISTS "Public admin broadcasts only" ON public.notifications;
DROP POLICY IF EXISTS "Complaint notification owner or city staff" ON public.notifications;
CREATE POLICY "Notifications are publicly viewable" ON public.notifications FOR SELECT USING(true);
-- Retain the new RPCs/tables for compatibility and audit history; revoke new worker opt-in writes.
REVOKE EXECUTE ON FUNCTION public.request_field_worker_role(text) FROM authenticated;
-- Roll back corresponding UI changes through Lovable history, not a force-push.
