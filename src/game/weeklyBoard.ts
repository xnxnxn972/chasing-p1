/**
 * THE WEEKLY BOARD.
 *
 * A leaderboard that resets every Monday 00:00 UTC. The streak gives a player
 * a deadline; this gives them a target, and the countdown means the race they
 * are in is always one they can still win.
 *
 * Posting is opt-in. A driver name was typed as part of a game, not as a
 * public handle, so nothing reaches the board unless the player presses the
 * button that puts it there. One entry per browser per week — its best — so a
 * worse career posted later never costs anybody their place.
 *
 * Every call fails quietly to null. The board is a reason to come back, never
 * a reason for the game to break: offline, blocked, or the SQL not yet run, the
 * screens simply render without it.
 */

import { SUPABASE_ANON_KEY, SUPABASE_URL, currentSessionId, telemetryEnv } from './telemetry';
import { player, updatePlayer } from './playerStore';
import { NATIONALITIES } from '../data/nationalities';

export interface BoardRow {
  rank: number;
  name: string;
  nationality: string | null;
  score: number;
  titles: number;
  career_title: string | null;
  /** This browser's own entry. */
  you: boolean;
}

export interface BoardWeek {
  /** The Monday this week started, YYYY-MM-DD. */
  weekStart: string;
  /** Epoch ms when the week closes, anchored to the server's clock. */
  endsAt: number;
  total: number;
  top: BoardRow[];
  you: { rank: number; score: number } | null;
  /** Where the score asked about would land if posted now. */
  wouldRank: number | null;
  wouldTotal: number | null;
  /** This browser's final standing in the week just closed. */
  lastWeek: { rank: number; total: number; score: number } | null;
}

export interface PostResult {
  rank: number;
  total: number;
  score: number;
  /** False when an existing, better entry this week was kept instead. */
  improved: boolean;
}

const TIMEOUT_MS = 6000;

async function rpc<T>(name: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, message: err?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

interface RawWeek {
  week_start: string;
  seconds_left: number;
  total: number;
  top: BoardRow[];
  you: { rank: number; score: number } | null;
  would_rank: number | null;
  would_total: number | null;
  last_week: { rank: number; total: number; score: number } | null;
}

/** This week's board, and where `score` would land on it if one is given. */
export async function fetchBoard(score?: number): Promise<BoardWeek | null> {
  const res = await rpc<RawWeek>('cp_board_get', {
    p_player_id: player().id,
    p_score: score ?? null,
    p_env: telemetryEnv()
  });
  if (!res.ok || !res.data || !Array.isArray(res.data.top)) return null;
  const w = res.data;
  return {
    weekStart: w.week_start,
    endsAt: Date.now() + w.seconds_left * 1000,
    total: w.total,
    top: w.top,
    you: w.you,
    wouldRank: w.would_rank,
    wouldTotal: w.would_total,
    lastWeek: w.last_week
  };
}

export type PostOutcome =
  | { ok: true; result: PostResult }
  | { ok: false; reason: 'name' | 'failed' };

export async function postToBoard(entry: {
  name: string;
  nationality: string;
  score: number;
  titles: number;
  careerTitle: string;
}): Promise<PostOutcome> {
  const res = await rpc<PostResult>('cp_board_post', {
    p: {
      env: telemetryEnv(),
      player_id: player().id,
      session_id: currentSessionId(),
      name: entry.name,
      nationality: entry.nationality,
      score: entry.score,
      titles: entry.titles,
      career_title: entry.careerTitle
    }
  });
  if (res.ok) return { ok: true, result: res.data };
  return { ok: false, reason: /name/.test(res.message) ? 'name' : 'failed' };
}

/**
 * "2d 4h", "5h 12m", "14m". Never seconds: a countdown that ticks every second
 * on a screen whose job is to start a career is a distraction, not urgency.
 */
export function timeLeft(endsAt: number, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((endsAt - now) / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}

export function flagFor(code: string | null): string {
  return NATIONALITIES.find((n) => n.code === code)?.flag ?? '';
}

/**
 * Has somebody passed this browser since it last looked?
 *
 * The board cannot notify anybody, so being overtaken is only news if the game
 * remembers where you were. Returns the rank last seen when it was better than
 * the rank now, in the same week; otherwise null.
 */
export function droppedFrom(board: BoardWeek): number | null {
  const p = player();
  if (!board.you || p.boardWeek !== board.weekStart || !p.boardRank) return null;
  return board.you.rank > p.boardRank ? p.boardRank : null;
}

/** Remember where this browser stood, for droppedFrom() next time. */
export function rememberRank(board: BoardWeek): void {
  if (!board.you) return;
  updatePlayer({ boardWeek: board.weekStart, boardRank: board.you.rank });
}
