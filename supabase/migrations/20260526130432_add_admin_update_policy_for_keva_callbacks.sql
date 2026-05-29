/*
  # Add admin UPDATE policy for nedarim_keva_callbacks

  ## Summary
  Admins could read unmatched callbacks but had no UPDATE policy, so marking
  a callback as resolved or ignored silently failed with a permissions error.

  ## Changes
  - Add UPDATE policy: admins can update review_status, resolved_by,
    resolved_at, resolution_note, and assigned_user_id on any callback row.

  ## Security
  - Restricted to authenticated users whose profile has role = 'admin'
  - USING and WITH CHECK both require admin role
*/

CREATE POLICY "Admins can update keva callback review status"
  ON nedarim_keva_callbacks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
