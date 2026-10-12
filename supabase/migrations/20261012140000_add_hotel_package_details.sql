/*
  # פירוט "מה מקבלים" לכל מלון

  כל תוכנית משויכת לרמת מלון משלה (hotel_level), כך שמלון שייך בפועל לתוכנית אחת —
  לכן הפירוט נשמר על המלון עצמו ומוצג ללקוח בכפתור "עוד" ליד שם המלון.
  כל השדות לא חובה; מלון בלי פירוט פשוט לא מציג "עוד".
*/

ALTER TABLE hotels ADD COLUMN IF NOT EXISTS room_type text;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS meals text;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS package_includes text;
