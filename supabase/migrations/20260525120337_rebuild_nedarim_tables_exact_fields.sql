/*
  # Rebuild Nedarim Plus Callback Tables with Exact Official Field Names

  Drops previous guessed-field tables and recreates them using the exact
  field names from the official Nedarim Plus callback documentation.

  1. Tables replaced
    - `nedarim_keva_callbacks`  → stores recurring-setup callbacks (KevaId dedup key)
    - `nedarim_donation_callbacks` → stores payment/transaction callbacks (TransactionId dedup key)

  2. All column names match the official Nedarim Plus payload exactly (snake_case mapping shown below)

  3. Security
    - RLS enabled; only admin role can SELECT
    - Service role (edge functions) bypasses RLS
*/

-- -----------------------------------------------
-- DROP old tables (safe: they are empty in prod)
-- -----------------------------------------------
DROP TABLE IF EXISTS nedarim_keva_callbacks CASCADE;
DROP TABLE IF EXISTS nedarim_donation_callbacks CASCADE;

-- -----------------------------------------------
-- Payment / transaction callback table
-- Official dedup key: TransactionId
-- -----------------------------------------------
CREATE TABLE nedarim_donation_callbacks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Official Nedarim Plus fields (exact names preserved as snake_case)
  transaction_id    text,          -- TransactionId  (dedup key)
  client_id         text,          -- ClientId
  zeout             text,          -- Zeout
  client_name       text,          -- ClientName
  adresse           text,          -- Adresse
  phone             text,          -- Phone
  mail              text,          -- Mail
  amount            text,          -- Amount (kept as text; NP may send decimals)
  currency          text,          -- Currency
  transaction_time  text,          -- TransactionTime
  confirmation      text,          -- Confirmation
  last_num          text,          -- LastNum  (last 4 of card)
  tokef             text,          -- Tokef    (card expiry)
  transaction_type  text,          -- TransactionType
  groupe            text,          -- Groupe
  comments          text,          -- Comments
  tashloumim        text,          -- Tashloumim (installments count)
  first_tashloum    text,          -- FirstTashloum
  mosad_number      text,          -- MosadNumber
  call_id           text,          -- CallId
  masof_id          text,          -- MasofId
  shovar            text,          -- Shovar   (receipt number)
  compagny_card     text,          -- CompagnyCard
  solek             text,          -- Solek
  tayar             text,          -- Tayar
  makor             text,          -- Makor
  keva_id           text,          -- KevaId   (if linked to recurring setup)
  debit_iframe      text,          -- DebitIframe

  -- Internal
  subscription_id   uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  raw_payload       jsonb NOT NULL,
  processed         boolean DEFAULT false,
  error_message     text,
  received_at       timestamptz DEFAULT now()
);

ALTER TABLE nedarim_donation_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read donation callbacks"
  ON nedarim_donation_callbacks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE UNIQUE INDEX idx_donation_transaction_id
  ON nedarim_donation_callbacks(transaction_id)
  WHERE transaction_id IS NOT NULL;

CREATE INDEX idx_donation_mail       ON nedarim_donation_callbacks(mail);
CREATE INDEX idx_donation_zeout      ON nedarim_donation_callbacks(zeout);
CREATE INDEX idx_donation_received   ON nedarim_donation_callbacks(received_at DESC);

-- -----------------------------------------------
-- Recurring setup callback table
-- Official dedup key: KevaId
-- -----------------------------------------------
CREATE TABLE nedarim_keva_callbacks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Official Nedarim Plus fields
  keva_id           text,          -- KevaId       (dedup key)
  client_id         text,          -- ClientId
  zeout             text,          -- Zeout
  client_name       text,          -- ClientName
  adresse           text,          -- Adresse
  phone             text,          -- Phone
  mail              text,          -- Mail
  amount            text,          -- Amount
  currency          text,          -- Currency
  next_date         text,          -- NextDate     (first/next billing date)
  last_num          text,          -- LastNum
  tokef             text,          -- Tokef
  groupe            text,          -- Groupe
  comments          text,          -- Comments
  tashloumim        text,          -- Tashloumim
  mosad_number      text,          -- MosadNumber
  masof_id          text,          -- MasofId
  debit_iframe      text,          -- DebitIframe

  -- Internal
  subscription_id   uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  raw_payload       jsonb NOT NULL,
  processed         boolean DEFAULT false,
  error_message     text,
  received_at       timestamptz DEFAULT now()
);

ALTER TABLE nedarim_keva_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read keva callbacks"
  ON nedarim_keva_callbacks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE UNIQUE INDEX idx_keva_keva_id
  ON nedarim_keva_callbacks(keva_id)
  WHERE keva_id IS NOT NULL;

CREATE INDEX idx_keva_mail       ON nedarim_keva_callbacks(mail);
CREATE INDEX idx_keva_zeout      ON nedarim_keva_callbacks(zeout);
CREATE INDEX idx_keva_received   ON nedarim_keva_callbacks(received_at DESC);
