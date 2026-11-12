/*
  # לוגים של תוכנת המחשב "שולחני"

  התוכנה שולחת שגיאות ואזהרות ל-POST /api/shulchani/logs (Edge Function בשם shulchani-logs).
  אין כאן נתונים כספיים או שמות — רק הודעות שגיאה ופרטי התקנה.

  - קריאה: מנהלים בלבד.
  - כתיבה: רק הפונקציה, עם service role (אין policy לכתיבה מ-authenticated/anon).
*/

CREATE TABLE IF NOT EXISTS shulchani_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  logged_at   timestamptz NOT NULL,
  level       text NOT NULL,
  message     text NOT NULL,
  stack       text,
  install     uuid NOT NULL,
  version     text,
  computer    text,
  platform    text,
  CONSTRAINT shulchani_logs_level_check CHECK (level IN ('error', 'warn', 'info'))
);

ALTER TABLE shulchani_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read shulchani logs"
  ON shulchani_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Service role can insert shulchani logs"
  ON shulchani_logs FOR INSERT TO service_role
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_shulchani_logs_logged_at ON shulchani_logs(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_shulchani_logs_install_received ON shulchani_logs(install, received_at DESC);
