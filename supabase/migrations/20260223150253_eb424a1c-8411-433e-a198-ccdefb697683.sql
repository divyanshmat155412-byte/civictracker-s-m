
-- Drop the overly permissive policy
DROP POLICY "Authenticated users can insert notifications" ON public.notifications;

-- Replace with authenticated-only policy
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
