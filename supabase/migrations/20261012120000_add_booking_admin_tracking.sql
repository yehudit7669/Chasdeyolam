/*
  # מעקב פנימי של מנהל על בקשות הזמנה

  צ'קליסט + הערה פנימית לכל בקשה ב-immediate_requests.
  טבלה נפרדת (ולא עמודות על immediate_requests) כי התורם קורא את השורה שלו שם —
  ומה שכאן חייב להישאר גלוי למנהל בלבד.

  - מנהל: גישה מלאה. צופה (viewer): קריאה בלבד. תורם: אין גישה.
*/

CREATE TABLE IF NOT EXISTS booking_admin_tracking (
  request_id    uuid PRIMARY KEY REFERENCES immediate_requests(id) ON DELETE CASCADE,
  checklist     jsonb NOT NULL DEFAULT '{}'::jsonb,
  internal_note text,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE booking_admin_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage booking tracking"
  ON booking_admin_tracking FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Viewers can read booking tracking"
  ON booking_admin_tracking FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'viewer'
    )
  );

DROP TRIGGER IF EXISTS update_booking_admin_tracking_updated_at ON booking_admin_tracking;
CREATE TRIGGER update_booking_admin_tracking_updated_at BEFORE UPDATE ON booking_admin_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
