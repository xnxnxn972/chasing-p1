-- ============================================================================
--  Chasing P1 — the returning-player report
--
--  Read-only. Split out of supabase-returning-players.sql because the SQL
--  editor runs a pasted script as one transaction: an error in a reporting
--  query at the bottom silently rolls back the migration above it.
--
--  Run this AFTER the migration, and expect it to be thin today — a return
--  cannot be observed until a second day exists to return on.
-- ============================================================================

-- ---- 1. is anything being written at all? ----------------------------------
-- The first thing to check. If this is 0, the deploy has not reached anybody
-- yet, or localStorage is failing everywhere, and nothing below will say much.
select
  count(*)                                                                as rows_total,
  count(*) filter (where meta->>'player_id' is not null)                  as with_player_id,
  count(*) filter (where (meta->>'storage')::boolean is false)            as storage_blocked,
  max(created_at)                                                         as newest
from public.cp_sessions;

-- ---- 2. the return rate ----------------------------------------------------
-- Rows where storage failed are excluded rather than counted as one-visit
-- players: they cannot be de-duplicated, so counting them biases the number
-- downwards by its own blind spot.
select
  count(*)                                                   as players,
  count(*) filter (where visits = 1)                         as one_visit_only,
  count(*) filter (where visits > 1)                         as came_back,
  round(100.0 * count(*) filter (where visits > 1)
        / nullif(count(*), 0), 1)                            as return_rate_pct,
  count(*) filter (where days_seen > 1)                      as returned_another_day
from (
  select
    meta->>'player_id'                  as pid,
    max((meta->>'player_visits')::int)  as visits,
    count(distinct created_at::date)    as days_seen
  from public.cp_sessions
  where meta->>'player_id' is not null
    and coalesce((meta->>'storage')::boolean, false)
  group by 1
) p;

-- ---- 3. streaks ------------------------------------------------------------
select
  (meta->>'player_streak')::int   as streak_days,
  count(distinct meta->>'player_id') as players,
  count(*)                        as careers
from public.cp_sessions
where meta->>'player_streak' is not null
group by 1
order by 1;

-- ---- 4. why mobile backs out of the share sheet ----------------------------
-- If cancels cluster at high render_ms the card is too slow on phones; if they
-- cluster at low sheet_ms with render fast, the sheet itself is the problem.
select
  device,
  share_result,
  count(*)                                        as n,
  round(avg((meta->>'share_render_ms')::numeric)) as avg_render_ms,
  round(avg((meta->>'share_sheet_ms')::numeric))  as avg_sheet_ms,
  max((meta->>'share_attempts')::int)             as max_attempts
from public.cp_sessions
where meta->>'share_path' is not null
group by 1, 2
order by 1, 3 desc;

-- ---- 5. home-screen launches ----------------------------------------------
-- start_url carries ?s=pwa, so an install shows up as its own source.
select
  public.cp_traffic_source(referrer, coalesce(meta, '{}'::jsonb)) as source,
  count(distinct visit_id)                                        as visits,
  count(*)                                                        as careers
from public.cp_sessions
group by 1
order by visits desc;
