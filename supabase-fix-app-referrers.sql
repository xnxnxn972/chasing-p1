-- ============================================================================
--  Chasing P1 — bucket native-app referrers properly
--
--  THE BUG: the Reddit Android app sends
--      android-app://com.reddit.frontpage/
--  and every pattern in the first classifier looked for a WEB host such as
--  "reddit.com". A package name is not a hostname, so none of them matched and
--  the referrer fell through to the host-extraction fallback — which happily
--  returned "com.reddit.frontpage" as if it were a source. 72 visits sat in a
--  bucket named after an Android package.
--
--  Any other app would have hit exactly the same fall-through, so this checks
--  the android-app:// scheme FIRST and maps the package, rather than adding
--  one special case for Reddit and waiting for the next one.
--
--  Only cp_traffic_source changes. The reader calls it per row rather than
--  storing its result, so this re-labels ALL HISTORY the moment it runs — no
--  backfill, no redeploy of the game. That was the point of splitting it out.
--
--  Safe to run more than once.
-- ============================================================================

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

    when p_referrer is null or p_referrer = '' then 'direct / app'

    -- ---- native apps, by package name --------------------------------------
    -- Checked before the web patterns because a package name looks nothing
    -- like a hostname and would otherwise fall through to the raw-host branch.
    when p_referrer like 'android-app://%' then
      case
        when p_referrer like '%com.reddit%'                     then 'reddit'
        when p_referrer like '%googlequicksearchbox%'
          or p_referrer like '%com.google.android.gms%'          then 'search'
        when p_referrer like '%com.facebook%'                    then 'facebook'
        when p_referrer like '%com.instagram%'                   then 'instagram'
        when p_referrer like '%com.twitter%'
          or p_referrer like '%com.x.android%'                   then 'twitter/x'
        when p_referrer like '%com.whatsapp%'                    then 'whatsapp'
        when p_referrer like '%org.telegram%'                    then 'telegram'
        when p_referrer like '%com.linkedin%'                    then 'linkedin'
        when p_referrer like '%com.discord%'                     then 'discord'
        when p_referrer like '%android.youtube%'                 then 'youtube'
        when p_referrer like '%com.zhiliaoapp.musically%'
          or p_referrer like '%com.ss.android.ugc%'              then 'tiktok'
        when p_referrer like '%com.google.android.gm%'           then 'email'
        -- Unknown app: keep the package, but say plainly that it is an app so
        -- it can never again be mistaken for a website.
        else 'app: ' || coalesce(substring(p_referrer from 'android-app://([^/]+)'), '?')
      end

    -- ---- the web -----------------------------------------------------------
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
    when p_referrer ~* '://([a-z0-9-]+\.)*discord\.'              then 'discord'
    when p_referrer ~* '://([a-z0-9-]+\.)*(github|githubusercontent)\.' then 'github'
    when p_referrer ~* '://([a-z0-9-]+\.)*news\.ycombinator\.com' then 'hacker news'
    when p_referrer ~* '://xnxnxn972\.github\.io'                 then 'internal'
    else coalesce(substring(p_referrer from '://([^/:?#]+)'), 'other')
  end;
$$;

-- ---- proof it worked -------------------------------------------------------
-- The Android app should now be inside `reddit`, and no bucket should be named
-- after a package. `via` keeps app and web separable without splitting them.
select
  public.cp_traffic_source(referrer, coalesce(meta, '{}'::jsonb)) as source,
  case
    when referrer like 'android-app://%' then 'native app'
    when referrer is null or referrer = '' then '-'
    else 'web'
  end                                       as via,
  count(distinct visit_id)                  as visits,
  count(*)                                  as careers,
  count(*) filter (where careers_finished > 0) as finished
from public.cp_sessions
group by 1, 2
order by visits desc;
