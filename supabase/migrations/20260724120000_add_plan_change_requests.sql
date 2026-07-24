/*
  # החלפת תוכנית תרומה — בקשות מנהל + זיכוי חודשים

  1. שינויים
    - `subscriptions`: הוספת `credited_payments` (integer, default 0) — חודשים "קרדיט" שהועברו
      מתוכנית קודמת בעת החלפה. נוסף לספירת התשלומים שסונכרנה בפועל מנדרים פלוס
      (successful_payments_count) בחישוב הזכאות, בלי שסנכרון יומי ידרוס אותו.
    - טבלה חדשה `plan_change_requests` — בקשת לקוח להחליף תוכנית פעילה, ממתינה לאישור מנהל
      לפני מעבר לתשלום בפועל.

  2. אבטחה (RLS)
    - לקוח: יכול ליצור ולראות רק את הבקשות שלו.
    - מנהל: גישה מלאה (לפי profiles.role='admin', תואם לשאר הטבלאות בפרויקט).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'credited_payments'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN credited_payments integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS plan_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  old_plan_id uuid REFERENCES plans(id),
  new_plan_id uuid NOT NULL REFERENCES plans(id),
  old_plan_name_he text,
  new_plan_name_he text,
  paid_amount_snapshot numeric NOT NULL DEFAULT 0,
  credited_months integer NOT NULL DEFAULT 0,
  credited_remainder numeric NOT NULL DEFAULT 0,
  months_to_pay integer NOT NULL DEFAULT 0,
  new_subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'completed')),
  admin_note text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE plan_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan change requests"
  ON plan_change_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plan change requests"
  ON plan_change_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage plan change requests"
  ON plan_change_requests FOR ALL
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

CREATE INDEX IF NOT EXISTS idx_plan_change_requests_user_id ON plan_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_change_requests_status ON plan_change_requests(status);

DROP TRIGGER IF EXISTS update_plan_change_requests_updated_at ON plan_change_requests;
CREATE TRIGGER update_plan_change_requests_updated_at BEFORE UPDATE ON plan_change_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
