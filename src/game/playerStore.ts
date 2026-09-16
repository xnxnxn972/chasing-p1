/**
 * WHO THIS BROWSER IS, ACROSS VISITS.
 *
 * Until now the game had no memory beyond the current page. `visit_id` was
 * generated fresh on every load, so somebody who closed the tab and came back
 * an hour later was indistinguishable from a stranger, and three things
 * followed from that:
 *
 *   * retention could not be measured — the log could count page loads and
 *     nothing else, so "nobody comes back" and "we cannot see them come back"
 *     looked identical
 *   * unfinished business, which exists to pull a player into another career,
 *     died the moment the tab closed
 *   * a streak was impossible, because there was nothing to count against
 *
 * This is a random identifier and a handful of counters. It holds no name, no
 * address and nothing typed into the game; it never leaves the browser except
 * as an opaque id in the session log, and it makes no network request of its
 * own — which is what separates it from the IP lookup that got the site
 * blocked.
 *
 * EVERY access is wrapped. Private windows, blocked site data and storage
 * quota errors are all normal, and in every one of them the game must behave
 * exactly as it did before this file existed: a fresh player, every time.
 */

const KEY = 'cp1.player.v1';

export interface PlayerRecord {
  /** Random and opaque. Identifies a browser, not a person. */
  id: string;
  /** ISO date of the first visit, so "returning" has something to mean. */
  firstSeen: string;
  /** Page loads, counted here rather than inferred from the log. */
  visits: number;
  /** Careers started across every visit. */
  careers: number;
  /** Best score across every visit — what makes a career a personal best. */
  bestScore: number;
  /** The ambition carried out of the last finished career. */
  ambitionId?: string;
  /** YYYY-MM-DD (local) of the last day a career was started. */
  lastPlayed?: string;
  /** Consecutive days on which a career was started. */
  streak: number;
  /**
   * The driver this browser last raced as, so a returning player is handed
   * back their own choices rather than a blank form.
   *
   * This is NOT the same as pre-filling a name for a stranger, which was
   * considered and rejected: a generated name costs a new player the moment
   * of deciding who they are. Giving somebody back the name they already
   * chose costs nothing and saves them typing it again.
   */
  lastName?: string;
  lastNumber?: number;
  lastNationality?: string;
  lastStyle?: string;
}

function blank(): PlayerRecord {
  return {
    id: newId(),
    firstSeen: new Date().toISOString().slice(0, 10),
    visits: 0,
    careers: 0,
    bestScore: 0,
    streak: 0
  };
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * The record in memory. Storage is read once and written through, so a game
 * whose storage is unavailable still behaves correctly for the current visit —
 * it simply forgets when the tab closes, exactly as the game did before.
 */
let current: PlayerRecord | null = null;
let storable = true;

function read(): PlayerRecord {
  if (current) return current;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerRecord>;
      // Merged over a blank so a record written by an older build, or one that
      // somebody has edited by hand, can never leave a field undefined.
      if (parsed && typeof parsed.id === 'string') {
        current = { ...blank(), ...parsed, id: parsed.id };
        return current;
      }
    }
  } catch {
    storable = false;
  }
  current = blank();
  return current;
}

function write(): void {
  if (!storable || !current) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Quota, or a private window that allows reads and refuses writes. Keep
    // playing from memory rather than failing.
    storable = false;
  }
}

/** The record for this browser. Safe to call anywhere, including on the server. */
export function player(): PlayerRecord {
  if (typeof localStorage === 'undefined') {
    storable = false;
    return (current ??= blank());
  }
  return read();
}

/** Apply a change and persist it. */
export function updatePlayer(patch: Partial<PlayerRecord>): PlayerRecord {
  const next = { ...player(), ...patch };
  current = next;
  write();
  return next;
}

/**
 * True when this browser has played before today.
 *
 * Deliberately NOT "has a stored record": the record is created on the first
 * load, so its mere existence says nothing. A returning player is one whose
 * first visit was on an earlier day.
 */
export function isReturning(): boolean {
  const p = player();
  return p.visits > 1 && p.firstSeen < new Date().toISOString().slice(0, 10);
}

/** Whether anything is actually being remembered, for the log to record. */
export function storageWorks(): boolean {
  player();
  return storable;
}

/** Count this page load. Call once, at start-up. */
export function countVisit(): PlayerRecord {
  const p = player();
  return updatePlayer({ visits: p.visits + 1 });
}
