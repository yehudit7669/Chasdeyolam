/*
  # Add user deletion support

  ## Summary
  Prepares the schema for safe user deletion by an admin.

  ## Changes

  ### Modified Tables
  - `bookings.user_id`: made nullable (currently NOT NULL) so we can nullify the reference
    before deleting the profile row, preserving booking history.

  ### New Database Function
  - `delete_user_cascade(target_user_id uuid)`: runs as SECURITY DEFINER (service role
    context) and performs the full cascade deletion in a safe order:
    1. Cancel active/frozen subscriptions (status → 'canceled') so no orphan keva records.
    2. Nullify `bookings.user_id` so booking history is kept but unlinked.
    3. Delete `support_messages` sent by the user.
    4. Delete `support_threads` owned by the user.
    5. Nullify `subscription_audit_log` references to the user.
    6. Nullify `subscription_actions` user_id references.
    7. Nullify `nedarim_donation_callbacks.user_id`.
    8. Nullify `nedarim_keva_callbacks.user_id` / `assigned_user_id`.
    9. Delete `email_log` records by recipient email.
    10. Delete `email_logs` records by recipient email.
    11. Delete the `profiles` row.
    12. Delete the `auth.users` row via auth schema (requires service role).

  ## Security
  - Function is restricted to callers whose profile role = 'admin'.
  - All operations run inside a single transaction (implicit in PL/pgSQL).
*/

-- 1. Make bookings.user_id nullable so we can unlink without deleting booking records
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'user_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.bookings ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

-- 2. Create the cascade-delete function (service-role only via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.delete_user_cascade(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  target_email text;
BEGIN
  -- Verify caller is an admin
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Grab the email before we delete the profile
  SELECT email INTO target_email
  FROM public.profiles
  WHERE id = target_user_id;

  -- Cancel active/frozen subscriptions (do NOT delete - preserve history)
  UPDATE public.subscriptions
  SET status = 'canceled',
      canceled_at = now(),
      canceled_by = auth.uid(),
      cancellation_reason = 'user_deleted_by_admin',
      updated_at = now()
  WHERE user_id = target_user_id
    AND status IN ('active', 'frozen');

  -- Unlink bookings (preserve records for audit)
  UPDATE public.bookings
  SET user_id = NULL
  WHERE user_id = target_user_id;

  -- Delete support messages by this user
  DELETE FROM public.support_messages
  WHERE sender_id = target_user_id;

  -- Delete support threads owned by this user
  DELETE FROM public.support_threads
  WHERE user_id = target_user_id;

  -- Nullify audit log references
  UPDATE public.subscription_audit_log
  SET actor_id = NULL
  WHERE actor_id = target_user_id;

  UPDATE public.subscription_audit_log
  SET donor_id = NULL
  WHERE donor_id = target_user_id;

  UPDATE public.subscription_audit_log
  SET performed_by = NULL
  WHERE performed_by = target_user_id;

  -- Nullify subscription_actions references
  UPDATE public.subscription_actions
  SET user_id = NULL
  WHERE user_id = target_user_id;

  -- Nullify nedarim callback references
  UPDATE public.nedarim_donation_callbacks
  SET user_id = NULL
  WHERE user_id = target_user_id;

  UPDATE public.nedarim_keva_callbacks
  SET user_id = NULL
  WHERE user_id = target_user_id;

  UPDATE public.nedarim_keva_callbacks
  SET assigned_user_id = NULL
  WHERE assigned_user_id = target_user_id;

  -- Delete email logs by recipient email (if we found one)
  IF target_email IS NOT NULL THEN
    DELETE FROM public.email_log
    WHERE recipient = target_email;

    DELETE FROM public.email_logs
    WHERE recipient_email = target_email;
  END IF;

  -- Delete the profile row
  DELETE FROM public.profiles
  WHERE id = target_user_id;

  -- Delete the auth user (requires service role)
  DELETE FROM auth.users
  WHERE id = target_user_id;
END;
$$;

-- Grant execute only to authenticated users (the function itself re-checks admin role)
REVOKE ALL ON FUNCTION public.delete_user_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(uuid) TO authenticated;
