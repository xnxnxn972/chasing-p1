-- ============================================================================
--  Chasing P1 — does the red flag do anything?
--
--  Run supabase-expose-red-flags.sql first, on its own. These read cp_sessions
--  directly rather than going through the admin RPC, so they work either way,
--  but the RPC is what the dashboard and the probes use.
--
--  Run these ONE AT A TIME. Pasting the file as a block makes it one
--  transaction in the Supabase editor, and one bad query takes the rest with it.
--
--  THE TRAP IN EVERY ONE OF THESE: a career that saw a red flag is, by
--  construction, a career that lasted about nine seasons. It will beat the
--  average on every measure you can name, and none of that is the feature
--  working — it is the feature only happening to careers that were already
--  going well. Query 4 is the only honest comparison here because it holds
--  career length fixed. Do not quote 2 or 3 as evidence of anything.
-- ============================================================================


-- 1. COVERAGE. How much of the live traffic is even reaching it.
--    `reached` counts careers, not people; one sitting can hold twenty.
select
  date(created_at)                                          as day,
  count(*)                                                  as careers,
  count(*) filter (where meta ? 'red_flags')                as reached_a_red_flag,
  count(*) filter (where (meta->>'red_flag_thread')::boolean) as consequence_came_back,
  round(100.0 * count(*) filter (where meta ? 'red_flags') / nullif(count(*), 0), 1) as pct_reached
from public.cp_sessions
where created_at >= timestamptz '2026-10-31 08:00+00'   -- when it shipped
  and coalesce(env, 'prod') <> 'dev'
group by 1
order by 1 desc;


-- 2. WHICH SITUATIONS LAND, and which never do. A situation that never
--    appears is either gated too tightly or dead content; both are worth
--    knowing, and the simulation's figures are only a model of this.
select
  trim(part)      as situation,
  count(*)        as times
from public.cp_sessions,
     lateral unnest(string_to_array(meta->>'red_flag_seen', ' · ')) as part
where meta ? 'red_flag_seen'
  and coalesce(env, 'prod') <> 'dev'
group by 1
order by 2 desc;


-- 3. THE NAIVE COMPARISON, kept only so nobody reinvents it and believes it.
--    It will look fantastic. It is selection, not effect. See query 4.
select
  (meta ? 'red_flags')                      as saw_a_red_flag,
  count(*)                                  as careers,
  round(avg((meta->>'active_s')::numeric))  as mean_active_s,
  round(avg(seasons), 1)                    as mean_seasons,
  round(100.0 * count(*) filter (where careers_finished > 0) / count(*), 1) as pct_finished
from public.cp_sessions
where created_at >= timestamptz '2026-10-31 08:00+00'
  and coalesce(env, 'prod') <> 'dev'
group by 1;


-- 4. THE HONEST COMPARISON. Only careers that got deep enough for a red flag
--    to have been possible, so both sides are careers that were already
--    running long. If the feature does anything, the difference shows here
--    and nowhere else.
--
--    Read it with the career counts in view: at these volumes a few dozen
--    careers either side is not a result, it is a reading. Wait for hundreds.
select
  (meta ? 'red_flags')                      as saw_a_red_flag,
  count(*)                                  as careers,
  round(avg((meta->>'active_s')::numeric))  as mean_active_s,
  round(avg(seasons), 1)                    as mean_seasons,
  round(100.0 * count(*) filter (where careers_finished > 0) / count(*), 1) as pct_finished,
  round(100.0 * count(*) filter (where shared) / count(*), 1)               as pct_shared
from public.cp_sessions
where created_at >= timestamptz '2026-10-31 08:00+00'
  and coalesce(env, 'prod') <> 'dev'
  and seasons >= 8                           -- deep enough either way
group by 1;


-- 5. DID THE PAYOFF ARRIVE? The consequence lands two to four seasons after
--    the choice, so a career can meet the red flag and still never see what
--    it did. This is the number that says whether the deferred beat is worth
--    keeping or whether it is landing after most people have stopped.
select
  count(*)                                                    as careers_with_a_red_flag,
  count(*) filter (where (meta->>'red_flag_thread')::boolean) as consequence_came_back,
  round(
    100.0 * count(*) filter (where (meta->>'red_flag_thread')::boolean)
    / nullif(count(*), 0), 1
  )                                                           as pct,
  round(avg(seasons) filter (where (meta->>'red_flag_thread')::boolean), 1) as mean_seasons_when_it_did,
  round(avg(seasons) filter (where not coalesce((meta->>'red_flag_thread')::boolean, false)), 1)
                                                              as mean_seasons_when_it_did_not
from public.cp_sessions
where meta ? 'red_flags'
  and coalesce(env, 'prod') <> 'dev';
