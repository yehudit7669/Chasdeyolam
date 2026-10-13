/*
  # בקשת שדרוג בהזמנת מלון

  לפני ההזמנה הסופית הלקוח יכול לבקש שדרוג (טקסט חופשי — חדר גדול יותר, נוף וכו').
  זו בקשה בלבד: הגמ"ח לא מתחייב לה, וזה כתוב ללקוח ליד השדה.
*/

ALTER TABLE immediate_requests ADD COLUMN IF NOT EXISTS upgrade_request text;
ALTER TABLE availability_checks ADD COLUMN IF NOT EXISTS upgrade_request text;
