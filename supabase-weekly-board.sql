-- ============================================================================
--  Chasing P1 — the weekly board
--
--  WHY: a streak counts days but gives nobody anything to aim at. This is a
--  leaderboard that resets every Monday 00:00 UTC, so there is always a race
--  that is still open and always a reason to come back before Sunday.
--
--  THE RULES
--   * One entry per browser per week: its BEST career that week. Posting a
--     worse career never replaces a better one.
--   * Posting is opt-in, one tap on the summary screen. Driver names were
--     typed as part of a game, not as a public handle, so nothing goes on the
--     board unless the player puts it there.
--   * Ties go to whoever got there first.
--   * `env` keeps localhost testing ('dev') off the public board ('prod').
--
--  TRUST. Scores are computed in the browser, so a determined person can post
--  any number they like. The cap below stops the absurd ones; anything else
--  is removed by hand (see the bottom of this file). That is the right amount
--  of defence for a free weekly board with no prizes.
--
--  The table has RLS on and NO policies: anon cannot read or write it
--  directly. Everything goes through the three functions below, and none of
--  them returns player_id, so one browser's id is never shown to another.
--
--  RUN THIS FILE ON ITS OWN. Safe to run more than once.
-- ============================================================================

create table if not exists public.cp_board (
  week_start   date        not null,             -- the Monday (UTC) this entry belongs to
  env          text        not null default 'prod',
  player_id    text        not null,             -- playerStore id: one browser
  name         text        not null,             -- driver name, as posted
  nationality  text,                             -- in-game nationality code, not geography
  score        integer     not null,
  titles       integer     not null default 0,
  career_title text,
  session_id   text,                             -- joins to cp_sessions for checking
  posted_at    timestamptz not null default now(),
  primary key (week_start, env, player_id)
);

create index if not exists cp_board_rank_idx
  on public.cp_board (week_start, env, score desc, posted_at);

alter table public.cp_board enable row level security;
revoke all on public.cp_board from anon, authenticated;


-- The Monday that starts the week containing p_at, in UTC.
create or replace function public.cp_board_week(p_at timestamptz default now())
returns date
language sql
stable
as $$
  select date_trunc('week', p_at at time zone 'utc')::date;
$$;


-- Names that do not go on a public board. Word-boundary matches for the short
-- stems so real surnames (Spicer, Grape, Scunthorpe) are not caught, and a
-- small leetspeak fold so "n1gg3r" is. Edit freely; no deploy needed.
create or replace function public.cp_board_name_blocked(p_name text)
returns boolean
language sql
immutable
as $$
  select translate(lower(p_name), '0134579@$!', 'oieastgasi') ~
    '(fuck|shit|cunt|nigg|faggot|retard|whore|hitler|nazi|pedo|paedo|wank|bitch|\mfag\M|\mkike\M|\mspic\M|\mchink\M|\mrape|\mporn|\mslut\M|\mtwat\M|\mpenis\M|\mvagina\M|\mcock\M|\mdick\M)';
$$;


