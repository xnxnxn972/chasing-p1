-- ============================================================================
--  Chasing P1 — let the reader page past 2,000 rows
--
--  THE BUG: cp_sessions_admin ends with
--      limit greatest(1, least(coalesce(p_limit, 200), 2000))
--  so the function itself never returns more than the newest 2,000 careers.
--  PostgREST's `offset` pages WITHIN that 2,000 and then runs out, which looks
--  exactly like reaching the end of the table. The log passed 2,000 careers on
--  day two and the dashboard quietly started missing launch morning — the
--  oldest reachable row was 10:03 on the 13th, and the first 85 minutes of the
--  Reddit post had silently dropped out of every chart.
--
--  Two changes:
--   * the ceiling goes to 50,000, so this does not bite again for a long time
--   * a `p_before` cursor is added, which pages by timestamp rather than by
--     offset and therefore cannot be defeated by ANY row cap
--
--  A function's return type and signature cannot be changed by `create or
--  replace` (42P13), so the drop is required. Safe to run more than once.
-- ============================================================================

drop function if exists public.cp_sessions_admin(text, int, boolean);

create function public.cp_sessions_admin(
  p_token       text,
  p_limit       int         default 200,
  p_include_ip  boolean     default false,
  -- Return only careers older than this. Pass the created_at of the oldest row
  -- you already have to fetch the next page back in time.
  p_before      timestamptz default null
)
returns table (
  created_at    timestamptz,
  player        text,
  source        text,
  referrer      text,
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
    public.cp_traffic_source(s.referrer, coalesce(s.meta, '{}'::jsonb)),
    s.referrer,
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
  where p_before is null or s.created_at < p_before
  order by s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 50000));
end;
$$;

grant execute on function public.cp_sessions_admin(text, int, boolean, timestamptz) to anon, authenticated;

-- ---- how much was being hidden ---------------------------------------------
select
  count(*)                                        as careers_total,
  greatest(0, count(*) - 2000)                    as careers_that_were_invisible,
  min(created_at)                                 as oldest,
  max(created_at)                                 as newest
from public.cp_sessions;
