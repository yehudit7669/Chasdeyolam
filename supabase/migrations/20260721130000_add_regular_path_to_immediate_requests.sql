/*
  # תמיכה במסלול הרגיל בטבלת immediate_requests

  1. שינויים
    - `immediate_requests`: הוספת עמודות:
      - `redemption_type` (text, NOT NULL, default 'immediate') — 'immediate' | 'regular'.
        ברירת המחדל 'immediate' משמרת את המשמעות המקורית של כל השורות הקיימות.
      - `subscription_id` (uuid, nullable, FK -> subscriptions.id ON DELETE SET NULL) —
        משמש לזיהוי-כפילות (idempotency) עבור בקשות שנוצרות אוטומטית ממעבר לזכאות
        במסלול הרגיל, וגם למעקב מנהלי.
    - אינדקס על subscription_id.

  2. הערות
    - כל העמודות אופציונליות/עם ברירת מחדל בטוחה — לא משפיעות על שורות קיימות
      או על הקוד הקיים (AdminImmediateRequestsPage.tsx / MyOrdersPage.tsx משתמשים
      ב-select('*') או ברשימת שדות מפורשת שלא נשברת מעמודות חדשות).
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'immediate_requests')
     AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'immediate_requests' AND column_name = 'redemption_type'
  ) THEN
    ALTER TABLE immediate_requests ADD COLUMN redemption_type text NOT NULL DEFAULT 'immediate';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'immediate_requests')
     AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'immediate_requests_redemption_type_check'
  ) THEN
    ALTER TABLE immediate_requests
      ADD CONSTRAINT immediate_requests_redemption_type_check
      CHECK (redemption_type IN ('immediate', 'regular'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'immediate_requests')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions')
     AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'immediate_requests' AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE immediate_requests
      ADD COLUMN subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'immediate_requests')
     AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'immediate_requests' AND indexname = 'idx_immediate_requests_subscription_id'
  ) THEN
    CREATE INDEX idx_immediate_requests_subscription_id ON immediate_requests(subscription_id);
  END IF;
END $$;
