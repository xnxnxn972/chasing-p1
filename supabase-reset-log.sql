-- ============================================================================
--  Chasing P1 — wipe the session log and start fresh
--
--  IRREVERSIBLE. Run the backup line first if you might want the old rows.
--  Structure, policies, trigger and view are all untouched — data only.
-- ============================================================================

-- OPTIONAL: keep a copy first. Comment out if you do not want one.
-- drop table if exists public.cp_sessions_backup;
-- create table public.cp_sessions_backup as select * from public.cp_sessions;

-- The wipe.
truncate table public.cp_sessions;

-- Confirm: should return 0.
select count(*) as rows_remaining from public.cp_sessions;
