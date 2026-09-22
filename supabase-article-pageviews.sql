-- ============================================================================
--  Chasing P1 — see the article pages
--
--  WHY: the three content pages are static HTML with no telemetry at all, so a
--  reader who arrives from Google, reads 2,000 words and leaves is completely
--  invisible. Search Console shows impressions and clicks for the whole site;
--  it cannot say which article was read, or whether anybody went on to play.
--
--  The beacon reuses cp_log_load rather than adding a second table, because the
--  shape is identical: one row per page load, joined to cp_sessions by
--  visit_id to see whether the reader became a player.
--
--  THE ONE DANGER, and the reason `page` is a real column rather than a key in
--  meta: an article view's visit_id never reaches cp_sessions, so it looks like
--  a bounce. Left undistinguished it would quietly drag the game's bounce rate
--  down for ever — the same class of contamination as our own dev traffic did.
--  Existing rows default to '/', so every game load already recorded stays
--  correct, and any analysis of the GAME must filter `page = '/'`.
--
--  Safe to run more than once.
-- ============================================================================

alter table public.cp_loads add column if not exists page text not null default '/';

create index if not exists cp_loads_page_idx on public.cp_loads (page);

-- ---- accept the page on the way in -----------------------------------------
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

  if exists (select 1 from public.cp_loads l where l.visit_id = p->>'visit_id') then
    return;
  end if;

  insert into public.cp_loads (
    visit_id, referrer, device, platform, screen, app_version, country, webdriver, page, meta
  ) values (
    p->>'visit_id',
    left(p->>'referrer', 300),
    p->>'device',
    p->>'platform',
    p->>'screen',
    p->>'app_version',
    public.cp_request_country(),
    (p->>'webdriver')::boolean,
    -- Anything the client does not send is the game itself, which is what every
    -- row written before this migration was.
    coalesce(nullif(left(p->>'page', 120), ''), '/'),
    coalesce(p->'meta', '{}'::jsonb)
  );
end;
$$;

grant execute on function public.cp_log_load(jsonb) to anon, authenticated;

-- ---- return it to the reader -----------------------------------------------
drop function if exists public.cp_loads_admin(text, int, timestamptz);

create function public.cp_loads_admin(
  p_token text,
  p_limit int default 5000,
  p_before timestamptz default null
)
returns table (
  created_at  timestamptz,
  visit_id    text,
  page        text,
  source      text,
  referrer    text,
  device      text,
  platform    text,
  country     text,
  app_version text,
  webdriver   boolean,
  dev         boolean,
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
    l.page,
    public.cp_traffic_source(l.referrer, coalesce(l.meta, '{}'::jsonb)),
    l.referrer,
    l.device,
    l.platform,
    l.country,
    l.app_version,
    l.webdriver,
    l.dev,
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

-- ---- what this will answer -------------------------------------------------
-- Article readers cannot be joined to a game visit, because clicking through
-- starts a new one. The read-to-play signal is the referrer on the GAME side:
-- a cp_sessions row whose referrer is one of our own article URLs.
select
  l.page,
  count(*)                                              as views,
  count(*) filter (where l.dev)                         as ours,
  count(distinct l.country)                             as countries
from public.cp_loads l
group by 1
order by views desc;
