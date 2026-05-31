/*
  # Add terms acceptance fields to profiles

  ## Summary
  Adds two columns to the profiles table to track when (and whether) a user
  has accepted the terms of service and donation policy.

  ## Changes to profiles table
  - `terms_accepted` (boolean, default false) — has the user accepted terms
  - `terms_accepted_at` (timestamptz, nullable) — exact moment of acceptance

  ## Security
  - Authenticated users can update their own terms_accepted fields
  - Admins can read all profiles (existing policy covers this)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'terms_accepted'
  ) THEN
    ALTER TABLE profiles ADD COLUMN terms_accepted boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'terms_accepted_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN terms_accepted_at timestamptz;
  END IF;
END $$;
