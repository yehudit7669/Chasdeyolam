/*
  # Add Sample Hotel Images

  ## Overview
  This migration adds sample hotel images from Pexels to demonstrate the hotel image gallery feature.

  ## Data Added
  - Sample images for each hotel in the system
  - Images are ordered by display_order for carousel presentation
  
  ## Important Notes
  1. Images are sourced from Pexels (free stock photos)
  2. Each hotel gets 3-4 sample images
  3. Images are ordered for optimal presentation
*/

-- Add images for Mount of Olives Hotel (Bronze - Jerusalem)
INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg', 0
FROM hotels WHERE name_en = 'Mount of Olives Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg', 1
FROM hotels WHERE name_en = 'Mount of Olives Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg', 2
FROM hotels WHERE name_en = 'Mount of Olives Hotel'
ON CONFLICT DO NOTHING;

-- Add images for Kotel Hotel (Silver - Jerusalem)
INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/189296/pexels-photo-189296.jpeg', 0
FROM hotels WHERE name_en = 'Kotel Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg', 1
FROM hotels WHERE name_en = 'Kotel Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/210604/pexels-photo-210604.jpeg', 2
FROM hotels WHERE name_en = 'Kotel Hotel'
ON CONFLICT DO NOTHING;

-- Add images for King David Hotel (Gold - Jerusalem)
INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg', 0
FROM hotels WHERE name_en = 'King David Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/237371/pexels-photo-237371.jpeg', 1
FROM hotels WHERE name_en = 'King David Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/271639/pexels-photo-271639.jpeg', 2
FROM hotels WHERE name_en = 'King David Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/1134176/pexels-photo-1134176.jpeg', 3
FROM hotels WHERE name_en = 'King David Hotel'
ON CONFLICT DO NOTHING;

-- Add images for Mamilla Hotel (Platinum - Jerusalem)
INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/1134166/pexels-photo-1134166.jpeg', 0
FROM hotels WHERE name_en = 'Mamilla Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/1743229/pexels-photo-1743229.jpeg', 1
FROM hotels WHERE name_en = 'Mamilla Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg', 2
FROM hotels WHERE name_en = 'Mamilla Hotel'
ON CONFLICT DO NOTHING;

-- Add images for Dead Sea Hotel (Bronze - Dead Sea)
INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/261101/pexels-photo-261101.jpeg', 0
FROM hotels WHERE name_en = 'Dead Sea Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/261395/pexels-photo-261395.jpeg', 1
FROM hotels WHERE name_en = 'Dead Sea Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/221457/pexels-photo-221457.jpeg', 2
FROM hotels WHERE name_en = 'Dead Sea Hotel'
ON CONFLICT DO NOTHING;

-- Add images for Eilat Beach Hotel (Silver - Eilat)
INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/2506988/pexels-photo-2506988.jpeg', 0
FROM hotels WHERE name_en = 'Eilat Beach Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg', 1
FROM hotels WHERE name_en = 'Eilat Beach Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg', 2
FROM hotels WHERE name_en = 'Eilat Beach Hotel'
ON CONFLICT DO NOTHING;

-- Add images for Coral Beach Hotel (Gold - Eilat)
INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg', 0
FROM hotels WHERE name_en = 'Coral Beach Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/753626/pexels-photo-753626.jpeg', 1
FROM hotels WHERE name_en = 'Coral Beach Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/1450360/pexels-photo-1450360.jpeg', 2
FROM hotels WHERE name_en = 'Coral Beach Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/2373201/pexels-photo-2373201.jpeg', 3
FROM hotels WHERE name_en = 'Coral Beach Hotel'
ON CONFLICT DO NOTHING;

-- Add images for Old Tzfat Hotel (Bronze - Tzfat)
INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg', 0
FROM hotels WHERE name_en = 'Old Tzfat Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg', 1
FROM hotels WHERE name_en = 'Old Tzfat Hotel'
ON CONFLICT DO NOTHING;

INSERT INTO hotel_images (hotel_id, image_url, display_order)
SELECT id, 'https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg', 2
FROM hotels WHERE name_en = 'Old Tzfat Hotel'
ON CONFLICT DO NOTHING;
