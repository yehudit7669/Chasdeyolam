/*
  # Fix delete_user_cascade: handle all NO ACTION FK constraints

  ## Problem
  subscriptions.user_id → profiles.id has ON DELETE CASCADE.
  When the profile is deleted, Postgres auto-deletes all subscriptions for that user.
  But subscription_actions.subscription_id → subscriptions.id is NO ACTION (no cascade),
  so the cascade delete of subscriptions fails with a FK violation.

  Similarly, bookings.subscription_id → subscriptions.id is NO ACTION.

  ## Fix
  Before deleting the profile, explicitly handle every NO ACTION FK that blocks the
  cascade chain:
    1. Nullify subscription_actions.subscription_id for the user's subscriptions
       (preserve audit history but unlink from the subscription row).
    2. Nullify bookings.subscription_id for the user's subscriptions
       (booking records are kept for historical reference).
  These two steps unblock the cascade, so the profile delete cleanly removes
  the subscriptions via the existing CASCADE rule.

  All other children of subscriptions already have SET NULL or CASCADE:
    - nedarim_donation_callbacks  → SET NULL
    - nedarim_keva_callbacks       → SET NULL
    - nedarim_payment_history      → CASCADE
    - payments                     → CASCADE
    - subscription_audit_log       → CASCADE
    - support_threads.linked_sub   → SET NULL
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
  -- Determine who is performing the action
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

  -- ── Step 1: Handle children of subscriptions that are NO ACTION ──────────
  -- Must be done before deleting the profile, because profile delete cascades
  -- to subscriptions, and these tables would block that cascade.

  -- Nullify subscription_actions.subscription_id for this user's subscriptions
  -- (NO ACTION FK — blocks cascade; nullify to preserve audit trail)
  UPDATE public.subscription_actions
  SET subscription_id = NULL
  WHERE subscription_id IN (
    SELECT id FROM public.subscriptions WHERE user_id = target_user_id
  );

  -- Nullify bookings.subscription_id for this user's subscriptions
  -- (NO ACTION FK — blocks cascade; nullify to preserve booking history)
  UPDATE public.bookings
  SET subscription_id = NULL
  WHERE subscription_id IN (
    SELECT id FROM public.subscriptions WHERE user_id = target_user_id
  );

  -- ── Step 2: Handle direct NO ACTION children of profiles ─────────────────

  -- Delete support messages by this user
  DELETE FROM public.support_messages
  WHERE sender_id = target_user_id;

  -- Delete support threads owned by this user
  -- (also clears support_threads.booking_id refs and linked_subscription_id via SET NULL)
  DELETE FROM public.support_threads
  WHERE user_id = target_user_id;

  -- Unlink bookings.user_id (NO ACTION FK; nullified so booking records survive)
  UPDATE public.bookings
  SET user_id = NULL
  WHERE user_id = target_user_id;

  -- Nullify nedarim callback user references (already SET NULL on subscription FK,
  -- but user_id columns are plain nullable with no FK enforcement in some rows)
  UPDATE public.nedarim_donation_callbacks
  SET user_id = NULL
  WHERE user_id = target_user_id;

  UPDATE public.nedarim_keva_callbacks
  SET user_id = NULL
  WHERE user_id = target_user_id;

  UPDATE public.nedarim_keva_callbacks
  SET assigned_user_id = NULL
  WHERE assigned_user_id = target_user_id;

  -- ── Step 3: Delete email logs by recipient email ──────────────────────────
  IF target_email IS NOT NULL THEN
    DELETE FROM public.email_log
    WHERE recipient = target_email;

    DELETE FROM public.email_logs
    WHERE recipient_email = target_email;
  END IF;

  -- ── Step 4: Delete the profile ────────────────────────────────────────────
  -- This triggers ON DELETE CASCADE to subscriptions, which in turn cascades to:
  --   payments (CASCADE), nedarim_payment_history (CASCADE),
  --   subscription_audit_log (CASCADE)
  -- And SET NULL on:
  --   nedarim_donation_callbacks.subscription_id,
  --   nedarim_keva_callbacks.subscription_id,
  --   support_threads.linked_subscription_id
  -- subscription_actions and bookings.subscription_id are already nullified above.
  DELETE FROM public.profiles
  WHERE id = target_user_id;

  -- ── Step 5: Delete the auth user ─────────────────────────────────────────
  DELETE FROM auth.users
  WHERE id = target_user_id;
END;
$$;

-- Restore grants
REVOKE ALL ON FUNCTION public.delete_user_cascade(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(uuid, uuid) TO service_role;
