
-- 1. Multi-city: add city to complaints
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT 'Delhi';
CREATE INDEX IF NOT EXISTS idx_complaints_city ON public.complaints(city);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);

-- 2. Admin city scoping
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS city text;
CREATE INDEX IF NOT EXISTS idx_user_roles_city ON public.user_roles(city);

-- Helper function: get cities an admin manages (NULL or empty array = all cities)
CREATE OR REPLACE FUNCTION public.admin_cities(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(city) FILTER (WHERE city IS NOT NULL)
  FROM public.user_roles
  WHERE user_id = _user_id AND role = 'admin'
$$;

-- Helper: check if admin can manage a complaint's city
CREATE OR REPLACE FUNCTION public.admin_can_manage_city(_user_id uuid, _city text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND (city IS NULL OR city = _city)
  )
$$;

-- Replace admin update/delete policies on complaints with city-scoped versions
DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can delete complaints" ON public.complaints;

CREATE POLICY "Admins can update complaints in their city"
ON public.complaints
FOR UPDATE
TO authenticated
USING (public.admin_can_manage_city(auth.uid(), city))
WITH CHECK (public.admin_can_manage_city(auth.uid(), city));

CREATE POLICY "Admins can delete complaints in their city"
ON public.complaints
FOR DELETE
TO authenticated
USING (public.admin_can_manage_city(auth.uid(), city));

-- 3. SMS opt-in on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false;

-- 4. SMS log
CREATE TABLE IF NOT EXISTS public.sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'simulated',
  provider text NOT NULL DEFAULT 'simulated',
  complaint_id uuid REFERENCES public.complaints(id) ON DELETE SET NULL,
  user_id uuid,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all SMS logs"
ON public.sms_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own SMS logs"
ON public.sms_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert SMS logs"
ON public.sms_log
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sms_log_created_at ON public.sms_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_log_user ON public.sms_log(user_id);
