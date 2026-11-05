-- SA-06 v2: true rolling 600-second limit. Fixed-window store/function kept for rollback.
CREATE TABLE public.api_usage_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.api_usage_events TO service_role;
ALTER TABLE public.api_usage_events ENABLE ROW LEVEL SECURITY;
-- No policies: ordinary users cannot read, insert, update or delete usage entries.
CREATE INDEX api_usage_events_user_time_idx ON public.api_usage_events (user_id, created_at);
CREATE INDEX api_usage_events_time_idx ON public.api_usage_events (created_at);

CREATE OR REPLACE FUNCTION public._consume_ai_quota_rolling(_uid uuid, _endpoint text, _now timestamptz, _limit integer, _window_seconds integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _from timestamptz;
  _used integer;
  _oldest timestamptz;
  _retry integer;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;
  IF _endpoint IS NULL OR _endpoint !~ '^[a-z0-9-]{1,40}$' THEN
    RAISE EXCEPTION 'invalid endpoint';
  END IF;
  -- Serialize this user's requests so concurrent calls cannot overshoot.
  PERFORM pg_advisory_xact_lock(hashtextextended('ai-quota|' || _uid::text, 0));
  -- Automatic cleanup: drop entries older than 24 hours (this user, plus a bounded global batch).
  DELETE FROM public.api_usage_events WHERE user_id = _uid AND created_at < now() - interval '24 hours';
  DELETE FROM public.api_usage_events WHERE id IN (
    SELECT id FROM public.api_usage_events WHERE created_at < now() - interval '24 hours' LIMIT 500);
  -- Inclusive window: a request exactly _window_seconds after the oldest one is still counted.
  _from := _now - make_interval(secs => _window_seconds);
  SELECT count(*), min(created_at) INTO _used, _oldest
    FROM public.api_usage_events WHERE user_id = _uid AND created_at >= _from AND created_at <= _now;
  IF _used >= _limit THEN
    -- Earliest allowed moment is strictly after oldest + window; round up to whole seconds.
    _retry := GREATEST(1, floor(extract(epoch FROM (_oldest + make_interval(secs => _window_seconds) - _now)))::int + 1);
    RETURN jsonb_build_object('allowed', false, 'used', _used, 'limit', _limit, 'retry_after', _retry);
  END IF;
  INSERT INTO public.api_usage_events (user_id, endpoint, created_at) VALUES (_uid, _endpoint, _now);
  RETURN jsonb_build_object('allowed', true, 'used', _used + 1, 'limit', _limit, 'retry_after', 0);
END $$;
REVOKE ALL ON FUNCTION public._consume_ai_quota_rolling(uuid, text, timestamptz, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._consume_ai_quota_rolling(uuid, text, timestamptz, integer, integer) TO service_role;

-- Same public entry point name; now rolling. Identity from verified session, limit fixed server-side.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(_endpoint text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public._consume_ai_quota_rolling(auth.uid(), _endpoint, clock_timestamp(), 30, 600);
$$;
REVOKE ALL ON FUNCTION public.consume_ai_quota(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text) TO authenticated, service_role;

COMMENT ON TABLE public.api_usage IS 'DEPRECATED: replaced by api_usage_events (rolling window). Kept for rollback.';
COMMENT ON FUNCTION public._consume_ai_quota(uuid, text, timestamptz, integer, integer) IS 'DEPRECATED: fixed-window quota, replaced by _consume_ai_quota_rolling. Kept for rollback.';

-- Rollback:
-- CREATE OR REPLACE FUNCTION public.consume_ai_quota(_endpoint text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $f$ SELECT public._consume_ai_quota(auth.uid(), _endpoint, now(), 30, 600); $f$;
-- DROP FUNCTION IF EXISTS public._consume_ai_quota_rolling(uuid, text, timestamptz, integer, integer);
-- DROP TABLE IF EXISTS public.api_usage_events;