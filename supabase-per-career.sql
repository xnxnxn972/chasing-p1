-- ============================================================================
--  Chasing P1 — one row per career, and server-side session length
--  Run in the Supabase SQL editor. Safe to run more than once.
--
--  Two changes:
--   1. visit_id + career_index. session_id is now unique per CAREER, so three
--      careers in one sitting are three rows; visit_id groups them.
--   2. last_activity_at, maintained by a trigger. Session length is
--      last_activity_at - created_at, both server clocks, so there is no client
--      clock skew and the number stays right even if the final write is lost.
-- ============================================================================

alter table public.cp_sessions add column if not exists visit_id     text;
alter table public.cp_sessions add column if not exists career_index integer;
alter table public.cp_sessions add column if not exists last_activity_at timestamptz not null default now();

create index if not exists cp_sessions_visit_idx on public.cp_sessions (visit_id);

-- Touch last_activity_at on every update, server-side.
create or replace function public.cp_touch_last_activity()
returns trigger language plpgsql as $$
begin
  new.last_activity_at := now();
  return new;
end;
$$;

drop trigger if exists cp_sessions_touch on public.cp_sessions;
create trigger cp_sessions_touch
  before update on public.cp_sessions
  for each row execute function public.cp_touch_last_activity();

-- ---- readable log ---------------------------------------------------------
drop view if exists public.cp_sessions_log;

create view public.cp_sessions_log as
select
  created_at,

  case
    when driver_name is null then '(no career started)'
    else driver_name
         || coalesce(' #' || driver_number::text, '')
         || coalesce(' (' || nationality || ')', '')
  end                                                 as player,

  -- session length, server-side: first write to last activity
  greatest(0, extract(epoch from (last_activity_at - created_at)))::int
                                                      as session_s,
  (meta->>'active_s')::int                            as active_s,

  career_index,
  driver_name,
  driver_number,
  nationality,
  style,

  device,
  platform,
  app_version,

  country                                             as geo_country,
  city                                                as geo_city,

  case when reached_f1 then 'F1' else '—' end         as got_to,
  seasons,
  titles,
  career_title,
  career_score,
  careers_finished                                    as finished,
  shared,
  env,
  seed,
  visit_id,
  meta
from public.cp_sessions
order by created_at desc;

select * from cp_sessions_log limit 20;
