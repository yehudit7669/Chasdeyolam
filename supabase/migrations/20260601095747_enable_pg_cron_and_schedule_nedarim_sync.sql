/*
  # Enable pg_cron + pg_net and schedule daily Nedarim sync

  1. Enables pg_cron extension for job scheduling
  2. Enables pg_net extension for HTTP calls from within the database
  3. Creates a daily cron job at 03:00 UTC that POSTs to the nedarim-keva-sync
     edge function so every active/frozen subscription is synced with Nedarim Plus
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule daily sync at 03:00 UTC
-- Uses pg_net to POST to the edge function with the service role key
SELECT cron.schedule(
  'nedarim-keva-daily-sync',
  '0 3 * * *',
  $$
  SELECT extensions.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/nedarim-keva-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
