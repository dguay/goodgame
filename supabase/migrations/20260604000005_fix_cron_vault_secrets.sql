-- Secure cron jobs: assert all Vault secrets exist before scheduling,
-- and read credentials from Vault at execution time (not hardcoded in migration).
--
-- Before running this migration, create these Vault secrets if not already present:
--
--   SELECT vault.create_secret(
--     'https://zjluauqdqockjswczndb.supabase.co/functions/v1',
--     'supabase_functions_url',
--     'Supabase Edge Functions base URL'
--   );
--
--   SELECT vault.create_secret(
--     '<your-anon-key>',
--     'supabase_anon_key',
--     'Supabase anon key'
--   );
--
-- cron_secret should already exist from migration 20260604000004.

DO $outer$
DECLARE
  v_secret text;
  v_url    text;
  v_anon   text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
  IF v_secret IS NULL OR trim(v_secret) = '' THEN
    RAISE EXCEPTION
      'Vault secret "cron_secret" not found. See migration comment for setup.';
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'supabase_functions_url' LIMIT 1;
  IF v_url IS NULL OR trim(v_url) = '' THEN
    RAISE EXCEPTION
      'Vault secret "supabase_functions_url" not found. See migration comment for setup.';
  END IF;

  SELECT decrypted_secret INTO v_anon
  FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1;
  IF v_anon IS NULL OR trim(v_anon) = '' THEN
    RAISE EXCEPTION
      'Vault secret "supabase_anon_key" not found. See migration comment for setup.';
  END IF;

  -- All secrets validated. Replace existing jobs.
  BEGIN
    PERFORM cron.unschedule('ingest-news');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    PERFORM cron.unschedule('calculate-news-trends');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Cron body reads from Vault at execution time: secrets can rotate
  -- without rescheduling. Environment-specific because the URL comes
  -- from Vault, not from this file.
  PERFORM cron.schedule(
    'ingest-news',
    '*/10 * * * *',
    $cron$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_functions_url' LIMIT 1) || '/ingest-news',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1),
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
      ),
      body    := '{}'::jsonb
    ) AS request_id;
    $cron$
  );

  PERFORM cron.schedule(
    'calculate-news-trends',
    '*/30 * * * *',
    $cron$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_functions_url' LIMIT 1) || '/calculate-news-trends',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1),
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
      ),
      body    := '{}'::jsonb
    ) AS request_id;
    $cron$
  );

  RAISE NOTICE 'Cron jobs scheduled. All credentials sourced from Vault at execution time.';
END $outer$;
