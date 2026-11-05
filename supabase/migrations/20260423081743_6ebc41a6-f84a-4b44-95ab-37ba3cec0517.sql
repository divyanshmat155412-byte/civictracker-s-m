CREATE OR REPLACE FUNCTION public.admin_list_known_cities()
RETURNS TABLE(city text)
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

  -- null => super admin (no scoping); array => scoped to those cities
  v_scope := public.admin_cities(v_uid);

  RETURN QUERY
  WITH all_cities AS (
    SELECT btrim(c.city) AS city
    FROM public.complaints c
    WHERE c.city IS NOT NULL AND btrim(c.city) <> ''
    UNION
    SELECT btrim(p.home_city) AS city
    FROM public.profiles p
    WHERE p.home_city IS NOT NULL AND btrim(p.home_city) <> ''
  )
  SELECT a.city
  FROM all_cities a
  WHERE v_scope IS NULL OR a.city = ANY(v_scope)
  GROUP BY a.city
  ORDER BY a.city;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_known_cities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_known_cities() TO authenticated;