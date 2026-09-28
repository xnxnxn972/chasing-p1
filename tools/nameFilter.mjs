/**
 * Chasing P1 — keep slurs off the leaderboard.
 *
 * Driver names are free text typed by the player, and on 28 September a racial
 * slur reached row 5 of "Best careers played" on the dashboard. The game cannot
 * stop someone typing whatever they like into their own copy, but it has no
 * business ranking it and showing it back.
 *
 * REDACTS RATHER THAN DROPS. The career itself is real: the score, the titles
 * and the seasons all happened, and removing the row would quietly distort a
 * ranking that claims to show the best careers played. Only the label is
 * unusable, so only the label is replaced.
 *
 * TWO TIERS, because one rule cannot serve both halves of the list. The first
 * version of this file matched every term as a substring and collapsed
 * repeated letters everywhere, which redacted Cooney and Spicer: collapsing
 * turned "coon" into "con", and "spic" sits inside "Spicer". Short terms are
 * now matched as whole words and long ones as substrings, which keeps
 * "Bigchink" caught while leaving ordinary surnames alone.
 *
 * Still biased towards over-redacting where the two tiers leave a choice. A
 * name wrongly withheld costs a line of curiosity on a private report; a slur
 * wrongly shown is the failure this file exists to prevent.
 *
 * NOTE: this repository is public, so the list below is readable. That is
 * ordinary for a filter of this kind, but if you would rather it were not,
 * the list is the only part that needs to move somewhere ignored.
 */

// Unambiguous slurs only. General profanity is deliberately absent: it is not
// the problem observed, and matching it produces false positives on ordinary
// names without making the leaderboard any safer to look at.
const TERMS = [
  'nigger', 'nigga', 'chink', 'kike', 'gook', 'spic', 'wetback',
  'faggot', 'tranny', 'paki', 'coon', 'raghead', 'towelhead'
];

// At five letters a term is specific enough that finding it inside a longer
// string means what it looks like. Below that it is usually somebody's name.
const SUBSTRING_MIN = 5;

const LEET = { '4': 'a', '@': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', '5': 's', '$': 's', '7': 't' };

/** Lowercase, undo simple leetspeak, drop everything that is not a letter. */
function normalise(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[4@315!0$7]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, '');
}

/** Collapse runs of the same letter, so niiigggerr reads the same as nigger. */
const collapse = (s) => s.replace(/(.)\1+/g, '$1');

const norm = TERMS.map(normalise);
// Long terms: matched anywhere in the name, in both spellings.
const SUBSTRINGS = [...new Set(norm.filter((t) => t.length >= SUBSTRING_MIN).flatMap((t) => [t, collapse(t)]))];
// Short terms: matched only as a whole word. Compared collapsed as well as
// written, so "coooon" is caught while "Cooney" is not, because this is an
// equality test rather than a search.
const WHOLE_WORDS = [...new Set(norm.filter((t) => t.length < SUBSTRING_MIN).flatMap((t) => [t, collapse(t)]))];

export function isSlur(name) {
  const s = String(name ?? '');
  const joined = normalise(s);
  if (!joined) return false;
  if (SUBSTRINGS.some((t) => joined.includes(t) || collapse(joined).includes(t))) return true;

  // Split on anything that is not a letter or digit, so "spic_boy" and
  // "spic.boy" are two words rather than one.
  const words = s.split(/[^\p{L}\p{N}]+/u).map(normalise).filter(Boolean);
  return words.some((w) => WHOLE_WORDS.includes(w) || WHOLE_WORDS.includes(collapse(w)));
}

/**
 * The dashboard stores a player as one display string, "Name #27 (GB)". Keep
 * the number and the country, which are not the offensive part and are what
 * make the row identifiable if it ever needs looking up in the log.
 */
export function cleanPlayerLabel(label) {
  const s = String(label ?? '');
  const m = s.match(/^(.*?)(\s*#\d+.*)$/);
  const name = m ? m[1] : s;
  const tail = m ? m[2] : '';
  return isSlur(name) ? `[name withheld]${tail}` : s;
}
