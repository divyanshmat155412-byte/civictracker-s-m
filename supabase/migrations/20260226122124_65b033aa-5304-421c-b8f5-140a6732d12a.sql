
-- Allow admins to delete complaints
CREATE POLICY "Admins can delete complaints"
ON public.complaints
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Prevent deletion of complaints less than 1 year old
CREATE OR REPLACE FUNCTION public.prevent_complaint_deletion_before_one_year()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.created_at > (now() - interval '1 year') THEN
    RAISE EXCEPTION 'Complaints cannot be deleted before 1 year. This complaint was created on %', OLD.created_at::date;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER enforce_complaint_retention
BEFORE DELETE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.prevent_complaint_deletion_before_one_year();
