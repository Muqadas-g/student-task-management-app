
-- Add new columns to tasks table
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS due_date date;

-- Migrate existing data: map completed to status
UPDATE public.tasks SET status = CASE WHEN completed THEN 'completed' ELSE 'pending' END;

-- Copy deadline to due_date
UPDATE public.tasks SET due_date = deadline::date;

-- Create users/profiles table
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'user',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Admins can view all profiles (using security definer function)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = _user_id AND role = 'admin'
  )
$$;

-- Admins can view all users
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Update tasks RLS: admins can view all tasks
CREATE POLICY "Admins can view all tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admins can delete any task
CREATE POLICY "Admins can delete any task" ON public.tasks
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admins can update any task
CREATE POLICY "Admins can update any task" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Create trigger to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
