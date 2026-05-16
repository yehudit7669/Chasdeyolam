/*
  # Add Viewer Role to User Role Enum

  ## Changes
  - Add 'viewer' role type to user_role enum for read-only admin access
*/

-- Add viewer role to enum
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'viewer' 
    AND enumtypid = 'user_role'::regtype
  ) THEN
    ALTER TYPE user_role ADD VALUE 'viewer';
  END IF;
END $$;