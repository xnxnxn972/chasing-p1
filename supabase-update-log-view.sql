-- ============================================================================
--  Chasing P1 — show the driver identity the player actually chose
--
--  driver_number and nationality were already being recorded, they just were
--  not in the view. Also renames the geo-IP columns to geo_country / geo_city
--  so they cannot be confused with the nationality the player picked.
--
--  View only. No table change, no redeploy — existing rows already have this.
-- ============================================================================

drop view if exists public.cp_sessions_log;

create view public.cp_sessions_log as
select
  created_at,

  -- One scannable handle: "Yaniv Axen #27 (IL)"
  case
    when driver_name is null then '(no career started)'
    else driver_name
         || coalesce(' #' || driver_number::text, '')
         || coalesce(' (' || nationality || ')', '')
  end                                                 as player,

  -- and the same three, separately, for grouping and filtering
  driver_name,
  driver_number,
  nationality,                                        -- chosen on the setup screen
  style,

  device,
  platform,
  app_version,

  country                                             as geo_country,  -- from IP
  city                                                as geo_city,     -- from IP

  duration_s,
  careers_started,
  careers_finished,
  case when reached_f1 then 'F1' else '—' end         as got_to,
  seasons,
  titles,
  career_title,
  career_score,
  shared,
  env,
  seed,
  meta
from public.cp_sessions
order by created_at desc;

select * from cp_sessions_log limit 20;
