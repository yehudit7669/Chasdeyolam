/*
  # Fix RLS Infinite Recursion - Complete Solution

  ## Problem
  The get_my_role() function creates infinite recursion because it queries
  the profiles table, which triggers RLS policies, which call get_my_role()...

  ## Solution
  Replace all policies with simple, direct checks that don't call functions
  which query the same table. Use only built-in auth functions.

  ## Changes
  1. Drop all problematic policies
  2. Create single, simple policy for reading own profile only
  3. Admins/Viewers will read their own profile like regular users
  4. For admin panels, check role AFTER loading profile in application code
*/

-- Drop ALL existing policies on profiles
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read other profiles" ON profiles;
DROP POLICY IF EXISTS "Viewers can read other profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Single policy: users can ONLY read their own profile
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can insert their own profile during signup
CREATE POLICY "Users insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());