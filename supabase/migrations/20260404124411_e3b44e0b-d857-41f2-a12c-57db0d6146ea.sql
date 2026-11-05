
-- Comments table
CREATE TABLE public.complaint_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'Anonymous',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.complaint_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are publicly viewable"
  ON public.complaint_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add comments"
  ON public.complaint_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.complaint_comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any comment"
  ON public.complaint_comments FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_comments_complaint ON public.complaint_comments(complaint_id);

-- Ratings table
CREATE TABLE public.complaint_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(complaint_id, user_id)
);

ALTER TABLE public.complaint_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings are publicly viewable"
  ON public.complaint_ratings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can rate"
  ON public.complaint_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rating"
  ON public.complaint_ratings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_ratings_complaint ON public.complaint_ratings(complaint_id);

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaint_comments;
