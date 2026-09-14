/**
 * THE CHALLENGE LINK
 *
 * A shared career currently arrives in someone's chat as a picture and a URL,
 * and the person who opens it has no reason to click beyond curiosity. Only 17%
 * of shares produce a visit.
 *
 * So a shared link now carries the score it was shared with — `?s=share&beat=N`
 * — and the arriving player is given that number as a target. It costs the
 * sender nothing, and it turns "here is a game" into "beat this", which is a
 * far better reason to tap a link.
 *
 * The score is the only thing carried. No name, no id, nothing that identifies
 * the sender: a link pasted into a group chat should not tell strangers who
 * sent it.
 */

/** Highest score anyone has plausibly reached; anything above is a tampered URL. */
const MAX_PLAUSIBLE = 200_000;

/**
 * The score to beat, read once from the landing URL. Returns null when there is
 * no challenge, or when the value is not a number we would have produced —
 * query strings are user-editable, so this is treated as untrusted input.
 */
export function incomingChallenge(): number | null {
  if (typeof location === 'undefined') return null;
  try {
    const raw = new URLSearchParams(location.search).get('beat');
    if (!raw) return null;
    const score = Number(raw);
    if (!Number.isFinite(score) || score <= 0 || score > MAX_PLAUSIBLE) return null;
    return Math.round(score);
  } catch {
    return null;
  }
}

export interface ChallengeOutcome {
  target: number;
  score: number;
  beaten: boolean;
  /** Always positive: how far past the target, or how far short. */
  margin: number;
}

export function challengeOutcome(target: number | undefined, score: number): ChallengeOutcome | null {
  if (!target) return null;
  return { target, score, beaten: score > target, margin: Math.abs(score - target) };
}

/**
 * Should the summary invite this player to challenge someone?
 *
 * Measured against 1,574 finished careers: a personal best that also clears
 * ~20,000 is shared 24.3% of the time unprompted, against 1.3% for a career
 * that is not a personal best. Neither condition works alone — a personal best
 * below 20,000 shares at 4.7%, and a big score that is NOT a personal best at
 * 4.5%. Only the intersection is worth interrupting someone for.
 *
 * Career one is excluded because it is always a personal best, which makes
 * "your best yet" meaningless, and because first careers share at 5.1% anyway.
 *
 * This fires on roughly one finished career in fifteen. Keep it that way: a
 * prompt people learn to dismiss is worse than no prompt.
 */
export const CHALLENGE_SCORE_BAR = 20000;

export function shouldInviteChallenge(opts: {
  score: number;
  careerIndex: number;
  previousBest: number;
}): boolean {
  return (
    opts.careerIndex >= 2 && opts.score > opts.previousBest && opts.score >= CHALLENGE_SCORE_BAR
  );
}
