/*
  # פרטי אורחים בהזמנת מלון

  כשלקוח בוחר מלון — בהזמנה עצמה (immediate_requests) או בבדיקת זמינות לפני תשלום
  (availability_checks) — הוא ממלא שמות אורחים, כתובת ומייל (ברירת מחדל: המייל שנרשם איתו).
  בבדיקת זמינות הפרטים עוברים להזמנה כשהוא משלם.
*/

ALTER TABLE immediate_requests ADD COLUMN IF NOT EXISTS guest_names text;
ALTER TABLE immediate_requests ADD COLUMN IF NOT EXISTS guest_address text;
ALTER TABLE immediate_requests ADD COLUMN IF NOT EXISTS guest_email text;

ALTER TABLE availability_checks ADD COLUMN IF NOT EXISTS guest_names text;
ALTER TABLE availability_checks ADD COLUMN IF NOT EXISTS guest_address text;
ALTER TABLE availability_checks ADD COLUMN IF NOT EXISTS guest_email text;
