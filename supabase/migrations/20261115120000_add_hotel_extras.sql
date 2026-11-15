/*
  # תוספות בתשלום לכל מלון (ילד נוסף, שדרוג חדר, לילה נוסף...)

  - hotels.extras: רשימת [{label, price}] שהמנהל מגדיר. מוצגת ללקוח ב"עוד" ליד שם המלון
    (במכוון ציבורי — אלה מחירים ללקוח, לא עלויות שלנו; עלויות נשמרות ב-hotel_costs).
  - selected_extras: מה הלקוח סימן בהזמנה — [{label, price, qty}], צילום מצב של המחיר
    ברגע ההזמנה (שינוי מחיר עתידי לא משנה הזמנות קיימות). התשלום עליהן מוסדר מול הגמ"ח.
*/

ALTER TABLE hotels ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE immediate_requests ADD COLUMN IF NOT EXISTS selected_extras jsonb;
ALTER TABLE availability_checks ADD COLUMN IF NOT EXISTS selected_extras jsonb;
