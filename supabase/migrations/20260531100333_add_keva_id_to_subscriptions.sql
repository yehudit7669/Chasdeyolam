/*
  # Add keva_id to subscriptions table

  ## Summary
  Adds a `keva_id` column to the subscriptions table so that the Nedarim Plus standing order
  ID is directly accessible without requiring a JOIN to nedarim_keva_callbacks.
  Also backfills from existing callback records.

  ## Changes
  - `subscriptions.keva_id` (text, nullable) — the KevaId from Nedarim Plus for this subscription
  - Index on keva_id for fast lookup
  - Backfill from most recent nedarim_keva_callbacks record per subscription
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'keva_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN keva_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_keva_id ON subscriptions(keva_id) WHERE keva_id IS NOT NULL;

-- Backfill keva_id from most recent nedarim_keva_callbacks per subscription
UPDATE subscriptions s
SET keva_id = nkc.keva_id
FROM (
  SELECT DISTINCT ON (subscription_id) subscription_id, keva_id
  FROM nedarim_keva_callbacks
  WHERE keva_id IS NOT NULL AND subscription_id IS NOT NULL
  ORDER BY subscription_id, received_at DESC
) nkc
WHERE s.id = nkc.subscription_id
  AND s.keva_id IS NULL;
