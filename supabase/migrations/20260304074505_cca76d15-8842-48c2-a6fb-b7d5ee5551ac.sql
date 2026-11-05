-- Remove the 1-year retention trigger so admins can delete any complaint
DROP TRIGGER IF EXISTS enforce_complaint_retention ON public.complaints;
DROP FUNCTION IF EXISTS public.prevent_complaint_deletion_before_one_year();