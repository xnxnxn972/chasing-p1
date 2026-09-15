-- ============================================================================
--  Chasing P1 — teach the traffic classifier about the new domain
--
--  The game now lives at playchasingp1.com. cp_traffic_source only knew about
--  xnxnxn972.github.io, so a visitor moving between our own pages would be
--  classified by the raw-host fallback and appear as a REFERRAL from
--  "playchasingp1.com" — a site referring itself, counted as acquisition.
--
--  Both hosts are treated as internal: the github.io URL still 301s to the new
--  domain and will keep appearing in the log for as long as links shared on
--  Reddit keep being opened.
--
--  Only this one function changes, and the reader calls it per row, so every
--  historical row is re-classified the moment this runs. Safe to run repeatedly.
-- ============================================================================

create or replace function public.cp_traffic_source(p_referrer text, p_meta jsonb)
returns text
language sql
immutable
as $$
  select case
    -- An explicit tag always wins: it is the only signal that survives being
    -- pasted into WhatsApp, and it is the one we control. It is also how
    -- ChatGPT referrals are visible at all — it appends utm_source=chatgpt.com
    -- and sends no referrer.
    when coalesce(p_meta->>'utm_source', p_meta->>'src') is not null
      then coalesce(p_meta->>'utm_source', p_meta->>'src')

    when p_referrer is null or p_referrer = '' then 'direct / app'

    -- ---- our own pages, old host and new -----------------------------------
    when p_referrer ~* '://([a-z0-9-]+\.)*playchasingp1\.com' then 'internal'
    when p_referrer ~* '://xnxnxn972\.github\.io'             then 'internal'

    -- ---- native apps, by package name --------------------------------------
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
        else 'app: ' || coalesce(substring(p_referrer from 'android-app://([^/]+)'), '?')
      end

    -- ---- the web -----------------------------------------------------------
    when p_referrer ~* '://([a-z0-9-]+\.)*(google|bing|duckduckgo|yahoo|ecosia|brave)\.' then 'search'
    when p_referrer ~* '://([a-z0-9-]+\.)*reddit\.com'            then 'reddit'
    when p_referrer ~* '://(out\.)?reddit\.|://redd\.it'          then 'reddit'
    when p_referrer ~* '://([a-z0-9-]+\.)*(chatgpt|openai)\.'     then 'chatgpt.com'
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
    else coalesce(substring(p_referrer from '://([^/:?#]+)'), 'other')
  end;
$$;

-- ---- what changed ----------------------------------------------------------
select
  public.cp_traffic_source(referrer, coalesce(meta, '{}'::jsonb)) as source,
  count(distinct visit_id)                                       as visits,
  count(*)                                                       as careers
from public.cp_sessions
group by 1
order by visits desc;
