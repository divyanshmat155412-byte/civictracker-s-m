-- Restore SELECT on safe columns of complaints/profiles/workers/departments
-- whatsapp_number and phone columns remain revoked (use security definer RPCs)

GRANT SELECT (
  id, complaint_id, user_id, title, description, category, status, priority,
  photo_url, location, latitude, longitude, anonymous, submitted_by,
  resolved_at, before_photo_url, after_photo_url, ai_summary,
  created_at, updated_at, department_id, sentiment_score, sentiment_label,
  verification_count, source, upvotes, city
) ON public.complaints TO anon, authenticated;

GRANT SELECT (
  id, user_id, full_name, avatar_url, badge_level, green_points,
  complaints_count, created_at, updated_at
) ON public.profiles TO anon, authenticated;

GRANT SELECT (
  id, name, department_id, is_active, created_at
) ON public.workers TO anon, authenticated;

GRANT SELECT (
  id, name, description, head_name, created_at
) ON public.departments TO anon, authenticated;