-- ----------------------------------------------------------------------------
--  POST. Returns where the browser's entry now stands.
--    { rank, total, score, improved }
--  `improved` is false when an existing, better entry was kept.
-- ----------------------------------------------------------------------------
create or replace function public.cp_board_post(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week    date := public.cp_board_week();
  v_env     text := case when p->>'env' = 'dev' then 'dev' else 'prod' end;
  v_player  text := left(nullif(trim(p->>'player_id'), ''), 80);
  v_name    text;
  v_score   integer;
  v_titles  integer;
  v_changed integer;
  v_mine    public.cp_board;
  v_rank    integer;
  v_total   integer;
begin
  if v_player is null then
    raise exception 'player_id required';
  end if;

  v_name := regexp_replace(coalesce(p->>'name', ''), '[[:cntrl:]]', '', 'g');
  v_name := trim(regexp_replace(v_name, '\s+', ' ', 'g'));
  if char_length(v_name) < 1 or char_length(v_name) > 28 then
    raise exception 'bad name';
  end if;
  if public.cp_board_name_blocked(v_name) then
    raise exception 'name not allowed';
  end if;

  begin
    v_score  := (p->>'score')::integer;
    v_titles := coalesce((p->>'titles')::integer, 0);
  exception when others then
    raise exception 'bad score';
  end;
  -- The highest real career on record is ~45,000. 200,000 matches the cap the
  -- challenge link already applies, so the two agree on what is plausible.
  if v_score is null or v_score <= 0 or v_score > 200000 then
    raise exception 'bad score';
  end if;

  insert into public.cp_board as b
    (week_start, env, player_id, name, nationality, score, titles, career_title, session_id)
  values (
    v_week, v_env, v_player, v_name,
    left(upper(nullif(p->>'nationality', '')), 3),
    v_score,
    least(greatest(v_titles, 0), 30),
    left(nullif(p->>'career_title', ''), 60),
    left(nullif(p->>'session_id', ''), 80)
  )
  on conflict (week_start, env, player_id) do update set
    name         = excluded.name,
    nationality  = excluded.nationality,
    score        = excluded.score,
    titles       = excluded.titles,
    career_title = excluded.career_title,
    session_id   = excluded.session_id,
    posted_at    = now()
  where excluded.score > b.score;

  get diagnostics v_changed = row_count;

  select * into v_mine from public.cp_board
   where week_start = v_week and env = v_env and player_id = v_player;

  select count(*) + 1 into v_rank from public.cp_board
   where week_start = v_week and env = v_env
     and (score > v_mine.score
          or (score = v_mine.score and posted_at < v_mine.posted_at));

  select count(*) into v_total from public.cp_board
   where week_start = v_week and env = v_env;

  return jsonb_build_object(
    'rank', v_rank, 'total', v_total, 'score', v_mine.score, 'improved', v_changed > 0
  );
end;
$$;

grant execute on function public.cp_board_post(jsonb) to anon, authenticated;


-- ----------------------------------------------------------------------------
--  READ. Everything a screen needs in one call.
--    seconds_left   until the week closes (server clock, so a wrong phone
--                   clock cannot break the countdown)
--    total, top     the top 10 this week; `you` marks the caller's row
--    you            the caller's own rank and score, wherever they are
--    would_rank     where p_score WOULD land if posted now, and would_total
--    last_week      the caller's final standing in the week just closed
-- ----------------------------------------------------------------------------
create or replace function public.cp_board_get(
  p_player_id text    default null,
  p_score     integer default null,
  p_env       text    default 'prod'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week   date := public.cp_board_week();
  v_env    text := case when p_env = 'dev' then 'dev' else 'prod' end;
  v_top    jsonb;
  v_total  integer;
  v_you    jsonb;
  v_last   jsonb;
  v_would  integer;
  v_wtotal integer;
begin
  with ranked as (
    select b.*,
           row_number() over (order by score desc, posted_at, player_id) as rank
      from public.cp_board b
     where week_start = v_week and env = v_env
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

  if p_score is not null and p_score > 0 then
    -- Ties go to the entry already there, so an equal score ranks below it.
    select count(*) + 1 into v_would from public.cp_board
     where week_start = v_week and env = v_env
       and player_id is distinct from p_player_id
       and score >= p_score;
    v_wtotal := v_total + case when v_you is null then 1 else 0 end;
  end if;

  if p_player_id is not null then
    with ranked as (
      select b.*,
             row_number() over (order by score desc, posted_at, player_id) as rank,
             count(*) over () as total
        from public.cp_board b
       where week_start = v_week - 7 and env = v_env
    )
    select jsonb_build_object('rank', rank, 'total', total, 'score', score)
      into v_last
      from ranked where player_id = p_player_id;
  end if;

  return jsonb_build_object(
    'week_start',   v_week,
    'seconds_left', greatest(0, extract(epoch from
                      ((v_week + 7)::timestamp at time zone 'utc') - now()))::integer,
    'total',        v_total,
    'top',          v_top,
    'you',          v_you,
    'would_rank',   v_would,
    'would_total',  v_wtotal,
    'last_week',    v_last
  );
end;
$$;

grant execute on function public.cp_board_get(text, integer, text) to anon, authenticated;


-- ----------------------------------------------------------------------------
--  ADMIN. The whole board including player_id and session_id, for checking
--  suspicious entries against the session log. Same token as the dashboard.
-- ----------------------------------------------------------------------------
create or replace function public.cp_board_admin(p_token text, p_weeks int default 4)
returns setof public.cp_board
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null
     or p_token <> (select t.token from public.cp_admin t where t.id = 1) then
    raise exception 'unauthorized';
  end if;
  return query
    select * from public.cp_board
     where week_start >= public.cp_board_week() - 7 * greatest(p_weeks - 1, 0)
     order by week_start desc, env, score desc, posted_at;
end;
$$;

grant execute on function public.cp_board_admin(text, int) to anon, authenticated;


-- ----------------------------------------------------------------------------
--  REMOVING AN ENTRY BY HAND (run in the editor, not part of the migration):
--
--    select week_start, name, score, posted_at, player_id
--      from public.cp_board where week_start = public.cp_board_week()
--      order by score desc;
--
--    delete from public.cp_board
--     where week_start = public.cp_board_week() and player_id = '...';
-- ----------------------------------------------------------------------------

select public.cp_board_week() as this_week, public.cp_board_name_blocked('Max Verstappen') as should_be_false;
