-- D2: moving a linked worker must not bypass same-city consent/role checks.
CREATE FUNCTION public.guard_linked_worker_city() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.user_id IS NOT NULL AND NEW.city IS DISTINCT FROM OLD.city THEN RAISE EXCEPTION 'Linked worker city cannot be changed'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_linked_worker_city() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_linked_worker_city() TO service_role;
CREATE TRIGGER guard_linked_worker_city BEFORE UPDATE OF city ON public.workers FOR EACH ROW EXECUTE FUNCTION public.guard_linked_worker_city();
