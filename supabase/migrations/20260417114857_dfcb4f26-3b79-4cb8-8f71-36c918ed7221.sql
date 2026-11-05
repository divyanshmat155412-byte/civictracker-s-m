CREATE UNIQUE INDEX IF NOT EXISTS complaint_verifications_unique_user_per_complaint
ON public.complaint_verifications (complaint_id, user_id);

CREATE OR REPLACE FUNCTION public.sync_complaint_verification_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.complaints
    SET verification_count = COALESCE(verification_count, 0) + 1,
        updated_at = now()
    WHERE id = NEW.complaint_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.complaints
    SET verification_count = GREATEST(COALESCE(verification_count, 0) - 1, 0),
        updated_at = now()
    WHERE id = OLD.complaint_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS complaint_verifications_sync_count ON public.complaint_verifications;
CREATE TRIGGER complaint_verifications_sync_count
AFTER INSERT OR DELETE ON public.complaint_verifications
FOR EACH ROW
EXECUTE FUNCTION public.sync_complaint_verification_count();

UPDATE public.complaints c
SET verification_count = v.total,
    updated_at = now()
FROM (
  SELECT complaint_id, COUNT(*)::integer AS total
  FROM public.complaint_verifications
  GROUP BY complaint_id
) v
WHERE c.id = v.complaint_id;

UPDATE public.complaints
SET verification_count = 0,
    updated_at = now()
WHERE id NOT IN (
  SELECT DISTINCT complaint_id FROM public.complaint_verifications
)
AND COALESCE(verification_count, 0) <> 0;