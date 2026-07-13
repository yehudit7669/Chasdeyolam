-- ימי כניסה ברירת מחדל לתוכנית — חלים אוטומטית על כל המלונות בתוכנית,
-- אלא אם למלון יש הגדרה עצמית (hotels.bookable_days, כבר קיים) שגוברת כחריגה.
-- לא מוחקים את plans.stay_type הישן — נשאר בטבלה בלי שימוש, לא נדרש דבר בקוד.
ALTER TABLE plans ADD COLUMN IF NOT EXISTS bookable_days integer[] DEFAULT NULL;
