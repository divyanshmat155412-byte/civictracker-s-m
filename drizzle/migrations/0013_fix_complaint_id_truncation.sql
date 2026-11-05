CREATE OR REPLACE FUNCTION public.generate_complaint_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE n text;
BEGIN
  LOOP
    n := nextval('complaint_id_seq')::text;
    NEW.complaint_id := 'CT-' || LPAD(n, GREATEST(2, length(n)), '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.complaints WHERE complaint_id = NEW.complaint_id);
  END LOOP;
  RETURN NEW;
END;
$function$;