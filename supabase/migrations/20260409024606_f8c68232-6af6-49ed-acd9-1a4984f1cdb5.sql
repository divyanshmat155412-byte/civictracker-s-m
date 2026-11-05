
DROP POLICY "System can insert user achievements" ON public.user_achievements;

CREATE POLICY "Only authenticated can insert achievements"
  ON public.user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
