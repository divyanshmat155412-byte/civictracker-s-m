REVOKE EXECUTE ON FUNCTION public.is_main_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_main_admin() TO authenticated;