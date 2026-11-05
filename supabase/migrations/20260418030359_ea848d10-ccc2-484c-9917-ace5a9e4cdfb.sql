
-- 1. Restrict notifications INSERT to admins only (server triggers run as SECURITY DEFINER)
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

-- 2. Restrict timeline INSERT to admins only
DROP POLICY IF EXISTS "Authenticated users can add timeline entries" ON public.complaint_timeline;

-- 3. Workers: hide phone column from public/authenticated
REVOKE SELECT (phone) ON public.workers FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_worker_phone(_worker_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone
  FROM public.workers
  WHERE id = _worker_id
    AND public.has_role(auth.uid(), 'admin')
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_worker_phone(uuid) TO authenticated;

-- 4. Poll votes: tighten SELECT (owner + admin only) and add aggregate function for public results
DROP POLICY IF EXISTS "Poll votes publicly viewable" ON public.poll_votes;

CREATE POLICY "Users see their own votes"
ON public.poll_votes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins see all votes"
ON public.poll_votes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Public-safe aggregate counts so poll results pages keep working
CREATE OR REPLACE FUNCTION public.get_poll_results(_poll_id uuid)
RETURNS TABLE(option_id uuid, vote_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT option_id, COUNT(*)::bigint AS vote_count
  FROM public.poll_votes
  WHERE poll_id = _poll_id
  GROUP BY option_id
$$;

GRANT EXECUTE ON FUNCTION public.get_poll_results(uuid) TO anon, authenticated;

-- 5. Departments: hide contact_email from anon
REVOKE SELECT (contact_email) ON public.departments FROM anon;
