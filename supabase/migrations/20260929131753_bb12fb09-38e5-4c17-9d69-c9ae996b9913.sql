DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, user_id, full_name, avatar_url, badge_level, green_points, complaints_count, created_at, updated_at, home_city) ON public.profiles TO anon, authenticated;

REVOKE SELECT ON public.complaints FROM anon, authenticated;
GRANT SELECT (id, complaint_id, user_id, title, description, category, status, priority, photo_url, location, latitude, longitude, anonymous, submitted_by, upvotes, resolved_at, before_photo_url, after_photo_url, ai_summary, created_at, updated_at, department_id, sentiment_score, sentiment_label, verification_count, source, city) ON public.complaints TO anon, authenticated;

REVOKE SELECT ON public.workers FROM anon, authenticated;
GRANT SELECT (id, name, department_id, is_active, created_at) ON public.workers TO anon, authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;