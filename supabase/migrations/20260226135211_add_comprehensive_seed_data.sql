/*
  # Add Comprehensive Seed Data for Testing

  ## Purpose
  This migration adds realistic seed data to populate the system for testing and demonstration.

  ## Data Added
  1. Sample plans (Bronze, Silver, Gold, Platinum)
  2. Sample hotels across different levels
  3. Sample hotel inventory for next 90 days
  
  ## Notes
  - All data is designed for testing purposes
  - IDs are generated automatically
  - Data can be safely deleted after testing
*/

-- Insert sample plans
INSERT INTO plans (name_he, name_en, description_he, description_en, monthly_amount, required_successful_payments, hotel_level, active)
VALUES
  ('ברונזה', 'Bronze', 'תוכנית בסיסית עם הטבות מלון ברמת ברונזה', 'Basic plan with bronze-level hotel benefits', 100, 12, 'bronze', true),
  ('כסף', 'Silver', 'תוכנית משודרגת עם הטבות מלון ברמת כסף', 'Upgraded plan with silver-level hotel benefits', 200, 12, 'silver', true),
  ('זהב', 'Gold', 'תוכנית פרמיום עם הטבות מלון ברמת זהב', 'Premium plan with gold-level hotel benefits', 360, 12, 'gold', true),
  ('פלטינום', 'Platinum', 'תוכנית VIP עם הטבות מלון ברמת פלטינום', 'VIP plan with platinum-level hotel benefits', 500, 12, 'platinum', true)
ON CONFLICT DO NOTHING;

-- Insert sample hotels
INSERT INTO hotels (name_he, name_en, city_he, city_en, level, description_he, description_en, base_rooms, extra_room_price, change_deadline_days, active)
VALUES
  ('מלון הר הזיתים', 'Mount of Olives Hotel', 'ירושלים', 'Jerusalem', 'bronze', 'מלון נעים במיקום מרכזי', 'Pleasant hotel in central location', 1, 150, 7, true),
  ('מלון הכותל', 'Kotel Hotel', 'ירושלים', 'Jerusalem', 'silver', 'מלון מודרני ליד העיר העתיקה', 'Modern hotel near the Old City', 1, 200, 7, true),
  ('מלון דוד המלך', 'King David Hotel', 'ירושלים', 'Jerusalem', 'gold', 'מלון יוקרה עם נוף מרהיב', 'Luxury hotel with stunning views', 1, 300, 14, true),
  ('מלון ממילא', 'Mamilla Hotel', 'ירושלים', 'Jerusalem', 'platinum', 'מלון בוטיק יוקרתי', 'Luxury boutique hotel', 1, 500, 14, true),
  ('מלון ים המלח', 'Dead Sea Hotel', 'ים המלח', 'Dead Sea', 'bronze', 'מלון ספא בים המלח', 'Spa hotel at the Dead Sea', 1, 180, 7, true),
  ('מלון חוף אילת', 'Eilat Beach Hotel', 'אילת', 'Eilat', 'silver', 'מלון חוף משפחתי', 'Family beach hotel', 1, 220, 7, true),
  ('מלון קורל ביץ', 'Coral Beach Hotel', 'אילת', 'Eilat', 'gold', 'מלון יוקרה על החוף', 'Luxury beachfront hotel', 1, 350, 10, true),
  ('מלון צפת העתיקה', 'Old Tzfat Hotel', 'צפת', 'Tzfat', 'bronze', 'מלון קטן ומקסים בצפת', 'Charming boutique hotel in Tzfat', 1, 120, 7, true)
ON CONFLICT DO NOTHING;

-- Insert inventory for all hotels for the next 90 days
DO $$
DECLARE
  hotel_record RECORD;
  day_offset INTEGER;
  inventory_date DATE;
BEGIN
  FOR hotel_record IN SELECT id FROM hotels LOOP
    FOR day_offset IN 1..90 LOOP
      inventory_date := CURRENT_DATE + (day_offset || ' days')::INTERVAL;
      
      INSERT INTO hotel_inventory (hotel_id, date, total_rooms, available_rooms)
      VALUES (
        hotel_record.id,
        inventory_date,
        10,
        10
      )
      ON CONFLICT (hotel_id, date) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
