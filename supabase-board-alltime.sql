-- ============================================================================
--  Chasing P1 — the all-time standings
--
--  Every browser's best POSTED career across every week of the weekly board.
--  Built from cp_board rather than from the session log on purpose: careers in
--  the log were never offered for public display, and a name typed for a game
--  does not become a public handle because the career was good. So the
--  all-time table starts the day the weekly board did (5 Nov 2026) and grows
--  only from posts.
--
--  Same shape as cp_board_get, so the client renders both with one table:
--    { total, top: [10 rows], you: { rank, score } | null }
--
--  Requires supabase-weekly-board.sql. RUN THIS FILE ON ITS OWN. Safe to run
--  more than once.
-- ============================================================================

create or replace function public.cp_board_alltime(
  p_player_id text default null,
  p_env       text default 'prod'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_env   text := case when p_env = 'dev' then 'dev' else 'prod' end;
  v_top   jsonb;
  v_total integer;
  v_you   jsonb;
begin
  with best as (
    -- One row per browser: its highest score ever, and the earliest week it
    -- was reached, so a tie is won by whoever got there first.
    select distinct on (player_id) *
      from public.cp_board
     where env = v_env
     order by player_id, score desc, posted_at
  ),
  ranked as (
    select best.*,
           row_number() over (order by score desc, posted_at, player_id) as rank
      from best
  )
  select
    coalesce(
      jsonb_agg(jsonb_build_object(
        'rank', rank, 'name', name, 'nationality', nationality, 'score', score,
        'titles', titles, 'career_title', career_title,
        'you', coalesce(player_id = p_player_id, false)
      ) order by rank) filter (where rank <= 10),
      '[]'::jsonb),
    count(*),
    (jsonb_agg(jsonb_build_object('rank', rank, 'score', score))
       filter (where player_id = p_player_id)) -> 0
  into v_top, v_total, v_you
  from ranked;

  return jsonb_build_object('total', v_total, 'top', v_top, 'you', v_you);
end;
$$;

grant execute on function public.cp_board_alltime(text, text) to anon, authenticated;

select public.cp_board_alltime(null, 'prod') as prod_alltime;
