
DROP POLICY IF EXISTS "Authenticated can insert SMS logs" ON public.sms_log;

CREATE POLICY "Admins can insert SMS logs"
ON public.sms_log
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
