
-- Allow authenticated users to insert notifications (for complaint submissions)
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Trigger function: create notification when complaint is inserted
CREATE OR REPLACE FUNCTION public.notify_new_complaint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (title, body, complaint_id, type)
  VALUES (
    '🚨 New Complaint: ' || NEW.title,
    NEW.category || ' issue reported at ' || NEW.location || '. ' || LEFT(NEW.description, 100),
    NEW.id,
    'new_complaint'
  );
  RETURN NEW;
END;
$$;

-- Trigger function: create notification when complaint status is updated
CREATE OR REPLACE FUNCTION public.notify_complaint_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (title, body, complaint_id, type)
    VALUES (
      '✅ Update: ' || NEW.title,
      'Status changed to ' || NEW.status || ' at ' || NEW.location,
      NEW.id,
      'complaint_update'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER on_new_complaint_notify
  AFTER INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_complaint();

CREATE TRIGGER on_complaint_update_notify
  AFTER UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_complaint_update();
