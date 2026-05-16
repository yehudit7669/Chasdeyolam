/*
  # Add Hotel Images Support

  ## Overview
  This migration adds support for multiple images per hotel to enhance the hotel browsing experience.

  ## New Tables
  
  ### hotel_images
  - `id` (uuid, primary key) - Unique identifier for each image
  - `hotel_id` (uuid, foreign key) - Links to hotels table
  - `image_url` (text) - URL to the hotel image
  - `display_order` (integer) - Order in which images should be displayed
  - `created_at` (timestamptz) - Timestamp of image upload
  
  ## Security
  - Enable RLS on hotel_images table
  - Allow authenticated users to view images for active hotels
  - Allow admins to manage hotel images
  
  ## Important Notes
  1. Multiple images can be associated with each hotel
  2. Images are ordered by display_order field
  3. Deleting a hotel cascades to delete all associated images
*/

-- Create hotel_images table
CREATE TABLE IF NOT EXISTS hotel_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE hotel_images ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view hotel images
CREATE POLICY "Anyone can view hotel images"
  ON hotel_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hotels
      WHERE hotels.id = hotel_images.hotel_id
      AND hotels.active = true
    )
  );

-- Allow admins to manage hotel images
CREATE POLICY "Admins can manage hotel images"
  ON hotel_images FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_hotel_images_hotel_id ON hotel_images(hotel_id, display_order);
