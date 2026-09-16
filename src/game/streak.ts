/**
 * CONSECUTIVE RACING DAYS.
 *
 * A count of the days in a row on which this browser has started a career, and
 * nothing more. It is deliberately NOT a shared daily puzzle: every player gets
 * their own seed, on every career, on every day, exactly as they always have.
 *
 * WHY A STREAK WITHOUT A SHARED GRID STILL WORKS. The job here is retention,
 * and the useful half of a daily mechanic is the clock, not the sameness. A
 * player with no reason to return has to remember the game unprompted; a count
 * that survives until tomorrow and breaks on the day after gives the return a
 * deadline. Sharing one seed across everybody would add comparability, at the
 * cost of telling each player which career they are allowed to have today.
 *
 * THE DATE IS LOCAL, NOT UTC. Somebody in Melbourne and somebody in Los
 * Angeles each get their own midnight; using UTC would break a streak in the
 * middle of the evening for half the world.
 */

/** Today where the PLAYER is, as YYYY-MM-DD. */
export function today(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The day before a given YYYY-MM-DD, for deciding whether a streak survives. */
export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(y, m - 1, d);
  t.setDate(t.getDate() - 1);
  return today(t);
}

/**
 * The streak after starting a career on `day`.
 *
 * A second career on a day already counted does not advance it — this counts
 * days, not careers, and a player who races ten times this afternoon has still
 * only shown up once.
 *
 * A gap resets to 1 rather than 0: the day you come back is itself a day
 * raced, and a streak reading 0 on the screen you are looking at is wrong.
 */
export function streakAfter(lastPlayed: string | undefined, streak: number, day = today()): number {
  if (lastPlayed === day) return Math.max(1, streak);
  if (lastPlayed && lastPlayed === previousDay(day)) return streak + 1;
  return 1;
}

/**
 * Whether a streak is still alive, which is not the same as whether today has
 * been raced. It survives all of the day after the last one raced — that gap
 * is the window the nudge exists to close.
 */
export function streakIsAlive(lastPlayed: string | undefined, day = today()): boolean {
  if (!lastPlayed) return false;
  return lastPlayed === day || lastPlayed === previousDay(day);
}

/** "3rd", "2nd", "11th" — for a line of copy, not for a table. */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
