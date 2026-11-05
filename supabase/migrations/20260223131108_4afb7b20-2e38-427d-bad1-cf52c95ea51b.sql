
-- Allow admins to delete admin requests
CREATE POLICY "Admins can delete requests"
ON public.admin_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
