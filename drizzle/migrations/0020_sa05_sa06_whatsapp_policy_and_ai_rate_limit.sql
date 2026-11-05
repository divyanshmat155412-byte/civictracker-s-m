-- SA-05: anon direct WhatsApp inserts are unnecessary (webhook uses the server-side privileged connection).
-- Original definition (for rollback):
-- CREATE POLICY "WhatsApp webhook can insert complaints" ON public.complaints AS PERMISSIVE FOR INSERT TO anon WITH CHECK (source = 'whatsapp'::text);
DROP POLICY IF EXISTS "WhatsApp webhook can insert complaints" ON public.complaints;

-- SA-06: shared AI request quota
CREATE TABLE public.api_usage (
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, endpoint, window_start)
);
GRANT ALL ON public.api_usage TO service_role;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
-- No policies: ordinary users cannot read, insert, update or delete usage rows.
CREATE INDEX api_usage_user_window_idx ON public.api_usage (user_id, window_start);

CREATE OR REPLACE FUNCTION public._consume_ai_quota(_uid uuid, _endpoint text, _now timestamptz, _limit integer, _window_seconds integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _win timestamptz;
  _used integer;
  _retry integer;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;
  IF _endpoint IS NULL OR _endpoint !~ '^[a-z0-9-]{1,40}$' THEN
    RAISE EXCEPTION 'invalid endpoint';
  END IF;
  _win := to_timestamp(floor(extract(epoch FROM _now) / _window_seconds) * _window_seconds);
  _retry := GREATEST(1, ceil(extract(epoch FROM (_win + make_interval(secs => _window_seconds) - _now)))::int);
  -- Serialize all requests for this user+window so concurrent calls cannot overshoot.
  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text || '|' || _win::text, 0));
  SELECT COALESCE(SUM(request_count), 0) INTO _used FROM public.api_usage WHERE user_id = _uid AND window_start = _win;
  IF _used >= _limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', _used, 'limit', _limit, 'retry_after', _retry);
  END IF;
  INSERT INTO public.api_usage (user_id, endpoint, window_start, request_count)
  VALUES (_uid, _endpoint, _win, 1)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET request_count = public.api_usage.request_count + 1, updated_at = now();
  RETURN jsonb_build_object('allowed', true, 'used', _used + 1, 'limit', _limit, 'retry_after', _retry);
END $$;
REVOKE ALL ON FUNCTION public._consume_ai_quota(uuid, text, timestamptz, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._consume_ai_quota(uuid, text, timestamptz, integer, integer) TO service_role;

-- Public entry point: identity always comes from the verified session; limit is fixed server-side.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(_endpoint text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public._consume_ai_quota(auth.uid(), _endpoint, now(), 30, 600);
$$;
REVOKE ALL ON FUNCTION public.consume_ai_quota(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text) TO authenticated, service_role;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.consume_ai_quota(text);
-- DROP FUNCTION IF EXISTS public._consume_ai_quota(uuid, text, timestamptz, integer, integer);
-- DROP TABLE IF EXISTS public.api_usage;
-- CREATE POLICY "WhatsApp webhook can insert complaints" ON public.complaints AS PERMISSIVE FOR INSERT TO anon WITH CHECK (source = 'whatsapp'::text);