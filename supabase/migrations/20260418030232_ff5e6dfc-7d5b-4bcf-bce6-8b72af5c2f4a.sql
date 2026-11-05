
-- 1. PROFILES: hide phone_number & sms_opt_in via column-level revokes
REVOKE SELECT (phone_number, sms_opt_in) ON public.profiles FROM anon, authenticated;

-- Owner-accessible secure function
CREATE OR REPLACE FUNCTION public.get_my_profile_contact()
RETURNS TABLE(phone_number text, sms_opt_in boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone_number, sms_opt_in
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile_contact() TO authenticated;

-- Owner can update their own contact info via secure function
CREATE OR REPLACE FUNCTION public.update_my_profile_contact(_phone text, _opt_in boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.profiles
  SET phone_number = NULLIF(trim(_phone), ''),
      sms_opt_in = COALESCE(_opt_in, false),
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_profile_contact(text, boolean) TO authenticated;

-- 2. COMPLAINTS: hide whatsapp_number via column-level revoke
REVOKE SELECT (whatsapp_number) ON public.complaints FROM anon, authenticated;

-- Owner of complaint can read their own whatsapp
CREATE OR REPLACE FUNCTION public.get_complaint_whatsapp(_complaint_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT whatsapp_number
  FROM public.complaints
  WHERE id = _complaint_id
    AND (
      user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    )
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_complaint_whatsapp(uuid) TO authenticated;

-- Admin-only listing for SMS page
CREATE OR REPLACE FUNCTION public.list_complaints_for_admin_sms()
RETURNS TABLE(id uuid, complaint_id text, title text, status text, whatsapp_number text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, complaint_id, title, status, whatsapp_number
  FROM public.complaints
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY created_at DESC
  LIMIT 100
$$;

GRANT EXECUTE ON FUNCTION public.list_complaints_for_admin_sms() TO authenticated;

-- 3. PUSH SUBSCRIPTIONS: drop overly broad SELECT policy.
-- Service role bypasses RLS automatically, so server-side reads still work.
DROP POLICY IF EXISTS "Service role can read all subscriptions" ON public.push_subscriptions;

-- 4. STORAGE: complaint-photos bucket
-- Drop any broad SELECT policy on objects for this bucket and add scoped ones.
-- Public buckets serve files via CDN regardless of RLS; we only restrict listing/management here.

-- Allow public direct object access (needed for image URLs in posts)
DROP POLICY IF EXISTS "complaint-photos public read" ON storage.objects;
CREATE POLICY "complaint-photos public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'complaint-photos');

-- Authenticated users can upload to their own folder (user_id as first path segment)
DROP POLICY IF EXISTS "complaint-photos auth upload" ON storage.objects;
CREATE POLICY "complaint-photos auth upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'complaint-photos'
  AND auth.uid() IS NOT NULL
);

-- Owners and admins can update their own files
DROP POLICY IF EXISTS "complaint-photos owner update" ON storage.objects;
CREATE POLICY "complaint-photos owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'complaint-photos'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

-- Owners and admins can delete their own files
DROP POLICY IF EXISTS "complaint-photos owner delete" ON storage.objects;
CREATE POLICY "complaint-photos owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'complaint-photos'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

-- 5. USER_ACHIEVEMENTS: prevent self-grants. Only triggers (SECURITY DEFINER) may insert.
DROP POLICY IF EXISTS "Only authenticated can insert achievements" ON public.user_achievements;
-- No INSERT policy = no client inserts allowed. The check_achievements() trigger runs as
-- SECURITY DEFINER so it continues to grant achievements server-side.
