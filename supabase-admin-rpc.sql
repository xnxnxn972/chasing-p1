-- ============================================================================
--  Chasing P1 — token-protected access to individual session rows
--
--  WHY A TOKEN: the anon key is committed publicly in this repo, so any
--  anon-callable function that returned rows would make the whole log
--  world-readable. This function returns nothing without a secret that lives
--  only in your database and wherever you choose to paste it.
--
--  The token is GENERATED HERE, not written into this file, so it never enters
--  version control. The last statement prints it once — copy it somewhere safe.
--  Safe to run more than once; it will not regenerate an existing token.
-- ============================================================================

-- ---- the secret ------------------------------------------------------------
create table if not exists public.cp_admin (
  id          smallint primary key default 1,
  token       text     not null,
  created_at  timestamptz not null default now(),
  constraint cp_admin_single_row check (id = 1)
);

-- RLS on with NO policies at all: unreachable via the REST API by anyone.
-- Only security-definer functions and the dashboard can see it.
alter table public.cp_admin enable row level security;
revoke all on public.cp_admin from anon, authenticated;

-- 64 hex characters from two UUIDs — no extension required.
insert into public.cp_admin (id, token)
values (1, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

-- ---- the reader ------------------------------------------------------------
create or replace function public.cp_sessions_admin(
  p_token       text,
  p_limit       int     default 200,
  p_include_ip  boolean default false
)
returns table (
  created_at    timestamptz,
  player        text,
  device        text,
  platform      text,
  session_s     int,
  active_s      int,
  career_index  int,
  seasons       int,
  last_series   text,
  titles        int,
  career_title  text,
  career_score  int,
  finished      boolean,
  shared        boolean,
  geo_country   text,
  geo_city      text,
  app_version   text,
  seed          text,
  visit_id      text,
  ip            text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null
     or p_token <> (select t.token from public.cp_admin t where t.id = 1) then
    raise exception 'unauthorized';
  end if;

  return query
  select
    s.created_at,
    case
      when s.driver_name is null then '(no career started)'
      else s.driver_name
           || coalesce(' #' || s.driver_number::text, '')
           || coalesce(' (' || s.nationality || ')', '')
    end,
    s.device,
    s.platform,
    greatest(0, extract(epoch from (s.last_activity_at - s.created_at)))::int,
    coalesce((s.meta->>'active_s')::int, 0),
    s.career_index,
    s.seasons,
    coalesce(s.meta->>'last_series', '-'),
    s.titles,
    s.career_title,
    s.career_score,
    s.careers_finished > 0,
    s.shared,
    s.country,
    s.city,
    s.app_version,
    s.seed,
    s.visit_id,
    -- IP is the highest-risk field, so it is opt-in even with a valid token.
    case when p_include_ip then s.ip else null end
  from public.cp_sessions s
  order by s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 2000));
end;
$$;

grant execute on function public.cp_sessions_admin(text, int, boolean) to anon, authenticated;

-- ---- your token — copy it, keep it out of the repo -------------------------
select token as your_admin_token from public.cp_admin where id = 1;
