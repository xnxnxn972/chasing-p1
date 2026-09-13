-- ============================================================================
--  Chasing P1 — show where the visit came from
--
--  Nothing here changes what is COLLECTED: `referrer` has been a column since
--  the first schema and the client has always written document.referrer into
--  it. It was simply never returned by the admin reader, so you could not see
--  it. This exposes it, plus a derived bucket (search / reddit / facebook /
--  ...) so the common question is one glance rather than a pile of URLs.
--
--  Run this whole file in the Supabase SQL editor. Safe to run more than once.
--
--  NOTE ON THE ERROR YOU'D OTHERWISE HIT: a function's return type cannot be
--  changed by `create or replace` — Postgres raises 42P13 "cannot change
--  return type of existing function". Adding columns therefore means dropping
--  it first, which is why the drop below is not optional.
-- ============================================================================

-- ---- the classifier --------------------------------------------------------
-- Kept as its own function so you can re-bucket traffic later by replacing
-- THIS alone, with no change to the reader and no redeploy of the game.
create or replace function public.cp_traffic_source(p_referrer text, p_meta jsonb)
returns text
language sql
immutable
as $$
  select case
    -- An explicit tag always wins: it is the only signal that survives being
    -- pasted into WhatsApp, and it is the one we control.
    when coalesce(p_meta->>'utm_source', p_meta->>'src') is not null
      then coalesce(p_meta->>'utm_source', p_meta->>'src')

    -- No referrer at all. Typed, bookmarked, or — far more often — opened from
    -- inside an app. Native shares land here, which is why the tag above
    -- matters more than anything in this list.
    when p_referrer is null or p_referrer = '' then 'direct / app'

    when p_referrer ~* '://([a-z0-9-]+\.)*(google|bing|duckduckgo|yahoo|ecosia|brave)\.' then 'search'
    when p_referrer ~* '://([a-z0-9-]+\.)*reddit\.com'            then 'reddit'
    when p_referrer ~* '://(out\.)?reddit\.|://redd\.it'          then 'reddit'
    when p_referrer ~* '://([a-z0-9-]+\.)*(facebook|fb)\.'        then 'facebook'
    when p_referrer ~* '://([a-z0-9-]+\.)*instagram\.'            then 'instagram'
    when p_referrer ~* '://([a-z0-9-]+\.)*(twitter|x)\.com|://t\.co' then 'twitter/x'
    when p_referrer ~* '://([a-z0-9-]+\.)*linkedin\.|://lnkd\.in' then 'linkedin'
    when p_referrer ~* '://([a-z0-9-]+\.)*(whatsapp|wa\.me)'      then 'whatsapp'
    when p_referrer ~* '://([a-z0-9-]+\.)*(telegram|t\.me)'       then 'telegram'
    when p_referrer ~* '://([a-z0-9-]+\.)*(youtube|youtu\.be)'    then 'youtube'
    when p_referrer ~* '://([a-z0-9-]+\.)*tiktok\.'               then 'tiktok'
    when p_referrer ~* '://([a-z0-9-]+\.)*(github|githubusercontent)\.' then 'github'
    when p_referrer ~* '://([a-z0-9-]+\.)*news\.ycombinator\.com' then 'hacker news'

    -- Our own pages referring to themselves: a reload or an internal link.
    when p_referrer ~* '://xnxnxn972\.github\.io' then 'internal'

    -- Everything else: keep the host so you can see what it was and decide
    -- whether it deserves a bucket of its own.
    else coalesce(substring(p_referrer from '://([^/:?#]+)'), 'other')
  end;
$$;

-- ---- the reader, with two new columns --------------------------------------
drop function if exists public.cp_sessions_admin(text, int, boolean);

create function public.cp_sessions_admin(
  p_token       text,
  p_limit       int     default 200,
  p_include_ip  boolean default false
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
  order by s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 2000));
end;
$$;

grant execute on function public.cp_sessions_admin(text, int, boolean) to anon, authenticated;

-- ---- what you already have -------------------------------------------------
-- Every row ever written already carries a referrer. This shows the split.
select
  public.cp_traffic_source(referrer, coalesce(meta, '{}'::jsonb)) as source,
  count(*)                                  as careers,
  count(distinct visit_id)                  as visits,
  count(*) filter (where careers_finished > 0) as finished
from public.cp_sessions
group by 1
order by careers desc;
