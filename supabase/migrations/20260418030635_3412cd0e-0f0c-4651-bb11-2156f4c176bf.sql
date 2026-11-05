
-- Helper to fully revoke and re-grant only safe columns

-- PROFILES
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, user_id, full_name, avatar_url, badge_level, green_points, complaints_count, created_at, updated_at)
  ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
-- Note: actual row writes still gated by RLS policies

-- COMPLAINTS
REVOKE ALL ON public.complaints FROM anon, authenticated;
GRANT SELECT (id, complaint_id, user_id, title, description, category, status, priority,
              photo_url, location, latitude, longitude, anonymous, submitted_by, resolved_at,
              before_photo_url, after_photo_url, ai_summary, created_at, updated_at,
              department_id, sentiment_score, sentiment_label, verification_count, source,
              upvotes, city)
  ON public.complaints TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.complaints TO authenticated;
GRANT INSERT ON public.complaints TO anon; -- whatsapp webhook policy still applies

-- WORKERS
REVOKE ALL ON public.workers FROM anon, authenticated;
GRANT SELECT (id, name, department_id, is_active, created_at) ON public.workers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.workers TO authenticated;

-- DEPARTMENTS
REVOKE ALL ON public.departments FROM anon, authenticated;
GRANT SELECT (id, name, description, head_name, created_at) ON public.departments TO anon;
GRANT SELECT ON public.departments TO authenticated; -- signed-in users see contact_email
GRANT INSERT, UPDATE, DELETE ON public.departments TO authenticated;
