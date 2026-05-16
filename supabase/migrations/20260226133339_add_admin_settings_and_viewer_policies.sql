/*
  # Add Admin Settings Table and Viewer Policies

  ## New Table: admin_settings
  - Singleton table for system-wide configuration
  - Fields: default_required_payments, default_currency, enable_english, email settings

  ## Updated RLS Policies
  - Viewer can read all tables but cannot insert/update/delete
  - Admin retains full CRUD access

  ## Security
  - RLS enabled on admin_settings
  - Only admins can modify settings
  - Viewers and admins can read settings
*/

-- =====================================================
-- ADMIN SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_required_payments integer DEFAULT 12 NOT NULL CHECK (default_required_payments > 0),
  default_currency text DEFAULT 'ILS' NOT NULL,
  enable_english boolean DEFAULT true NOT NULL,
  email_sender_name text DEFAULT 'Chasdei Olam' NOT NULL,
  email_sender_address text DEFAULT 'support@chasdei-olam.org' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and viewers can view settings"
  ON admin_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'viewer')
    )
  );

CREATE POLICY "Only admins can modify settings"
  ON admin_settings FOR ALL
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

-- Insert default settings
INSERT INTO admin_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON admin_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- UPDATE RLS POLICIES FOR VIEWER ROLE
-- =====================================================

-- Viewers can read all profiles
CREATE POLICY "Viewers can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'viewer'
    )
  );

-- Viewers can read all plans
CREATE POLICY "Viewers can read all plans"
  ON plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'viewer'
    )
  );

-- Viewers can read all subscriptions
CREATE POLICY "Viewers can read all subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'viewer'
    )
  );

-- Viewers can read all payments
CREATE POLICY "Viewers can read all payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'viewer'
    )
  );

-- Viewers can read all hotels
CREATE POLICY "Viewers can read all hotels"
  ON hotels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'viewer'
    )
  );

-- Viewers can read all inventory
CREATE POLICY "Viewers can read all inventory"
  ON hotel_inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'viewer'
    )
  );

-- Viewers can read all bookings
CREATE POLICY "Viewers can read all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'viewer'
    )
  );

-- Viewers can read all support threads
CREATE POLICY "Viewers can read all support threads"
  ON support_threads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'viewer'
    )
  );

-- Viewers can read all support messages
CREATE POLICY "Viewers can read all support messages"
  ON support_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'viewer'
    )
  );