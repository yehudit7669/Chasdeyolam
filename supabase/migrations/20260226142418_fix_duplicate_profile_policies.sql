/*
  # Fix Duplicate Profile Results

  ## Problem
  Multiple policies allow reading the same profile row, causing "Cannot coerce to single JSON object" error.
  For example, an admin can read their own profile through both:
  - "Users can read own profile" (id = auth.uid())
  - "Admins can read all profiles" (role = admin)

  ## Solution
  Make policies mutually exclusive by checking that the higher-privilege policies
  only apply when NOT reading own profile.

  ## Changes
  1. Drop all existing SELECT policies
  2. Create new mutually exclusive policies
*/

-- Drop all existing SELECT policies on profiles
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Viewers can read all profiles" ON profiles;

-- Users can read their own profile (including admins/viewers reading their own)
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admins can read OTHER profiles (not their own, which is handled above)
CREATE POLICY "Admins can read other profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id != auth.uid() 
    AND public.get_my_role() = 'admin'
  );

-- Viewers can read OTHER profiles (not their own, which is handled above)
CREATE POLICY "Viewers can read other profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id != auth.uid()
    AND public.get_my_role() = 'viewer'
  );