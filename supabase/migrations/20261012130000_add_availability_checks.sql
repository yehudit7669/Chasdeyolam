/*
  # בדיקת זמינות לפני תשלום במימוש מיידי

  לקוח שחשוב לו מלון/תאריך מבקש בדיקה *לפני* שהוא משלם את כל הסכום.
  המנהל מסמן זמין/לא זמין. אישור "זמין" תקף 48 שעות (expires_at) — בתוך 48 השעות הלקוח משלם,
  ואז הבקשה מסומנת used ומקושרת ל-immediate_requests שנוצרה בתשלום.

  סטטוסים: pending → available / unavailable → used. הלקוח יכול גם לבטל (cancelled).
  "פג תוקף" אינו סטטוס שמור — מחושב מ-status='available' AND expires_at < now().

  הרשאות:
  - תורם: קורא ויוצר רק את שלו; מעדכן את שלו רק לסטטוס used/cancelled
    (כדי שלא יוכל לסמן לעצמו "זמין").
  - מנהל: גישה מלאה. צופה: קריאה.
*/

CREATE TABLE IF NOT EXISTS availability_checks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id          uuid NOT NULL REFERENCES plans(id),
  plan_name_he     text,
  user_full_name   text,
  user_email       text,
  user_phone       text,

  -- העדפת הלקוח: מלון ראשון + אפשרות ב' (לא חובה), ותאריכים מדויקים או טווח גמיש
  hotel_id         uuid NOT NULL REFERENCES hotels(id),
  alt_hotel_id     uuid REFERENCES hotels(id),
  date_mode        text NOT NULL CHECK (date_mode IN ('exact', 'flexible')),
  date_from        date NOT NULL,
  date_to          date NOT NULL,
  user_note        text,

  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'available', 'unavailable', 'used', 'cancelled')),

  -- תשובת המנהל: מה בדיוק פנוי
  approved_hotel_id   uuid REFERENCES hotels(id),
  approved_date       date,
  approved_end_date   date,
  admin_note          text,
  responded_at        timestamptz,
  expires_at          timestamptz,

  used_request_id  uuid REFERENCES immediate_requests(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL,

  CHECK (date_to >= date_from)
);

ALTER TABLE availability_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own availability checks"
  ON availability_checks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own availability checks"
  ON availability_checks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users can mark own availability checks used or cancelled"
  ON availability_checks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status IN ('used', 'cancelled'));

CREATE POLICY "Admins can manage availability checks"
  ON availability_checks FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Viewers can read availability checks"
  ON availability_checks FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'viewer'));

CREATE INDEX IF NOT EXISTS idx_availability_checks_user_id ON availability_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_availability_checks_status ON availability_checks(status);

DROP TRIGGER IF EXISTS update_availability_checks_updated_at ON availability_checks;
CREATE TRIGGER update_availability_checks_updated_at BEFORE UPDATE ON availability_checks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
