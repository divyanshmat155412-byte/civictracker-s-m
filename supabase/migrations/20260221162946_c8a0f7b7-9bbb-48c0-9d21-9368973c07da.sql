
-- Make complaint_id have a default so inserts don't require it
ALTER TABLE public.complaints ALTER COLUMN complaint_id SET DEFAULT '';
