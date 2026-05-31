/*
  # Create subscription_actions audit log table

  ## Summary
  A dedicated audit log for every Nedarim Plus API action performed on a subscription
  (pause/resume/cancel). Records who acted, what they did, what the old/new status was,
  and which source (admin or donor) initiated the action.

  ## New Table: subscription_actions
  - `id` — primary key UUID
  - `subscription_id` — FK → subscriptions.id
  - `user_id` — the donor whose subscription was affected
  - `performed_by` — the auth user who initiated the action (admin or donor)
  - `action` — one of: admin_disabled, admin_enabled, admin_deleted, user_disabled, user_enabled, user_deleted
  - `old_status` — subscription status before action
  - `new_status` — subscription status after action
  - `nedarim_keva_id` — the KevaId sent to Nedarim API
  - `nedarim_response` — raw JSON response from Nedarim API
  - `success` — whether the Nedarim API call succeeded
  - `notes` — free-text notes
  - `created_at` — timestamp

  ## Security
  - RLS enabled; only admins can read; edge functions write via service role
*/

CREATE TABLE IF NOT EXISTS subscription_actions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   uuid NOT NULL REFERENCES subscriptions(id),
  user_id           uuid REFERENCES auth.users(id),
  performed_by      uuid REFERENCES auth.users(id),
  action            text NOT NULL CHECK (action IN (
    'admin_disabled', 'admin_enabled', 'admin_deleted',
    'user_disabled', 'user_enabled', 'user_deleted'
  )),
  old_status        text,
  new_status        text,
  nedarim_keva_id   text,
  nedarim_response  jsonb,
  success           boolean NOT NULL DEFAULT false,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_actions_subscription_id ON subscription_actions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_actions_user_id ON subscription_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_actions_performed_by ON subscription_actions(performed_by);

ALTER TABLE subscription_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read subscription actions"
  ON subscription_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'viewer')
    )
  );

CREATE POLICY "Admins can insert subscription actions"
  ON subscription_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
