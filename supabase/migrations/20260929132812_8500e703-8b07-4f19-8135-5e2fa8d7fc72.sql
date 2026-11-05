-- Trigger functions and privileged helpers must not be callable by visitors or app users directly.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF r.proname IN (
      'get_poll_results','get_my_profile_contact','update_my_profile_contact','set_my_home_city',
      'redeem_reward','admin_list_known_cities','admin_list_role_assignments','admin_grant_role_by_email',
      'admin_revoke_role_by_email','list_complaints_for_admin_sms','has_role','admin_can_manage_city','admin_cities'
    ) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    ELSE
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

-- Public poll results stay readable for signed-out visitors.
GRANT EXECUTE ON FUNCTION public.get_poll_results(uuid) TO anon;