-- ============================================================================
--  Chasing P1 — keep our own testing out of the page-load numbers
--
--  WHAT WENT WRONG: 29 of the first 63 rows in cp_loads were mine. Verifying a
--  deploy means loading the production URL repeatedly, and those loads carry no
--  referrer — so the referrer-based dev filter that keeps the careers dashboard
--  clean could not see them at all. Every one counted as a visitor who arrived
--  and bounced, which took the measured bounce rate from 38% to 59%.
--
--  The client now opts out permanently: playchasingp1.com/?dev=1 sets a flag in
--  localStorage and nothing from that browser is ever written again. That fixes
--  it going forward. This file deals with the rows already written.
--
--  MARKED, NOT DELETED. The predicate below is a judgement, not a fact — it
--  cannot distinguish my testing from a real visitor in the same country who
--  happened to bounce in the same hours. Marking is reversible and leaves the
--  evidence in place; deleting would quietly destroy a handful of genuine rows
--  and there would be no way to tell afterwards.
--
--  Rows that ENGAGED are excluded from the marking regardless: I never started
--  a career on the live site, so anything that did is somebody real.
-- ============================================================================

alter table public.cp_loads add column if not exists dev boolean not null default false;

-- ---- mark the testing window -----------------------------------------------
-- Israel, today, never reached cp_sessions. Adjust the window if you tested
-- from elsewhere; leave it alone if you did not.
update public.cp_loads l
set dev = true
where l.country = 'IL'
  and l.created_at >= timestamptz '2026-09-16 10:00:00+00'
  and not exists (select 1 from public.cp_sessions s where s.visit_id = l.visit_id);

-- ---- expose it to the reader -----------------------------------------------
drop function if exists public.cp_loads_admin(text, int, timestamptz);

create function public.cp_loads_admin(
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
