-- ============================================================================
--  Chasing P1 — country without asking the browser anything
--
--  The client used to fetch https://ipwho.is/ on load to learn its own IP,
--  country and city. Google Safe Browsing read that as a page harvesting
--  personal information and blocked the site. The call is gone and is not
--  coming back.
--
--  The country can still be known, because it already arrives with every
--  request: Supabase sits behind Cloudflare, which stamps `cf-ipcountry` on
--  the connection, and PostgREST exposes request headers to SQL. So the value
--  is read HERE, server-side, at the moment the row is written.
--
--  Why this is safe where the old way was not:
--    * the browser makes no extra request and nothing changes on the page, so
--      there is nothing new for a classifier to see
--    * no IP address is ever stored, or even read into a variable
--    * a two-letter country code is not personal data — it cannot identify
--      anybody — where an IP address plainly is
--    * the client cannot set it, so it cannot be spoofed by editing a request
--
--  New rows store the CODE ("GB"). Historical rows hold full names
--  ("United Kingdom") from the old lookup. The dashboard expands codes to names
--  so the two read as one list.
--
--  Safe to run more than once.
-- ============================================================================

-- ---- what the connection actually tells us ---------------------------------
-- Returns null rather than failing when the header is absent, so a change of
-- infrastructure degrades to "no country" instead of breaking every write.
create or replace function public.cp_request_country()
returns text
language plpgsql
stable
as $$
declare
  h jsonb;
  c text;
begin
  begin
    h := current_setting('request.headers', true)::jsonb;
  exception when others then
    return null;
  end;
  if h is null then return null; end if;

  -- Cloudflare's is the one that will be present here; the others cost nothing
  -- and mean this keeps working if the edge ever changes.
  c := coalesce(
    h->>'cf-ipcountry',
    h->>'x-vercel-ip-country',
    h->>'x-country-code',
    h->>'fly-client-country'
  );

  -- "XX" and "T1" are Cloudflare's own placeholders for unknown and for Tor.
  if c is null or c in ('XX', 'T1', '') then return null; end if;
  return upper(left(c, 2));
end;
$$;

-- ---- write it on the way in ------------------------------------------------
create or replace function public.cp_log_session(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.cp_sessions;
  req_country text;
begin
  if p is null or (p->>'session_id') is null then
    raise exception 'session_id required';
  end if;

  r := jsonb_populate_record(null::public.cp_sessions, p);
  req_country := public.cp_request_country();

  insert into public.cp_sessions as s (
    session_id, visit_id, career_index, env, started_at, duration_s,
    driver_name, driver_number, nationality, style, seed,
    careers_started, careers_finished, reached_f1, seasons, titles,
    career_title, career_score, shared, share_result,
    ip, country, city, user_agent, screen, referrer,
    device, platform, app_version, meta, last_activity_at
  ) values (
    r.session_id, r.visit_id, r.career_index, coalesce(r.env, 'prod'),
    r.started_at, coalesce(r.duration_s, 0),
    r.driver_name, r.driver_number, r.nationality, r.style, r.seed,
    coalesce(r.careers_started, 0), coalesce(r.careers_finished, 0),
    coalesce(r.reached_f1, false), coalesce(r.seasons, 0), coalesce(r.titles, 0),
    r.career_title, coalesce(r.career_score, 0),
    coalesce(r.shared, false), r.share_result,
    -- IP and city are no longer collected at all. Country comes from the
    -- request, never from the payload: a client must not be able to set it.
    null, req_country, null,
    r.user_agent, r.screen, r.referrer,
    r.device, r.platform, r.app_version, coalesce(r.meta, '{}'::jsonb), now()
  )
  on conflict (session_id) do update set
    visit_id         = coalesce(excluded.visit_id, s.visit_id),
    career_index     = coalesce(excluded.career_index, s.career_index),
    duration_s       = greatest(excluded.duration_s, s.duration_s),
    driver_name      = coalesce(excluded.driver_name, s.driver_name),
    driver_number    = coalesce(excluded.driver_number, s.driver_number),
    nationality      = coalesce(excluded.nationality, s.nationality),
    style            = coalesce(excluded.style, s.style),
    seed             = coalesce(excluded.seed, s.seed),
    careers_started  = greatest(excluded.careers_started, s.careers_started),
    careers_finished = greatest(excluded.careers_finished, s.careers_finished),
    reached_f1       = s.reached_f1 or excluded.reached_f1,
    seasons          = greatest(excluded.seasons, s.seasons),
    titles           = greatest(excluded.titles, s.titles),
    career_title     = coalesce(excluded.career_title, s.career_title),
    career_score     = greatest(excluded.career_score, s.career_score),
    shared           = s.shared or excluded.shared,
    share_result     = coalesce(excluded.share_result, s.share_result),
    -- Keep whatever the first write established; never overwrite with null.
    country          = coalesce(s.country, req_country),
    user_agent       = coalesce(excluded.user_agent, s.user_agent),
    screen           = coalesce(excluded.screen, s.screen),
    referrer         = coalesce(excluded.referrer, s.referrer),
    device           = coalesce(excluded.device, s.device),
    platform         = coalesce(excluded.platform, s.platform),
    app_version      = coalesce(excluded.app_version, s.app_version),
    meta             = s.meta || excluded.meta,
    last_activity_at = now();
end;
$$;

grant execute on function public.cp_log_session(jsonb) to anon, authenticated;
grant execute on function public.cp_request_country() to anon, authenticated;

-- ---- DIAGNOSTIC ------------------------------------------------------------
-- Run in the SQL editor this returns null, because the editor is not a browser
-- request and carries no such header. That is expected and proves nothing.
-- The real check is the dashboard: careers logged from now on should carry a
-- two-letter country. If they stay empty after real traffic, paste me the
-- output of this and we will find which header the edge is actually setting.
select
  public.cp_request_country()                                  as country_now,
  coalesce(current_setting('request.headers', true), '(none)') as raw_headers;
