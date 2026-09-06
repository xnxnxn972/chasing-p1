-- ============================================================================
--  Chasing P1 — useful queries against the session log
--  Nothing here changes the schema; run whichever you need.
-- ============================================================================

-- ---- 1. The funnel: visits -> careers started -> finished -> shared --------
-- Rows with driver_name null are visits where nobody pressed "Start your
-- career", so they are the top of the funnel, not failed careers.
select
  count(distinct visit_id)                                       as visits,
  count(*) filter (where driver_name is not null)                as careers_started,
  count(*) filter (where finished > 0)                           as careers_finished,
  count(*) filter (where shared)                                 as shared,
  round(100.0 * count(*) filter (where finished > 0)
        / nullif(count(*) filter (where driver_name is not null), 0), 1)
                                                                 as pct_completed
from cp_sessions_log
where env = 'prod';

-- ---- 2. Same, split by device --------------------------------------------
select
  coalesce(device, 'unknown')                                    as device,
  coalesce(platform, 'unknown')                                  as platform,
  count(*) filter (where driver_name is not null)                as started,
  count(*) filter (where finished > 0)                           as finished,
  round(100.0 * count(*) filter (where finished > 0)
        / nullif(count(*) filter (where driver_name is not null), 0), 1)
                                                                 as pct_completed,
  round(avg(session_s) filter (where finished > 0))              as avg_s_when_finished
from cp_sessions_log
where env = 'prod'
group by 1, 2
order by started desc;

-- ---- 3. How long a completed career actually takes ------------------------
select
  count(*)                                                       as n,
  round(avg(session_s))                                          as avg_s,
  percentile_cont(0.5) within group (order by session_s)::int     as median_s,
  percentile_cont(0.9) within group (order by session_s)::int     as p90_s,
  round(avg(active_s))                                           as avg_active_s
from cp_sessions_log
where env = 'prod' and finished > 0;

-- ---- 4. Do people play more than once in a sitting? -----------------------
select
  careers_in_visit,
  count(*) as visits
from (
  select visit_id, count(*) filter (where driver_name is not null) as careers_in_visit
  from cp_sessions_log
  where env = 'prod'
  group by visit_id
) v
group by 1
order by 1;

-- ---- 5. Where careers are abandoned ---------------------------------------
-- seasons reached on careers that were NOT finished.
select
  seasons,
  count(*) as abandoned
from cp_sessions_log
where env = 'prod' and driver_name is not null and finished = 0
group by 1
order by 1;
