/*
  # Remove All Problematic Policies - Final Fix

  ## Problem
  Still have "Admins can insert profiles" policy that uses get_my_role()
  causing recursion.

  ## Solution
  Drop ALL policies that use get_my_role() and keep only simple ones.
*/

-- Drop the problematic admin insert policy
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;

-- Verify we only have simple policies left
-- Users read own profile (already exists)
-- Users update own profile (already exists)
-- Users insert own profile (already exists)