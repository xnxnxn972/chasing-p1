-- ============================================================================
--  Chasing P1 — write the session log through a function, not a PATCH
--
--  THE BUG THIS FIXES: the log has an UPDATE policy but no SELECT policy, on
--  purpose, so visitors cannot read it. But `UPDATE ... WHERE session_id = x`
--  has to FIND the row first, and with no SELECT policy the row is invisible —
--  so every PATCH matched zero rows and returned 204 as if it had worked.
--  Every progress, career-end, share and page-hide write was silently lost;
--  only the first INSERT ever landed. That is why session_s was always 0.
--
--  Rather than open the table up for reading, the client now calls this
--  security-definer function, which runs as the owner and bypasses RLS.
--
--  Three things fall out of it for free:
--   * one call for insert AND update — no more insert/patch split
--   * unknown keys in the payload are ignored, so the client can start sending
--     a new field before its column exists
--   * updates are monotonic: a later write can never erase what an earlier one
--     recorded, which matters because writes can arrive out of order
--
--  Safe to run more than once.
-- ============================================================================

create or replace function public.cp_log_session(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.cp_sessions;
begin
  if p is null or (p->>'session_id') is null then
    raise exception 'session_id required';
  end if;

  -- Keys with no matching column are dropped here, which is what makes the
  -- payload forward-compatible with a migration that has not been run yet.
  r := jsonb_populate_record(null::public.cp_sessions, p);

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
    r.ip, r.country, r.city, r.user_agent, r.screen, r.referrer,
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
    ip               = coalesce(excluded.ip, s.ip),
    country          = coalesce(excluded.country, s.country),
    city             = coalesce(excluded.city, s.city),
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

-- The direct table grants are no longer used by the client. Revoking them
-- means the ONLY way in is this function, which is a smaller surface.
revoke insert, update on public.cp_sessions from anon, authenticated;

drop policy if exists cp_sessions_write_insert on public.cp_sessions;
drop policy if exists cp_sessions_write_update on public.cp_sessions;

-- Tidy the probe rows left behind while diagnosing this.
delete from public.cp_sessions where driver_name like '\_\_%' escape '\';

select count(*) as rows_remaining from public.cp_sessions;
