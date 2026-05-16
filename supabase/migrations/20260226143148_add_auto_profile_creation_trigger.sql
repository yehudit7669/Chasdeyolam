/*
  # Add Automatic Profile Creation Trigger

  ## Problem
  When users sign up, no profile is created automatically in the profiles table.
  This causes "Cannot coerce the result to a single JSON object" error when
  trying to load non-existent profiles.

  ## Solution
  1. Create function that automatically creates a profile when user signs up
  2. Add trigger on auth.users that calls this function
  3. Create missing profiles for existing users (default role: donor)

  ## Security
  - Function uses SECURITY DEFINER to bypass RLS during profile creation
  - Only creates profile with user's own ID and email
*/

-- Function to create profile automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    'donor',
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, ignore
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create missing profiles for existing users
INSERT INTO public.profiles (id, email, role, full_name)
SELECT 
  u.id,
  u.email,
  'donor',
  COALESCE(u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;