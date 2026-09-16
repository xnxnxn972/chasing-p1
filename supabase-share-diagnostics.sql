-- ============================================================================
--  Chasing P1 — why mobile opens the share sheet and then backs out
--
--  WHY: mobile is 72% of players and completes a share 6.4% of the time,
--  against desktop's 10.3% — backwards, because mobile is the platform with
--  the native share sheet. Mobile also cancels: 16 of 90 mobile share actions,
--  against zero on desktop.
--
--  `share_result` cannot say why, because two different failures look the same
--  in it. Either the card takes too long to build and the sheet arrives after
--  the player has given up on it, or the sheet arrives promptly and they
--  decline it. Those need opposite fixes — one is a rendering problem, the
--  other is a content problem — so the client now records them apart:
--
--    share_path       'native' (the OS sheet) or 'download' (the PNG fallback)
--    share_render_ms  time spent building the 1080x1350 PNG before anything
--                     was shown. This is the suspect: it is a canvas render
--                     with custom fonts, on a phone.
--    share_sheet_ms   how long the sheet stayed open. A fast cancel is a
--                     mis-tap or a sheet that felt wrong; a slow one is a
--                     decision.
--    share_attempts   presses within one career. A cancel followed by another
--                     press is a failed sheet, not a changed mind.
--
--  All four live in meta, so nothing is added to the table — this only returns
--  what is already being written.
--
--  A function's return type cannot be changed by `create or replace` (42P13),
--  so the drop is required. Keeps the p_before cursor — do not lose it, or the
--  dashboard silently truncates again. Safe to run more than once.
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

-- ---- the question this is here to answer -----------------------------------
-- Empty until the next deploy has been live for a few hours. After that: if
-- cancels cluster at high render_ms, the card is too slow on phones. If they
-- cluster at low sheet_ms with render fast, the sheet itself is the problem.
select
  device,
  share_result,
  count(*)                                              as n,
  round(avg((meta->>'share_render_ms')::numeric))       as avg_render_ms,
  round(avg((meta->>'share_sheet_ms')::numeric))        as avg_sheet_ms,
  max((meta->>'share_attempts')::int)                   as max_attempts
from public.cp_sessions
where meta ? 'share_path'
group by 1, 2
order by 1, 3 desc;
