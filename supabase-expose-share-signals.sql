-- ============================================================================
--  Chasing P1 — expose the two signals needed to judge the share prompt
--
--  WHY: the share prompt's effect could only be estimated by rebuilding its
--  conditions from the log and comparing across BUILDS — which confounds it
--  with everything else that shipped the same day. Two columns fix that:
--
--   * share_result  — the OUTCOME of a share. `shared` is set the moment the
--                     sheet opens, so on its own it cannot separate a completed
--                     share from a cancelled one. This column has always been
--                     written; it was simply never returned.
--
--   * prompt_shown  — whether the prompt was actually put in front of the
--                     player, from meta. With it, prompted and unprompted
--                     careers can be compared INSIDE one build, where nothing
--                     else differs.
--
--  Also returns prompt_score, so a prompted career's size is visible without
--  re-deriving it.
--
--  A function's return type cannot be changed by `create or replace` (42P13),
--  so the drop is required. Keeps the p_before cursor from the previous
--  migration — do not lose it, or the reader silently truncates again.
--  Safe to run more than once.
-- ============================================================================

drop function if exists public.cp_sessions_admin(text, int, boolean, timestamptz);

create function public.cp_sessions_admin(
  p_token       text,
  p_limit       int         default 200,
  p_include_ip  boolean     default false,
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
  share_result  text,
  prompt_shown  boolean,
  prompt_score  int,
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
    s.share_result,
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

-- ---- what share_result has been recording all along ------------------------
select
  coalesce(share_result, '(never opened the sheet)') as outcome,
  count(*)                                          as careers
from public.cp_sessions
where careers_finished > 0
group by 1
order by careers desc;
