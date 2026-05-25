/*
  # Add next_payment_date to subscriptions

  ## Summary
  Adds a `next_payment_date` column to the `subscriptions` table so that the
  next scheduled charge date (received from the Nedarim Plus keva callback as
  `NextDate`) can be persisted directly on the subscription row and displayed
  in both the donor dashboard and admin panels — even before the first payment
  has been charged.

  ## Changes
  - `subscriptions.next_payment_date` (timestamptz, nullable) — the next
    scheduled charge date as reported by Nedarim Plus. Populated by the
    nedarim-keva-callback edge function and updated by nedarim-payment-callback
    on each subsequent charge.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'next_payment_date'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN next_payment_date timestamptz DEFAULT NULL;
  END IF;
END $$;
