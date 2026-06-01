/*
  # Create email_log table

  ## Purpose
  Audit log for every email send attempt made by the system.

  ## New Tables
  - `email_log`
    - `id` — primary key
    - `recipient` — email address the message was sent to
    - `template` — template/type identifier (e.g. subscription_frozen, new_support_ticket)
    - `subject` — email subject line
    - `related_id` — optional foreign key reference (thread_id, subscription_id, etc.)
    - `related_type` — what related_id refers to ('support_thread', 'subscription', etc.)
    - `success` — whether the send succeeded
    - `provider_response` — raw JSON from the email provider
    - `error_message` — error message if failed
    - `retry_count` — number of send attempts
    - `sent_at` — timestamp of the successful send or last attempt

  ## Security
  - RLS enabled
  - Admins can read all rows
  - Service role can insert (edge functions use service role)
*/

CREATE TABLE IF NOT EXISTS email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  template text NOT NULL,
  subject text,
  related_id text,
  related_type text,
  success boolean NOT NULL DEFAULT false,
  provider_response jsonb,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read email log"
  ON email_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'viewer')
    )
  );

CREATE POLICY "Service role can insert email log"
  ON email_log FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON email_log(recipient);
CREATE INDEX IF NOT EXISTS idx_email_log_template ON email_log(template);
CREATE INDEX IF NOT EXISTS idx_email_log_related ON email_log(related_id, related_type);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_log(sent_at DESC);
