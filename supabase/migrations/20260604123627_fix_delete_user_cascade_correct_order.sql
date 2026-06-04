/*
  # Fix delete_user_cascade: correct explicit deletion order

  ## Problem
  Two FK constraints block the cascade chain when a profile is deleted:

  1. profiles → (CASCADE) → subscriptions → (NO ACTION) → subscription_actions
     subscription_actions.subscription_id is NOT NULL and the FK has NO ACTION,
     so Postgres refuses to delete the subscription row while actions reference it.
     Setting it to NULL is also impossible because the column is NOT NULL.
     The only valid option is to DELETE the rows first.

  2. profiles → (CASCADE) → subscriptions → (NO ACTION) → bookings
     bookings.subscription_id is NOT NULL and the FK has NO ACTION.
     Same situation — must DELETE the booking rows before the subscription is deleted.
     Before deleting bookings we must also nullify support_threads.booking_id
     (that FK is also NO ACTION, but booking_id IS nullable there).

  ## Complete blocking chain resolved by this function:

  Step 1  DELETE subscription_actions  WHERE subscription_id IN user's subscriptions
  Step 2  Nullify support_threads.booking_id for user's bookings (nullable col, must clear before deleting bookings)
  Step 3  DELETE bookings              WHERE subscription_id IN user's subscriptions
  Step 4  Nullify bookings.user_id     for any remaining bookings (no subscription, but user_id might still point here)
  Step 5  DELETE support_messages      WHERE sender_id = user   (NOT NULL col, NO ACTION FK → must delete)
  Step 6  DELETE support_threads       WHERE user_id = user     (NOT NULL col, NO ACTION FK → must delete;
                                                                  cascades to any remaining support_messages)
  Step 7  Nullify nedarim user refs
  Step 8  Delete email logs by email
  Step 9  DELETE profiles              → CASCADE → subscriptions → payments (CASCADE)
                                                                 → nedarim_payment_history (CASCADE)
                                                                 → subscription_audit_log (CASCADE)
                                                                 → nedarim callbacks (SET NULL)
                                                                 → support_threads.linked_subscription_id (SET NULL)
                                       → SET NULL on subscriptions.canceled_by
                                       → SET NULL on subscription_audit_log.*
  Step 10 DELETE auth.users
*/

CREATE OR REPLACE FUNCTION public.delete_user_cascade(
  target_user_id    uuid,
  performing_admin_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    uuid;
  caller_role  text;
  target_email text;
BEGIN
  -- Determine caller: explicit param (service-role call from edge fn) or session uid
  caller_id := COALESCE(performing_admin_id, auth.uid());

  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = caller_id;

  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Capture email before anything is deleted
  SELECT email INTO target_email
  FROM public.profiles
  WHERE id = target_user_id;

  -- ── Step 1: subscription_actions ─────────────────────────────────────────
  -- subscription_id is NOT NULL + NO ACTION → DELETE rows (cannot nullify)
  DELETE FROM public.subscription_actions
  WHERE subscription_id IN (
    SELECT id FROM public.subscriptions WHERE user_id = target_user_id
  );

  -- ── Step 2: bookings (via subscription) ──────────────────────────────────
  -- First nullify support_threads.booking_id that point to these bookings
  -- (booking_id IS nullable; FK is NO ACTION so must clear before deleting bookings)
  UPDATE public.support_threads
  SET booking_id = NULL
  WHERE booking_id IN (
    SELECT b.id FROM public.bookings b
    JOIN public.subscriptions s ON s.id = b.subscription_id
    WHERE s.user_id = target_user_id
  );

  -- Now delete the bookings themselves
  -- (subscription_id NOT NULL + NO ACTION → must delete; cannot survive without subscription)
  DELETE FROM public.bookings
  WHERE subscription_id IN (
    SELECT id FROM public.subscriptions WHERE user_id = target_user_id
  );

  -- ── Step 3: remaining bookings.user_id ───────────────────────────────────
  -- Any bookings that have user_id set but no subscription from this user
  -- (user_id IS nullable, FK is NO ACTION → nullify)
  UPDATE public.bookings
  SET user_id = NULL
  WHERE user_id = target_user_id;

  -- ── Step 4: support_messages (direct sender) ─────────────────────────────
  -- sender_id NOT NULL + NO ACTION → DELETE rows
  DELETE FROM public.support_messages
  WHERE sender_id = target_user_id;

  -- ── Step 5: support_threads ───────────────────────────────────────────────
  -- user_id NOT NULL + NO ACTION → DELETE rows
  -- Cascades automatically to any remaining support_messages (admin replies etc.)
  DELETE FROM public.support_threads
  WHERE user_id = target_user_id;

  -- ── Step 6: nedarim user references (all nullable columns) ───────────────
  UPDATE public.nedarim_donation_callbacks
  SET user_id = NULL
  WHERE user_id = target_user_id;

  UPDATE public.nedarim_keva_callbacks
  SET user_id = NULL
  WHERE user_id = target_user_id;

  UPDATE public.nedarim_keva_callbacks
  SET assigned_user_id = NULL
  WHERE assigned_user_id = target_user_id;

  -- ── Step 7: email logs ────────────────────────────────────────────────────
  IF target_email IS NOT NULL THEN
    DELETE FROM public.email_log   WHERE recipient       = target_email;
    DELETE FROM public.email_logs  WHERE recipient_email = target_email;
  END IF;

  -- ── Step 8: DELETE profile ────────────────────────────────────────────────
  -- Triggers CASCADE to subscriptions, which then CASCADE to:
  --   payments, nedarim_payment_history, subscription_audit_log
  -- SET NULL on:
  --   subscriptions.canceled_by, subscription_audit_log.*, nedarim callbacks.subscription_id,
  --   support_threads.linked_subscription_id
  -- All NO ACTION blockers above have been cleared in steps 1–3.
  DELETE FROM public.profiles
  WHERE id = target_user_id;

  -- ── Step 9: DELETE auth user ──────────────────────────────────────────────
  DELETE FROM auth.users
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_cascade(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(uuid, uuid) TO service_role;
