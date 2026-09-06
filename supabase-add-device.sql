-- ============================================================================
--  Chasing P1 — add device / platform to the session log
--  Run this in the Supabase SQL editor. Safe to run more than once.
-- ============================================================================

alter table public.cp_sessions add column if not exists device   text;  -- mobile | tablet | desktop
alter table public.cp_sessions add column if not exists platform text;  -- iOS | Android | Windows | macOS | Linux | ChromeOS

-- Which build wrote the row. Without this, a mix of versions is unreadable.
alter table public.cp_sessions add column if not exists app_version text;

-- The expansion hatch. Anything new goes in here with NO migration and NO
-- deploy coordination: old rows simply lack the key, new ones have it, and
-- queries read it with meta->>'key'. Promote a key to a real column only when
-- it earns an index.
alter table public.cp_sessions add column if not exists meta jsonb not null default '{}'::jsonb;

create index if not exists cp_sessions_meta_idx on public.cp_sessions using gin (meta);

-- Rebuild the readable view so the new columns show up in it.
-- Dropped and recreated, not CREATE OR REPLACE: replacing a view can only
-- append columns, so inserting device/platform mid-list fails with
-- "cannot change name of view column". A view holds no data, so this is safe.
drop view if exists public.cp_sessions_log;
create view public.cp_sessions_log as
select
  created_at,
  coalesce(driver_name, '(no career)')                as driver,
  device,
  platform,
  app_version,
  country,
  city,
  duration_s,
  careers_started,
  careers_finished,
  case when reached_f1 then 'F1' else '—' end         as got_to,
  seasons,
  titles,
  career_title,
  career_score,
  shared,
  env,
  seed,
  meta
from public.cp_sessions
order by created_at desc;

select * from cp_sessions_log limit 20;
