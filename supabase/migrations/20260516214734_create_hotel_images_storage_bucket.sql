/*
  # Create Hotel Images Storage Bucket

  ## Summary
  Sets up Supabase Storage for hotel image uploads.

  ## Changes
  1. Creates a public storage bucket named `hotel-images`
  2. Adds storage policies:
     - Authenticated admin users can upload and delete images
     - Public read access for all hotel images (needed for displaying to donors)

  ## Notes
  - Bucket is public so image URLs can be used directly in img tags
  - Upload and delete restricted to admin role only
  - 10MB per file limit, image MIME types only
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hotel-images',
  'hotel-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for hotel images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'hotel-images');

CREATE POLICY "Admin users can upload hotel images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'hotel-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete hotel images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'hotel-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
