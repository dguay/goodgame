-- Secure news cron jobs with a private shared secret.
--
-- Before running this migration:
--   1. Generate a secret:  openssl rand -hex 32
--   2. Set Edge Function secret:
--        supabase secrets set CRON_SECRET=<value>
--   3. Store it in Vault so the cron SQL can read it:
--        Run once in the Supabase SQL editor:
--        SELECT vault.create_secret('<same-value>', 'cron_secret', 'Shared secret for scheduled news functions');

SELECT cron.unschedule('ingest-news');
SELECT cron.unschedule('calculate-news-trends');

-- Re-schedule with X-Cron-Secret header sourced from Vault.
SELECT cron.schedule(
  'ingest-news',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://zjluauqdqockjswczndb.supabase.co/functions/v1/ingest-news',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'calculate-news-trends',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://zjluauqdqockjswczndb.supabase.co/functions/v1/calculate-news-trends',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
