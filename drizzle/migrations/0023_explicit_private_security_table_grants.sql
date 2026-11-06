-- Platform default privileges exist in this database; explicitly remove unused access.
REVOKE ALL ON public.point_reward_events FROM anon,authenticated;
REVOKE ALL ON SEQUENCE public.point_reward_events_id_seq FROM anon,authenticated;
REVOKE ALL ON public.worker_role_requests FROM anon,authenticated;
GRANT SELECT ON public.worker_role_requests TO authenticated;
GRANT ALL ON public.worker_role_requests,public.point_reward_events TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.point_reward_events_id_seq TO service_role;
