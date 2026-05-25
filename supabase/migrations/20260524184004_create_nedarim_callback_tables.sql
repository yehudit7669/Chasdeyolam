/*
  # Nedarim Plus Callback Tables

  Two tables to store all incoming callbacks from Nedarim Plus:

  1. New Tables
    - `nedarim_keva_callbacks`
      - Stores every POST from the recurring (keva) payment endpoint
      - Linked to `subscriptions` when a matching subscriber is found
      - Tracks success/failure, amount, transaction ID, payer details
    - `nedarim_donation_callbacks`
      - Stores every POST from the one-time donation endpoint
      - Standalone record; not linked to subscriptions

  2. Both tables include:
      - `raw_payload` (jsonb) — full original POST body for audit/debugging
      - `processed` (boolean) — whether business logic ran successfully
      - `error_message` (text) — any processing error for ops review

  3. Security
    - RLS enabled on both tables
    - Only admins can read; no public access
    - Service role (used by edge functions) bypasses RLS
*/

-- Nedarim Plus recurring payment callbacks
CREATE TABLE IF NOT EXISTS nedarim_keva_callbacks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nedarim Plus standard fields
  mosad               text,
  zeout               text,           -- transaction/authorization number
  amount              integer,        -- amount in agorot (or ILS integer per NP convention)
  currency            text DEFAULT 'ILS',
  payer_id            text,           -- donor ID in Nedarim Plus system
  payer_name          text,
  payer_email         text,
  payer_phone         text,
  payment_type        text,           -- keva / credit
  payment_num         integer,        -- which payment number in the series
  total_payments      integer,        -- total payments in series
  payment_date        text,           -- date string from NP
  approval_number     text,           -- bank/cc approval number
  card_last4          text,
  status              text,           -- success / failure
  status_code         text,
  -- Internal linkage
  subscription_id     uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  -- Audit
  raw_payload         jsonb NOT NULL,
  processed           boolean DEFAULT false,
  error_message       text,
  received_at         timestamptz DEFAULT now()
);

ALTER TABLE nedarim_keva_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read keva callbacks"
  ON nedarim_keva_callbacks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Nedarim Plus one-time donation callbacks
CREATE TABLE IF NOT EXISTS nedarim_donation_callbacks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nedarim Plus standard fields
  mosad               text,
  zeout               text,
  amount              integer,
  currency            text DEFAULT 'ILS',
  payer_id            text,
  payer_name          text,
  payer_email         text,
  payer_phone         text,
  payment_type        text,
  payment_date        text,
  approval_number     text,
  card_last4          text,
  status              text,
  status_code         text,
  -- Audit
  raw_payload         jsonb NOT NULL,
  processed           boolean DEFAULT false,
  error_message       text,
  received_at         timestamptz DEFAULT now()
);

ALTER TABLE nedarim_donation_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read donation callbacks"
  ON nedarim_donation_callbacks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Index for fast lookup by transaction ID and subscription
CREATE INDEX IF NOT EXISTS idx_keva_callbacks_zeout ON nedarim_keva_callbacks(zeout);
CREATE INDEX IF NOT EXISTS idx_keva_callbacks_subscription ON nedarim_keva_callbacks(subscription_id);
CREATE INDEX IF NOT EXISTS idx_keva_callbacks_payer ON nedarim_keva_callbacks(payer_email);
CREATE INDEX IF NOT EXISTS idx_donation_callbacks_zeout ON nedarim_donation_callbacks(zeout);
CREATE INDEX IF NOT EXISTS idx_donation_callbacks_payer ON nedarim_donation_callbacks(payer_email);
