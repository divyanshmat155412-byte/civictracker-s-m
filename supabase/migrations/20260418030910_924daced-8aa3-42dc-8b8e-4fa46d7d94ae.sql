
DROP POLICY IF EXISTS "Locations publicly viewable" ON public.worker_locations;
CREATE POLICY "Admins view worker locations"
ON public.worker_locations FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
