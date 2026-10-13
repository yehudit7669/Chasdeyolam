/*
  # עלויות הזמנות ורווחיות

  - hotel_costs: "המחיר הרגיל" — כמה עולה לגמ"ח הזמנה במלון. טבלה נפרדת ולא עמודה על hotels,
    כי hotels פתוחה לקריאה ציבורית — עלויות לעולם לא יוצגו ללקוחות.
  - booking_admin_tracking (מנהל בלבד): לכל הזמנה — מחיר רגיל או מחיר אחר (custom_cost).

  רווח = סכום התוכנית (monthly_amount × required_successful_payments) פחות העלות.
*/

CREATE TABLE IF NOT EXISTS hotel_costs (
  hotel_id     uuid PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  default_cost numeric(10,2),
  updated_at   timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE hotel_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage hotel costs"
  ON hotel_costs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Viewers can read hotel costs"
  ON hotel_costs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'viewer'));

ALTER TABLE booking_admin_tracking ADD COLUMN IF NOT EXISTS cost_mode text NOT NULL DEFAULT 'default';
ALTER TABLE booking_admin_tracking ADD COLUMN IF NOT EXISTS custom_cost numeric(10,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_admin_tracking_cost_mode_check') THEN
    ALTER TABLE booking_admin_tracking
      ADD CONSTRAINT booking_admin_tracking_cost_mode_check CHECK (cost_mode IN ('default', 'custom'));
  END IF;
END $$;
