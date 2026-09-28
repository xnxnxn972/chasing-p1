-- ============================================================================
--  Chasing P1 — return `screen` from the loads reader
--
--  WHY: 25-27 September, engagement on the game page fell from 74.3% to 51.4%
--  while the share of arrivals that never touched anything rose sharply. The
--  drop was NOT the mobile layout: the "loaded, interacted, never named a
--  driver" rate held flat at 2.9% -> 2.7%, and referred traffic on the same
--  layout converted BETTER (78.3% -> 86.7%). The whole move sits in one
--  cohort: no-referrer, mostly mobile, US and Italy, zero engagement, some of
--  them running builds several days stale.
--
--  Every column that could identify them is already returned except one. The
--  beacon has always sent `screen` and cp_loads has always stored it, but
--  cp_loads_admin never returned it, so it has never been looked at. Emulated
--  and headless clients cluster hard on a handful of viewport sizes where real
--  phones spread across dozens, so this is the cheapest remaining test.
--
--  Only the reader changes. No data is written, nothing is recomputed, and
--  every existing caller keeps working because the column is appended to the
--  end of the return type rather than inserted into it.
--
--  Safe to run more than once.
-- ============================================================================

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
  started     boolean,
  screen      text
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
            where s.visit_id = l.visit_id and s.driver_name is not null),
    l.screen
  from public.cp_loads l
  where p_before is null or l.created_at < p_before
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5000), 50000));
end;
$$;

grant execute on function public.cp_loads_admin(text, int, timestamptz) to anon, authenticated;

-- ---- what this will answer -------------------------------------------------
-- If the non-engaging cohort is automation, its screen sizes will pile up on a
-- few exact values. If it is real people, they will look like the rest of the
-- mobile traffic.
select
  coalesce(l.screen, '(none)') as screen,
  count(*)                                                as loads,
  count(*) filter (where not exists (
    select 1 from public.cp_sessions s where s.visit_id = l.visit_id
  ))                                                      as never_engaged,
  count(distinct l.country)                               as countries
from public.cp_loads l
where l.page = '/' and not l.dev and not l.webdriver
  and l.created_at >= '2026-09-25'
group by 1
order by loads desc;
