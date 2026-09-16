-- ============================================================================
--  Chasing P1 — count the people who arrive and never touch anything
--
--  WHY A SEPARATE TABLE: cp_sessions deliberately writes nothing until the
--  visitor clicks, types or starts a career. That rule exists because crawlers
--  once filled the log — nineteen rows in twenty-one never touched anything —
--  and it must not be relaxed, or the careers data becomes untrustworthy again.
--
--  The cost was that the front page could not be measured at all. "94% of
--  visitors start a career" was really "94% of people who already interacted
--  went on to start one", which cannot answer whether the opening screen is
--  losing people. Somebody who lands and leaves was invisible.
--
--  So loads are counted HERE, apart from the careers, and joined on visit_id:
--
--     bounced = a row in cp_loads whose visit_id never reached cp_sessions
--
--  Crawler noise lands in this table by design. It is filtered at READ time
--  rather than dropped at write time — `webdriver` and the user agent are
--  recorded so a bot can be excluded, and so the decision stays reversible.
--  Dropping rows at write time is how the original blind spot was created.
--
--  Country comes from the request, exactly as cp_sessions does it: no IP is
--  read or stored, and the client cannot set it. Safe to run more than once.
-- ============================================================================

create table if not exists public.cp_loads (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  visit_id    text,
  referrer    text,
  device      text,
  platform    text,
  screen      text,
  app_version text,
  country     text,
  webdriver   boolean,
  meta        jsonb not null default '{}'::jsonb
);

create index if not exists cp_loads_created_at_idx on public.cp_loads (created_at desc);
create index if not exists cp_loads_visit_id_idx   on public.cp_loads (visit_id);

alter table public.cp_loads enable row level security;

-- No policies: the anon role reaches this table only through the security
-- definer function below, and reads only through the admin RPC.

create or replace function public.cp_log_load(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p is null or (p->>'visit_id') is null then
    return;
  end if;

  -- One row per visit. A reload is a new visit_id and so a new load, which is
  -- what we want; a double-fire within one page is not.
  if exists (select 1 from public.cp_loads l where l.visit_id = p->>'visit_id') then
    return;
  end if;

  insert into public.cp_loads (
    visit_id, referrer, device, platform, screen, app_version, country, webdriver, meta
  ) values (
    p->>'visit_id',
    left(p->>'referrer', 300),
    p->>'device',
    p->>'platform',
    p->>'screen',
    p->>'app_version',
    public.cp_request_country(),
    (p->>'webdriver')::boolean,
    coalesce(p->'meta', '{}'::jsonb)
  );
end;
$$;

grant execute on function public.cp_log_load(jsonb) to anon, authenticated;

-- ---- the reader ------------------------------------------------------------
create or replace function public.cp_loads_admin(
  p_token text,
  p_limit int default 5000,
  p_before timestamptz default null
)
returns table (
  created_at  timestamptz,
  visit_id    text,
  source      text,
  referrer    text,
  device      text,
  platform    text,
  country     text,
  app_version text,
  webdriver   boolean,
  engaged     boolean,
  started     boolean
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
    l.created_at,
    l.visit_id,
    public.cp_traffic_source(l.referrer, coalesce(l.meta, '{}'::jsonb)),
    l.referrer,
    l.device,
    l.platform,
    l.country,
    l.app_version,
    l.webdriver,
    exists (select 1 from public.cp_sessions s where s.visit_id = l.visit_id),
    exists (select 1 from public.cp_sessions s
            where s.visit_id = l.visit_id and s.driver_name is not null)
  from public.cp_loads l
  where p_before is null or l.created_at < p_before
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5000), 50000));
end;
$$;

grant execute on function public.cp_loads_admin(text, int, timestamptz) to anon, authenticated;
