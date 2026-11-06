-- Complaint ownership is deliberately not a SELECT-granted column; check it inside a narrow non-disclosing helper.
CREATE FUNCTION public.can_read_complaint_notification(_complaint_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.complaints c WHERE c.id=_complaint_id AND (c.user_id=auth.uid() OR public.admin_can_manage_city(auth.uid(),c.city))) $$;
REVOKE ALL ON FUNCTION public.can_read_complaint_notification(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_complaint_notification(uuid) TO authenticated;
DROP POLICY "Complaint notification owner or city staff" ON public.notifications;
CREATE POLICY "Complaint notification owner or city staff" ON public.notifications FOR SELECT TO authenticated USING(public.can_read_complaint_notification(complaint_id));
