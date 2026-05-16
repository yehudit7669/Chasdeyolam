/*
  # Add Sample Data for Testing

  ## Overview
  This migration adds sample data to test the Chasdei Olam application:
  - Sample subscription plans
  - Sample hotels
  - Sample hotel inventory for available dates
  - Admin user (must be created manually in Supabase Auth dashboard)

  ## Data Added

  ### Plans
  - Basic Plan: 100 ILS/month, 12 payments, Standard hotels
  - Premium Plan: 200 ILS/month, 10 payments, Premium hotels
  - VIP Plan: 350 ILS/month, 8 payments, Luxury hotels

  ### Hotels
  - Multiple hotels across different cities
  - Different levels (Standard, Premium, Luxury)
  - Inventory for upcoming dates

  ## Important Notes
  - Admin users must be created through Supabase Auth dashboard
  - After creating an admin user, update their profile role to 'admin'
  - Dates are set for future availability
*/

-- Insert sample plans
INSERT INTO plans (name_he, name_en, description_he, description_en, monthly_amount, required_successful_payments, hotel_level, active)
VALUES 
  (
    'תוכנית בסיסית',
    'Basic Plan',
    'תוכנית מעולה למתחילים - 12 תשלומים והזמנת מלון',
    'Great starter plan - 12 payments and hotel booking',
    10000,
    12,
    'Standard',
    true
  ),
  (
    'תוכנית פרימיום',
    'Premium Plan',
    'תוכנית משתלמת - 10 תשלומים ומלונות איכותיים',
    'Great value - 10 payments and quality hotels',
    20000,
    10,
    'Premium',
    true
  ),
  (
    'תוכנית VIP',
    'VIP Plan',
    'תוכנית יוקרתית - 8 תשלומים ומלונות יוקרה',
    'Luxury plan - 8 payments and luxury hotels',
    35000,
    8,
    'Luxury',
    true
  )
ON CONFLICT DO NOTHING;

-- Insert sample hotels
INSERT INTO hotels (name_he, name_en, city_he, city_en, level, description_he, description_en, base_rooms, extra_room_price, change_deadline_days, active)
VALUES 
  (
    'מלון ים המלח',
    'Dead Sea Hotel',
    'ים המלח',
    'Dead Sea',
    'Standard',
    'מלון נעים על חוף ים המלח עם בריכה ומתקני ספא',
    'Pleasant hotel on the Dead Sea shore with pool and spa facilities',
    1,
    50000,
    7,
    true
  ),
  (
    'מלון הגליל',
    'Galilee Hotel',
    'טבריה',
    'Tiberias',
    'Standard',
    'מלון משפחתי מול הכנרת עם נוף מרהיב',
    'Family hotel facing the Sea of Galilee with stunning views',
    1,
    45000,
    7,
    true
  ),
  (
    'מלון דוד המלך',
    'King David Hotel',
    'ירושלים',
    'Jerusalem',
    'Premium',
    'מלון יוקרתי במרכז העיר עם שירות מעולה',
    'Luxury hotel in city center with excellent service',
    1,
    75000,
    14,
    true
  ),
  (
    'מלון ממילא',
    'Mamilla Hotel',
    'ירושלים',
    'Jerusalem',
    'Luxury',
    'מלון בוטיק מעוצב בסמוך לעיר העתיקה',
    'Designer boutique hotel near the Old City',
    1,
    100000,
    14,
    true
  ),
  (
    'מלון הרברט סמואל',
    'Herbert Samuel Hotel',
    'תל אביב',
    'Tel Aviv',
    'Premium',
    'מלון מודרני על חוף הים עם גישה ישירה לחוף',
    'Modern hotel on the beach with direct beach access',
    1,
    80000,
    10,
    true
  ),
  (
    'מלון ישרוטל רויאל ביץ',
    'Isrotel Royal Beach',
    'אילת',
    'Eilat',
    'Luxury',
    'מלון 5 כוכבים עם חוף פרטי ומתקני פנאי',
    '5-star hotel with private beach and leisure facilities',
    1,
    90000,
    10,
    true
  )
ON CONFLICT DO NOTHING;

-- Insert sample inventory for hotels (next 90 days)
DO $$
DECLARE
  hotel_record RECORD;
  date_offset INTEGER;
  inventory_date DATE;
BEGIN
  FOR hotel_record IN SELECT id FROM hotels WHERE active = true
  LOOP
    FOR date_offset IN 1..90
    LOOP
      inventory_date := CURRENT_DATE + date_offset;
      
      INSERT INTO hotel_inventory (hotel_id, date, total_rooms, available_rooms)
      VALUES (
        hotel_record.id,
        inventory_date,
        CASE 
          WHEN date_offset % 7 IN (0, 6) THEN 5
          ELSE 10
        END,
        CASE 
          WHEN date_offset % 7 IN (0, 6) THEN 5
          ELSE 10
        END
      )
      ON CONFLICT (hotel_id, date) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Create a function to decrement inventory (used during booking)
CREATE OR REPLACE FUNCTION decrement_inventory(p_hotel_id uuid, p_date date)
RETURNS void AS $$
BEGIN
  UPDATE hotel_inventory
  SET available_rooms = available_rooms - 1
  WHERE hotel_id = p_hotel_id
    AND date = p_date
    AND available_rooms > 0;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No available rooms for the selected date';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
