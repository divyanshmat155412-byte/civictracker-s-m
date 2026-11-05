-- Insert main admin role, bypassing RLS
INSERT INTO public.user_roles (user_id, role) 
VALUES ('b143afcf-9551-4cbe-825d-6c7a523bd6c7', 'admin') 
ON CONFLICT (user_id, role) DO NOTHING;