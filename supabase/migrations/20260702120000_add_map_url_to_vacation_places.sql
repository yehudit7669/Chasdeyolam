/*
  # הוספת שדה מיקום (קישור למפה) + קישור למלון לגלריית נופשים

  1. שינויים
    - `vacation_place_meta`: הוספת עמודות:
      - `map_url` (text, nullable) — קישור Waze/Google Maps, עבור מקומות סטטיים (override).
      - `linked_hotel_id` (uuid, nullable, FK -> hotels.id) — קישור לצורך סנכרון תמונות/תיאור
        מול טבלת המלונות (ניהול מלונות / hotel_images).
    - `vacation_places`: הוספת אותן שתי עמודות — עבור מקומות שנוספו ידנית דרך הממשק.

  2. הערות
    - כל העמודות אופציונליות — לא משפיעות על שורות קיימות.
    - `linked_hotel_id` עם `ON DELETE SET NULL` כדי שמחיקת מלון לא תשבור את שורת הגלריה.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vacation_place_meta')
     AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vacation_place_meta' AND column_name = 'map_url'
  ) THEN
    ALTER TABLE vacation_place_meta ADD COLUMN map_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vacation_places')
     AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vacation_places' AND column_name = 'map_url'
  ) THEN
    ALTER TABLE vacation_places ADD COLUMN map_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vacation_place_meta')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hotels')
     AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vacation_place_meta' AND column_name = 'linked_hotel_id'
  ) THEN
    ALTER TABLE vacation_place_meta ADD COLUMN linked_hotel_id uuid REFERENCES hotels(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vacation_places')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hotels')
     AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vacation_places' AND column_name = 'linked_hotel_id'
  ) THEN
    ALTER TABLE vacation_places ADD COLUMN linked_hotel_id uuid REFERENCES hotels(id) ON DELETE SET NULL;
  END IF;
END $$;
