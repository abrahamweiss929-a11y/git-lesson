-- migration-003-ask-readonly-sql.sql
-- v4 AI Assistant: Create execute_readonly_sql function for safe SQL execution via RPC.
--
-- This function allows the AI assistant's backend to run arbitrary
-- read-only SQL queries against the database. It is the "escape hatch"
-- for questions that don't fit the predefined tool set.
--
-- SECURITY MODEL:
--   1. SECURITY INVOKER — runs as the calling role, NOT as superuser.
--   2. transaction_read_only = ON — database rejects any write attempt.
--   3. statement_timeout = 5s — kills runaway queries.
--   4. GRANT to service_role ONLY — never anon or authenticated.
--      The service_role key is server-side only (no NEXT_PUBLIC_ prefix),
--      used exclusively by the /api/ask API route.

BEGIN;

CREATE OR REPLACE FUNCTION execute_readonly_sql(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Defense in depth: enforce read-only at the database level
  SET LOCAL transaction_read_only = ON;
  SET LOCAL statement_timeout = '5s';

  -- Execute the query and aggregate rows into JSONB
  EXECUTE format('SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (%s) t', query_text)
  INTO result;

  RETURN result;
END;
$$;

-- CRITICAL: Only grant to service_role.
-- The anon key is public (used by the browser). If anon could call this,
-- anyone with the URL could execute arbitrary read-only SQL via RPC,
-- bypassing the AI assistant entirely.
REVOKE ALL ON FUNCTION execute_readonly_sql(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION execute_readonly_sql(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION execute_readonly_sql(TEXT) TO service_role;

DO $$ BEGIN
  RAISE NOTICE 'migration-003: execute_readonly_sql function created, granted to service_role only';
END $$;

COMMIT;
