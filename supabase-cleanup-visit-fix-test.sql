-- ============================================================================
--  Remove the rows written while verifying the persistent-visit change
--  (2026-10-29, ~06:19-06:23 UTC, from a localhost dev server).
--
--  WHY THIS IS NEEDED: the verification had to run with telemetry ENABLED,
--  because ?dev=1 suppresses the exact write path being tested. Most of the
--  resulting rows carry a localhost referrer and the dashboard's isDev()
--  already drops them, but the FIRST load of each sitting has no referrer at
--  all, so those slip through and read as real direct traffic — the same
--  blind spot that put 29 false bounces in the log on day one.
--
--  Four visit ids, all mine. Safe to run more than once.
-- ============================================================================

delete from public.cp_sessions
where visit_id in (
  '119072a9-edcd-427f-bae4-580931700609',
  '3bd9e104-906f-4124-aa38-b568314b2e47',
  '97c9f4a8-c2f2-41a2-87f4-01c8e03bb243',
  'f68d4d09-3db3-4611-b545-6ce5ffd9f8ba'
);

delete from public.cp_loads
where visit_id in (
  '119072a9-edcd-427f-bae4-580931700609',
  '3bd9e104-906f-4124-aa38-b568314b2e47',
  '97c9f4a8-c2f2-41a2-87f4-01c8e03bb243',
  'f68d4d09-3db3-4611-b545-6ce5ffd9f8ba'
);

-- Belt and braces: anything else ever played against a dev server. The env
-- column is set by the client from the hostname, so this catches localhost
-- rows whose referrer was empty. Already shipped as supabase-reset-dev-only.sql.
delete from public.cp_sessions where env = 'dev';
