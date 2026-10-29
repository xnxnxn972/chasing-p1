-- ============================================================================
--  Chasing P1 — one visit per SITTING, not per page load
--
--  MUST BE RUN WITH (OR BEFORE) THE DEPLOY THAT PERSISTS visit_id.
--  Without it the minigame and article load counts silently collapse to zero.
--
--  WHY: visit_id used to be minted on every page load. Tracing one UK evening
--  found 61 page loads across 61 distinct visit ids — a single player hopping
--  between the game and /minigames/ logged four "visits" in ten seconds, and
--  one seventy-minute sitting logged seventeen. Every visit-based number was
--  a page-load number wearing the wrong name.
--
--  src/game/telemetry.ts now keeps one visit_id per sitting, across
--  navigation. That breaks ONE assumption baked into cp_log_load:
--
--      if exists (select 1 from cp_loads where visit_id = ...) then return;
--
--  The comment above it read "a reload is a new visit_id and so a new load,
--  which is what we want". That is no longer true. With a persistent visit,
--  only the FIRST page of a sitting would ever be recorded, so somebody who
--  landed on '/' and then opened /minigames/track-recall/ would leave no
--  track-recall row at all — exactly the blind spot cp_loads exists to close.
--
--  The dedup is therefore keyed on (visit_id, page): still one row per page
--  per sitting, so a double-fire within one page is dropped as before, but
--  each distinct page of a sitting is counted.
--
--  WHAT THIS CHANGES IN THE NUMBERS, deliberately:
--    * `arrived` in the game funnel becomes "sittings that opened '/'", not
--      "times '/' was loaded". Reloads inside a sitting no longer inflate it.
--    * `engaged` / `started` are joins on visit_id, so a sitting that started
--      a career anywhere marks every page row of that sitting. The game funnel
--      filters page = '/' and is unaffected; do not read `started` on an
--      article row as "this article produced a career" — READ TO PLAY, which
--      keys on the session referrer, remains the honest measure of that.
--    * Numbers before and after this change are NOT comparable. Visit counts
--      will appear to fall. Careers, hours played and finish rate are
--      untouched: they never depended on visit_id.
--
--  Safe to run more than once.
-- ============================================================================

-- Enforce the new shape in the schema rather than only in the function body,
-- which also removes the check-then-insert race the old version had. Existing
-- rows hold at most one page per visit_id, so this cannot fail on live data.
create unique index if not exists cp_loads_visit_page_idx
  on public.cp_loads (visit_id, page);

create or replace function public.cp_log_load(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p is null or (p->>'visit_id') is null then
    return;
  end if;

  -- One row per PAGE per sitting. The conflict target does the de-duplication
  -- that an `if exists` check used to, minus the race.
  insert into public.cp_loads (
    visit_id, referrer, device, platform, screen, app_version, country, webdriver, page, meta
  ) values (
    p->>'visit_id',
    left(p->>'referrer', 300),
    p->>'device',
    p->>'platform',
    p->>'screen',
    p->>'app_version',
    public.cp_request_country(),
    (p->>'webdriver')::boolean,
    coalesce(nullif(left(p->>'page', 120), ''), '/'),
    coalesce(p->'meta', '{}'::jsonb)
  )
  on conflict (visit_id, page) do nothing;
end;
$$;

grant execute on function public.cp_log_load(jsonb) to anon, authenticated;
