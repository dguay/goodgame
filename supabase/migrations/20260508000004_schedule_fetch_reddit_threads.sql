select cron.schedule(
  'fetch-reddit-threads-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://zjluauqdqockjswczndb.supabase.co/functions/v1/fetch-reddit-threads',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
