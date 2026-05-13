-- Grant privileges on all existing public tables to anon and authenticated roles.
-- Also set default privileges so future tables in this schema are automatically accessible.
-- Required for Supabase Data API (PostgREST) after the May 30 2026 change that no longer
-- grants public schema access by default.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
