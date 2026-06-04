/*
  # Fix delete_user_cascade admin check

  ## Problem
  The Edge Function calls delete_user_cascade via the service role client.
  When running under the service role, auth.uid() returns NULL, so the
  admin check inside the DB function always fails with "Only admins can delete users"
  even when called by a legitimate admin.

  ## Fix
  - Add a `performing_admin_id uuid` parameter to the function.
  - The Edge Function passes the verified admin's user ID explicitly.
  - The DB function checks the role of that ID against profiles, which works
    correctly under the service role because it queries by explicit UUID.
  - Uses SECURITY DEFINER so it can still delete from auth.users.
*/

CREATE OR REPLACE FUNCTION public.delete_user_cascade(
  target_user_id uuid,
  performing_admin_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  caller_role text;
  target_email text;
BEGIN
  -- Determine who is performing the action:
  -- Prefer the explicit parameter (used when called via service-role from edge function).
  -- Fall back to auth.uid() for direct authenticated calls.
  caller_id := COALESCE(performing_admin_id, auth.uid());

  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Verify the caller has the admin role
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = caller_id;

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
      canceled_by = caller_id,
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

-- Restore grants
REVOKE ALL ON FUNCTION public.delete_user_cascade(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(uuid, uuid) TO service_role;
