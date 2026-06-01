/*
  # Add Nedarim Payment History Table

  1. New Tables
    - `nedarim_payment_history`
      - `id` (uuid, PK)
      - `subscription_id` (uuid, FK → subscriptions)
      - `keva_id` (text) — Nedarim standing order ID
      - `charge_date` (date) — date of charge
      - `amount` (numeric) — charge amount in ILS
      - `status` (text) — 'success' | 'failed' | 'canceled'
      - `transaction_id` (text) — Nedarim transaction ID if available
      - `raw_data` (jsonb) — full raw record from Nedarim HistoryData
      - `synced_at` (timestamptz) — when this record was last synced
      - UNIQUE (subscription_id, charge_date, status) to prevent duplicates

  2. New Columns on subscriptions
    - `nedarim_last_synced_at` (timestamptz) — last successful sync timestamp
    - `nedarim_raw_status` (text) — raw status string from Nedarim last sync

  3. Security
    - RLS on nedarim_payment_history
    - Donors can read their own records
    - Admins can read/insert all
*/

-- Payment history table
CREATE TABLE IF NOT EXISTS nedarim_payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  keva_id text NOT NULL,
  charge_date date,
  amount numeric(10,2),
  status text NOT NULL DEFAULT 'success',
  transaction_id text,
  raw_data jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate history records per subscription per date per status
CREATE UNIQUE INDEX IF NOT EXISTS nedarim_payment_history_unique
  ON nedarim_payment_history(subscription_id, charge_date, status)
  WHERE charge_date IS NOT NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS nedarim_payment_history_sub_idx ON nedarim_payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS nedarim_payment_history_keva_idx ON nedarim_payment_history(keva_id);

-- Add sync tracking columns to subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'nedarim_last_synced_at'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN nedarim_last_synced_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'nedarim_raw_status'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN nedarim_raw_status text;
  END IF;
END $$;

-- RLS
ALTER TABLE nedarim_payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donors can read own payment history"
  ON nedarim_payment_history FOR SELECT
  TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all payment history"
  ON nedarim_payment_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','viewer')
    )
  );

CREATE POLICY "Admins can insert payment history"
  ON nedarim_payment_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
