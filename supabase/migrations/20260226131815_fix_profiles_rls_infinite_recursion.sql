/*
  # Fix Infinite Recursion in Profiles RLS Policy

  1. Changes
    - Drop the problematic "Admins can read all profiles" policy that causes infinite recursion
    - Keep the simple "Users can read own profile" policy
    - Keep the "Users can update own profile" policy
  
  2. Security
    - Users can read their own profile (required for the app to work)
    - Users can update their own profile
    - Admins can still read their own profile like everyone else
    - If we need admin access to all profiles, we'll use service role key instead
  
  3. Notes
    - The infinite recursion happened because the admin policy was checking profiles table inside a profiles table policy
    - This is a common RLS pitfall
*/

-- Drop the problematic admin policy
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- The remaining policies are fine:
-- "Users can read own profile" - allows auth.uid() = id
-- "Users can update own profile" - allows auth.uid() = id
