/*
  # Add Public Access to Plans and Hotels

  1. Changes
    - Add policy to allow anonymous users to view active plans
    - Add policy to allow anonymous users to view active hotels
    - This enables the plan selection page to work for non-registered users

  2. Security
    - Anonymous users can only SELECT (read) data
    - Only active plans and hotels are visible
    - No write permissions for anonymous users
*/

-- Allow anonymous users to view active plans
CREATE POLICY "Anonymous users can view active plans"
  ON plans
  FOR SELECT
  TO anon
  USING (active = true);

-- Allow anonymous users to view active hotels
CREATE POLICY "Anonymous users can view active hotels"
  ON hotels
  FOR SELECT
  TO anon
  USING (active = true);
