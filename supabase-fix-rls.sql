-- ============================================================================
--  Chasing P1 — fix the session-log write permissions
--  Run this in the Supabase SQL editor. Safe to run more than once.
--
--  The insert was being rejected with
--    42501: new row violates row-level security policy
--  which means the write policies either were not created or are not matching
--  the role the game connects as. This recreates them against every client
--  role and makes the grants explicit, so it works either way.
-- ============================================================================

alter table public.cp_sessions enable row level security;

-- Clear any earlier attempt, whatever it was called.
drop policy if exists cp_sessions_anon_insert  on public.cp_sessions;
drop policy if exists cp_sessions_anon_update  on public.cp_sessions;
drop policy if exists cp_sessions_write_insert on public.cp_sessions;
drop policy if exists cp_sessions_write_update on public.cp_sessions;

-- `to public` covers every role the client might connect as, rather than
-- betting on it being exactly `anon`.
create policy cp_sessions_write_insert on public.cp_sessions
  for insert to public with check (true);

create policy cp_sessions_write_update on public.cp_sessions
  for update to public using (true) with check (true);

-- Table privileges are separate from RLS; a policy alone is not enough.
-- Note: no SELECT grant, so visitors still cannot read the log.
grant insert, update on public.cp_sessions to anon, authenticated;

-- ---- diagnostics: paste this output back if it still does not work ---------
select policyname, cmd, roles::text, with_check::text
from pg_policies
where schemaname = 'public' and tablename = 'cp_sessions'
order by policyname;
