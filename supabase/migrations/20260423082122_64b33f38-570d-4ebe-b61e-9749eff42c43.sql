DROP FUNCTION IF EXISTS public.admin_list_known_cities();

CREATE OR REPLACE FUNCTION public.admin_list_known_cities()
RETURNS TABLE(city text, source text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_scope text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_scope := public.admin_cities(v_uid);

  RETURN QUERY
  WITH src AS (
    SELECT btrim(c.city) AS city, 'complaints'::text AS source
    FROM public.complaints c
    WHERE c.city IS NOT NULL AND btrim(c.city) <> ''
    UNION ALL
    SELECT btrim(p.home_city) AS city, 'profiles'::text AS source
    FROM public.profiles p
    WHERE p.home_city IS NOT NULL AND btrim(p.home_city) <> ''
  ),
  agg AS (
    SELECT
      s.city,
      bool_or(s.source = 'profiles')   AS in_profiles,
      bool_or(s.source = 'complaints') AS in_complaints
    FROM src s
    WHERE v_scope IS NULL OR s.city = ANY(v_scope)
    GROUP BY s.city
  )
  SELECT
    a.city,
    CASE
      WHEN a.in_profiles AND a.in_complaints THEN 'both'
      WHEN a.in_profiles THEN 'profiles'
      ELSE 'complaints'
    END AS source
  FROM agg a
  ORDER BY a.city;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_known_cities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_known_cities() TO authenticated;