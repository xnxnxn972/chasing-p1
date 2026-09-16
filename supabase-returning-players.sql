-- ============================================================================
--  Chasing P1 — tell a returning player from a new one
--
--  WHY: until now `visit_id` was generated fresh on every page load and nothing
--  persisted it, so somebody who closed the tab and came back an hour later was
--  indistinguishable from a stranger. Retention was not bad — it was UNMEASURED.
--  "Nobody returns" and "we cannot see anybody return" produced identical logs.
--
--  The client now keeps a random id in localStorage and sends it with every
--  row, along with how many visits and careers that browser has behind it:
--
--    player_id       random, opaque, per BROWSER. Not a person, not a login,
--                    and it holds nothing anybody typed into the game.
--    player_visits   page loads by this browser, counting this one.
--    player_careers  careers started by this browser before this one.
--    first_seen      the date of its first visit, which is what makes
--                    "returning" mean something other than "has a record".
--    storage         false in a private window or with site data blocked.
--                    Those rows CANNOT be de-duplicated and must be excluded
--                    from a return rate rather than counted as new players,
--                    or the measurement is biased downwards by its own blind
--                    spot.
--
--    player_streak   consecutive days this browser has started a career on.
--                    Every career still gets its own random seed; the streak
--                    counts days, not shared puzzles.
--
--  All of these live in meta, so the table is unchanged. Safe to run repeatedly.
--
--  RUN THIS FILE ON ITS OWN. The Supabase SQL editor executes a pasted script
--  as a single transaction, so an error anywhere rolls back everything above
--  it — including this function — and leaves no trace of what failed. The
--  reporting queries that used to live at the bottom of this file are now in
--  supabase-returning-report.sql for exactly that reason.
-- ============================================================================

drop function if exists public.cp_sessions_admin(text, int, boolean, timestamptz);

create function public.cp_sessions_admin(
  p_token       text,
  p_limit       int         default 200,
  p_include_ip  boolean     default false,
  p_before      timestamptz default null
)
returns table (
  created_at      timestamptz,
  player          text,
  source          text,
  referrer        text,
  device          text,
  platform        text,
  session_s       int,
  active_s        int,
  career_index    int,
  seasons         int,
  last_series     text,
  titles          int,
  career_title    text,
  career_score    int,
  finished        boolean,
  shared          boolean,
  share_result    text,
  share_path      text,
  share_render_ms int,
  share_sheet_ms  int,
  share_attempts  int,
  prompt_shown    boolean,
  prompt_score    int,
  player_id       text,
  player_visits   int,
  player_careers  int,
  first_seen      text,
  storage_ok      boolean,
  player_streak   int,
  geo_country     text,
  geo_city        text,
  app_version     text,
  seed            text,
  visit_id        text,
  ip              text
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
    s.share_result,
    s.meta->>'share_path',
    (s.meta->>'share_render_ms')::int,
    (s.meta->>'share_sheet_ms')::int,
    (s.meta->>'share_attempts')::int,
    coalesce((s.meta->>'prompt_shown')::boolean, false),
    coalesce((s.meta->>'prompt_score')::int, 0),
    s.meta->>'player_id',
    (s.meta->>'player_visits')::int,
    (s.meta->>'player_careers')::int,
    s.meta->>'first_seen',
    (s.meta->>'storage')::boolean,
    (s.meta->>'player_streak')::int,
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
