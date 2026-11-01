-- ============================================================================
--  Chasing P1 — show the red flag in the admin view
--
--  WHY: the client has been writing three keys into cp_sessions.meta since the
--  red flag shipped (31 Oct 2026) and NOTHING COULD READ THEM. cp_sessions_admin
--  does not return meta; it flattens a fixed list of named keys into columns,
--  so anything not on that list is invisible to every report we have. A probe
--  that reads `row.meta` gets undefined and reports a confident zero — which is
--  exactly what happened on 1 Nov before the row's real keys were dumped. This
--  is the third time a field-name assumption has produced a wrong number on
--  this project, so: check the keys, then believe the query.
--
--    red_flags        how many red flags this CAREER has had. Null, not zero,
--                     on a career that ended before its season came round —
--                     "never got there" and "got there and nothing happened"
--                     are different facts and must not collapse into one.
--    red_flag_seen    the situations, in order, joined by " · ". The second
--                     name is the deferred consequence, not a second board.
--    red_flag_thread  true once a consequence has come back for an earlier
--                     choice, which is the thing the mechanic exists to do.
--
--  The columns are appended before geo_country, with the other meta-derived
--  fields. PostgREST returns objects keyed by name so nothing reads these by
--  position, but keep ip last: it stays the opt-in field.
--
--  The table is unchanged. Safe to run repeatedly.
--
--  RUN THIS FILE ON ITS OWN. The Supabase SQL editor runs a pasted script as
--  one transaction, so an error anywhere rolls back the function with it and
--  leaves no trace of what failed. The reporting queries are in
--  supabase-redflag-report.sql for that reason.
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
  red_flags       int,
  red_flag_seen   text,
  red_flag_thread boolean,
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
    -- Deliberately NOT coalesced to 0: null means the career never got there.
    (s.meta->>'red_flags')::int,
    s.meta->>'red_flag_seen',
    (s.meta->>'red_flag_thread')::boolean,
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
