-- Citizens may no longer write reward/stat columns directly; triggers and SECURITY DEFINER RPCs still update them.
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, avatar_url, home_city, updated_at) ON public.profiles TO authenticated;
GRANT INSERT (user_id, full_name, avatar_url, home_city) ON public.profiles TO authenticated;