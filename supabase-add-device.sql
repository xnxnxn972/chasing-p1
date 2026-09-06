-- ============================================================================
--  Chasing P1 — add device / platform to the session log
--  Run this in the Supabase SQL editor. Safe to run more than once.
-- ============================================================================

alter table public.cp_sessions add column if not exists device   text;  -- mobile | tablet | desktop
alter table public.cp_sessions add column if not exists platform text;  -- iOS | Android | Windows | macOS | Linux | ChromeOS

-- Rebuild the readable view so the new columns show up in it.
create or replace view public.cp_sessions_log as
select
  created_at,
  coalesce(driver_name, '(no career)')                as driver,
  device,
  platform,
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
  seed
from public.cp_sessions
order by created_at desc;

select * from cp_sessions_log limit 20;
