-- ============================================================================
--  Chasing P1 — session log
--  Paste into the Supabase SQL editor and run once.
--
--  One row per play session, inserted when a career starts and updated in
--  place as the session goes on. Same trust model as the other games in this
--  repo: RLS on, anon insert/update allowed, no auth.
--
--  PERSONAL DATA: `ip`, `city` and `country` are personal data under GDPR.
--  Fine for a private project. If this ever goes public, add a privacy note —
--  or drop the ip column and keep country only.
-- ============================================================================

create table if not exists public.cp_sessions (
  session_id      uuid        primary key,
  created_at      timestamptz not null default now(),
  env             text        not null default 'prod',
  started_at      timestamptz,
  duration_s      integer     not null default 0,

  -- who the player made
  driver_name     text,
  driver_number   integer,
  nationality     text,
  style           text,
  seed            text,          -- reproduces the exact career for debugging

  -- how far they got (best career of the session)
  careers_started   integer not null default 0,
  careers_finished  integer not null default 0,
  reached_f1        boolean not null default false,
  seasons           integer not null default 0,
  titles            integer not null default 0,
  career_title      text,
  career_score      integer not null default 0,

  -- did they share
  shared          boolean not null default false,
  share_result    text,

  -- where from
  ip              text,
  country         text,
  city            text,
  user_agent      text,
  screen          text,
  referrer        text
);

create index if not exists cp_sessions_created_at_idx on public.cp_sessions (created_at desc);
create index if not exists cp_sessions_env_idx        on public.cp_sessions (env);

alter table public.cp_sessions enable row level security;

drop policy if exists cp_sessions_anon_insert on public.cp_sessions;
create policy cp_sessions_anon_insert on public.cp_sessions
  for insert to anon with check (true);

drop policy if exists cp_sessions_anon_update on public.cp_sessions;
create policy cp_sessions_anon_update on public.cp_sessions
  for update to anon using (true) with check (true);

-- Deliberately NO anon select: a visitor can write their own row but cannot
-- read anyone else's. Read the log from the Supabase dashboard.

-- Handy view: the one-line-per-session summary.
create or replace view public.cp_sessions_log as
select
  created_at,
  coalesce(driver_name, '(no career)')                as driver,
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
