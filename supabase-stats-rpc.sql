-- ============================================================================
--  Chasing P1 — a read-only stats function
--
--  The log has no SELECT policy on purpose: a visitor can write their own row
--  but cannot read anyone's. That also means nobody holding the anon key can
--  check the numbers without opening the dashboard.
--
--  This exposes AGGREGATES ONLY through a security-definer function, so counts
--  can be read with the anon key while individual rows — names, IPs, cities —
--  stay unreadable. Safe to run more than once.
-- ============================================================================

create or replace function public.cp_stats()
returns table (
  visits            bigint,
  careers_started   bigint,
  careers_finished  bigint,
  shared            bigint,
  reached_f1        bigint,
  median_session_s  int,
  first_row         timestamptz,
  last_row          timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    count(distinct visit_id),
    count(*) filter (where driver_name is not null),
    count(*) filter (where careers_finished > 0),
    count(*) filter (where shared),
    count(*) filter (where reached_f1),
    coalesce(
      percentile_cont(0.5) within group (
        order by extract(epoch from (last_activity_at - created_at))
      )::int, 0),
    min(created_at),
    max(created_at)
  from public.cp_sessions
  where env = 'prod';
$$;

grant execute on function public.cp_stats() to anon, authenticated;

select * from public.cp_stats();
