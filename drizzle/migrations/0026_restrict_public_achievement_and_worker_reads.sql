DROP POLICY "User achievements are publicly viewable"
  ON public.user_achievements;
REVOKE SELECT ON public.user_achievements FROM PUBLIC, anon;
GRANT SELECT ON public.user_achievements TO authenticated;
CREATE POLICY "Users read own achievement history"
  ON public.user_achievements FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY "Workers publicly viewable" ON public.workers;
CREATE POLICY "Anonymous visitors read active public worker fields"
  ON public.workers FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "Workers and authorized city staff read worker records"
  ON public.workers FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.admin_can_manage_city((SELECT auth.uid()), city)
  );