import { useEffect, useState } from 'react';
import {
  type BoardRow,
  type BoardWeek,
  droppedFrom,
  fetchBoard,
  flagFor,
  postToBoard,
  rememberRank,
  timeLeft
} from '../game/weeklyBoard';
import { player } from '../game/playerStore';
import { trackExtra } from '../game/telemetry';

/** Re-render once a minute so the countdown moves without ticking seconds. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * ON THE SUMMARY SCREEN: where this career would land, and the one tap that
 * puts it there.
 *
 * The would-be rank is shown BEFORE posting. "This career would be #4 of 31"
 * is the whole pitch — it is the number that makes somebody press the button,
 * and it costs them nothing to read.
 */
export function SummaryBoard({
  name,
  nationality,
  score,
  titles,
  careerTitle
}: {
  name: string;
  nationality: string;
  score: number;
  titles: number;
  careerTitle: string;
}) {
  const now = useMinuteClock();
  const [board, setBoard] = useState<BoardWeek | null>(null);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState<{ rank: number; total: number; improved: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetchBoard(score).then((b) => {
      if (!live || !b) return;
      setBoard(b);
      // Whether the offer was made at all, and how good it was, is what the
      // post rate has to be read against.
      if (!b.you || b.you.score < score) trackExtra('board_would_rank', b.wouldRank);
    });
    return () => {
      live = false;
    };
  }, [score]);

  if (!board || score <= 0) return null;

  const standing = board.you && board.you.score >= score && !posted;
  const canPost = !standing && !posted;

  const post = async () => {
    setPosting(true);
    setError(null);
    const out = await postToBoard({ name, nationality, score, titles, careerTitle });
    if (out.ok) {
      setPosted(out.result);
      trackExtra('board_posted', out.result.rank);
      const fresh = await fetchBoard();
      if (fresh) {
        setBoard(fresh);
        rememberRank(fresh);
      }
    } else {
      setError(
        out.reason === 'name'
          ? 'That name cannot go on a public board. Start a career under another one and post that.'
          : 'Could not reach the board. Try again in a moment.'
      );
    }
    setPosting(false);
  };

  return (
    <section className="panel panel-pad board">
      <div className="board-head">
        <span className="board-label">This week&rsquo;s board</span>
        <span className="board-clock">Ends in {timeLeft(board.endsAt, now)}</span>
      </div>

      {posted ? (
        <p className="board-pitch">
          <strong>
            #{posted.rank} of {posted.total}.
          </strong>{' '}
          {posted.improved
            ? 'You are on the board until Monday. Come back and see whether it holds.'
            : 'Your better career from earlier this week is still the one on the board.'}
        </p>
      ) : standing && board.you ? (
        <p className="board-pitch">
          Your best this week is <strong>{board.you.score.toLocaleString()}</strong>, sitting{' '}
          <strong>
            #{board.you.rank} of {board.total}
          </strong>
          . This career would not replace it.
        </p>
      ) : (
        <p className="board-pitch">
          {board.total === 0 ? (
            <>
              Nobody has posted this week. <strong>This career would be #1.</strong>
            </>
          ) : (
            <>
              This career would be{' '}
              <strong>
                #{board.wouldRank} of {board.wouldTotal}
              </strong>{' '}
              this week.
            </>
          )}
        </p>
      )}

      {canPost && (
        <div className="board-post">
          <button className="btn btn-primary" disabled={posting} onClick={post}>
            {posting ? 'Posting…' : `Post as ${name} ${flagFor(nationality)}`}
          </button>
          <span className="board-fine">Shows your driver name, nationality and score until Monday.</span>
        </div>
      )}
      {error && <p className="board-error">{error}</p>}

      <BoardTable board={board} youName={posted ? name : undefined} youNationality={nationality} />
    </section>
  );
}

/**
 * ON THE HOME SCREEN: one line, for players who have already started a career.
 *
 * Shown only to returning players because the form has to stay reachable
 * without scrolling for somebody arriving for the first time — and a board
 * means nothing to a player who has never seen a score.
 */
export function HomeBoard() {
  const now = useMinuteClock();
  const [board, setBoard] = useState<BoardWeek | null>(null);
  const [dropped, setDropped] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const eligible = player().careers >= 1;

  useEffect(() => {
    if (!eligible) return;
    let live = true;
    void fetchBoard().then((b) => {
      if (!live || !b) return;
      // Read before remembering, or the drop is overwritten before it is told.
      setDropped(droppedFrom(b));
      rememberRank(b);
      setBoard(b);
      trackExtra('board_home', b.you ? `#${b.you.rank}/${b.total}` : b.lastWeek ? 'last_week' : 'off');
    });
    return () => {
      live = false;
    };
  }, [eligible]);

  if (!eligible || !board) return null;

  const leader = board.top[0];
  const clock = timeLeft(board.endsAt, now);

  let line: React.ReactNode;
  if (board.you) {
    line = (
      <>
        <strong>
          #{board.you.rank} of {board.total}
        </strong>{' '}
        on this week&rsquo;s board
        {dropped ? `, down from #${dropped}. Somebody passed you` : ''}. Ends in {clock}.
      </>
    );
  } else if (board.lastWeek) {
    line = (
      <>
        Last week you finished{' '}
        <strong>
          #{board.lastWeek.rank} of {board.lastWeek.total}
        </strong>
        . A new board is open, ends in {clock}.
      </>
    );
  } else if (leader) {
    line = (
      <>
        This week&rsquo;s leader:{' '}
        <strong>
          {leader.name} {flagFor(leader.nationality)} {leader.score.toLocaleString()}
        </strong>
        . Ends in {clock}.
      </>
    );
  } else {
    line = <>Nobody is on this week&rsquo;s board yet. Ends in {clock}.</>;
  }

  return (
    <div className={`board-strip${dropped ? ' is-dropped' : ''}`}>
      <p>{line}</p>
      {board.total > 0 && (
        <button type="button" className="board-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide the board' : 'See the board'}
        </button>
      )}
      {open && <BoardTable board={board} />}
    </div>
  );
}

function BoardTable({
  board,
  youName,
  youNationality
}: {
  board: BoardWeek;
  /** Name for the caller's own row when it sits outside the top ten. */
  youName?: string;
  youNationality?: string;
}) {
  if (board.top.length === 0) return null;
  const youInTop = board.top.some((r) => r.you);
  const tail: BoardRow | null =
    board.you && !youInTop
      ? {
          rank: board.you.rank,
          name: youName ?? 'You',
          nationality: youNationality ?? null,
          score: board.you.score,
          titles: 0,
          career_title: null,
          you: true
        }
      : null;

  return (
    <ol className="board-table">
      {board.top.map((r) => (
        <Row key={r.rank} row={r} />
      ))}
      {tail && (
        <>
          <li className="board-gap" aria-hidden="true">
            ···
          </li>
          <Row row={tail} />
        </>
      )}
    </ol>
  );
}

function Row({ row }: { row: BoardRow }) {
  return (
    <li className={`board-row${row.you ? ' is-you' : ''}`}>
      <span className="board-rank">{row.rank}</span>
      <span className="board-name">
        {row.name} {flagFor(row.nationality)}
        {row.career_title ? <small>{row.career_title}</small> : null}
      </span>
      <span className="board-score">
        {row.titles > 0 ? <span className="board-titles">{'🏆'.repeat(Math.min(row.titles, 5))}</span> : null}
        {row.score.toLocaleString()}
      </span>
    </li>
  );
}
