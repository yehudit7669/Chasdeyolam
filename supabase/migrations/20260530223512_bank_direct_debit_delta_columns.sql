/*
  # Bank Direct Debit - Delta Migration

  Adds the remaining columns needed for bank direct debit support,
  working around what already exists in the database.

  ## Changes

  ### subscriptions table
  - source_thread_id: FK to originating support ticket
  - canceled_by: admin user id who cancelled
  - cancellation_reason: reason for cancellation

  ### support_threads table
  - linked_subscription_id: subscription created from this ticket

  ### subscription_audit_log table
  - Add donor_id and performed_by columns to existing table
*/

-- subscriptions: source_thread_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'source_thread_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN source_thread_id uuid REFERENCES support_threads(id) ON DELETE SET NULL;
  END IF;
END $$;

-- subscriptions: canceled_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'canceled_by'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN canceled_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- subscriptions: cancellation_reason
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN cancellation_reason text;
  END IF;
END $$;

-- support_threads: linked_subscription_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_threads' AND column_name = 'linked_subscription_id'
  ) THEN
    ALTER TABLE support_threads ADD COLUMN linked_subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- subscription_audit_log: donor_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_audit_log' AND column_name = 'donor_id'
  ) THEN
    ALTER TABLE subscription_audit_log ADD COLUMN donor_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- subscription_audit_log: performed_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_audit_log' AND column_name = 'performed_by'
  ) THEN
    ALTER TABLE subscription_audit_log ADD COLUMN performed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_source ON subscriptions(subscription_source);
CREATE INDEX IF NOT EXISTS idx_support_threads_type ON support_threads(thread_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_source_thread ON subscriptions(source_thread_id);
