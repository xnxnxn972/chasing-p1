/**
 * One row per play session, written to the shared Supabase project.
 *
 * Design rules, in order of importance:
 *  1. It must never break or delay the game. Every call is fire-and-forget and
 *     wrapped so a failure — offline, blocked, table missing — is silent.
 *  2. One row per session, updated in place, so the table reads as a log.
 *  3. The final update goes out with `keepalive` on page hide, which is the
 *     only thing that reliably survives a mobile browser being backgrounded.
 *
 * NOTE ON PERSONAL DATA: this records the visitor's IP address and coarse
 * location. That is personal data under GDPR/UK-GDPR. It is fine for a private
 * project; if this is ever shared publicly it needs a privacy note, and you may
 * prefer to drop `ip` and keep only `country`.
 */

// Same project as Flag Collection / Treasure Traitors. The anon key is public
// by design and is already committed elsewhere in this repo.
const SUPABASE_URL = 'https://hmvxanqkorcfxwsdusuj.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtdnhhbnFrb3JjZnh3c2R1c3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjI4OTgsImV4cCI6MjA5NTI5ODg5OH0.7o7OnhikQdgApqPTEIbhjOZ-YcKDU1fBFpcLXPXtEtA';

const TABLE = 'cp_sessions';
const REST = `${SUPABASE_URL}/rest/v1/${TABLE}`;

export interface SessionRow {
  session_id: string;
  env: 'prod' | 'dev';
  started_at: string;
  duration_s: number;
  /** Driver identity, from the setup screen. */
  driver_name: string | null;
  driver_number: number | null;
  nationality: string | null;
  style: string | null;
  seed: string | null;
  /** Where they got to. */
  careers_started: number;
  careers_finished: number;
  reached_f1: boolean;
  seasons: number;
  titles: number;
  career_title: string | null;
  career_score: number;
  /** Did they try to share? */
  shared: boolean;
  share_result: string | null;
  /** Who and where. */
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  screen: string | null;
  referrer: string | null;
  /** 'mobile' | 'tablet' | 'desktop'. */
  device: string | null;
  /** 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'ChromeOS' | 'other'. */
  platform: string | null;
  /** Which build produced this row. Rows are meaningless without it. */
  app_version: string | null;
  /**
   * Anything not worth a column of its own, yet. Adding a key here needs no
   * migration and no deploy coordination: old rows simply lack it, and queries
   * read it with `meta->>'key'`. Promote a key to a real column once it earns
   * an index.
   */
  meta: Record<string, unknown>;
}

/**
 * What they played on. Two traps this handles:
 *  - iPadOS 13+ sends a desktop Safari user agent; only the touch-point count
 *    gives it away, so an iPad would otherwise log as a Mac.
 *  - Android tablets send "Android" without "Mobile", which is the only thing
 *    separating them from phones.
 */
function detectDevice(): { device: string; platform: string } {
  if (typeof navigator === 'undefined') return { device: 'unknown', platform: 'unknown' };
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean; platform?: string } })
    .userAgentData;
  const ua = navigator.userAgent || '';
  const touch = navigator.maxTouchPoints ?? 0;

  const isIPadOS = /Macintosh/.test(ua) && touch > 1;
  const isIOS = /iPhone|iPod|iPad/.test(ua) || isIPadOS;
  const isAndroid = /Android/.test(ua);

  let platform: string;
  if (isIOS) platform = 'iOS';
  else if (isAndroid) platform = 'Android';
  else if (/Windows/.test(ua)) platform = 'Windows';
  else if (/CrOS/.test(ua)) platform = 'ChromeOS';
  else if (/Mac OS X|Macintosh/.test(ua)) platform = 'macOS';
  else if (/Linux/.test(ua)) platform = 'Linux';
  else platform = uaData?.platform || 'other';

  let device: string;
  if (/iPad/.test(ua) || isIPadOS || (isAndroid && !/Mobile/.test(ua))) device = 'tablet';
  else if (isIOS || isAndroid || /Mobi/.test(ua) || uaData?.mobile === true) device = 'mobile';
  else device = 'desktop';

  return { device, platform };
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

const started = Date.now();

/**
 * Two different clocks, because they answer different questions.
 *
 *  duration_s        wall clock from page load to the last write. Includes the
 *                    tab sitting idle or backgrounded.
 *  meta.active_s     time the page was actually VISIBLE, accumulated across
 *                    backgrounding. This is the "how long did they play" number.
 *
 * Visible-time is a proxy, not true engagement: a tab left open in the
 * foreground while the player makes coffee still counts. Measuring real
 * attention would need input tracking, which is not worth it here.
 */
let visibleSince = typeof document !== 'undefined' && document.visibilityState === 'visible'
  ? Date.now()
  : 0;
let activeMs = 0;

function pauseActive(): void {
  if (visibleSince) {
    activeMs += Date.now() - visibleSince;
    visibleSince = 0;
  }
}

function resumeActive(): void {
  if (!visibleSince) visibleSince = Date.now();
}

function activeSeconds(): number {
  return Math.round((activeMs + (visibleSince ? Date.now() - visibleSince : 0)) / 1000);
}

const row: SessionRow = {
  session_id: newId(),
  env: typeof location !== 'undefined' && /^(localhost|127\.|\[?::1)/.test(location.hostname) ? 'dev' : 'prod',
  started_at: new Date(started).toISOString(),
  duration_s: 0,
  driver_name: null,
  driver_number: null,
  nationality: null,
  style: null,
  seed: null,
  careers_started: 0,
  careers_finished: 0,
  reached_f1: false,
  seasons: 0,
  titles: 0,
  career_title: null,
  career_score: 0,
  shared: false,
  share_result: null,
  ip: null,
  country: null,
  city: null,
  user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
  screen: typeof window !== 'undefined' ? `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}` : null,
  referrer: typeof document !== 'undefined' ? document.referrer.slice(0, 300) || null : null,
  app_version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : null,
  meta: {},
  ...detectDevice()
};

let inserted = false;
let sending: Promise<void> | null = null;

function headers(extra: Record<string, string> = {}): HeadersInit {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra
  };
}

/** Look up IP and country once, best effort, never blocking. */
async function lookupGeo(): Promise<void> {
  try {
    const res = await fetch('https://ipwho.is/', { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { ip?: string; country?: string; city?: string; success?: boolean };
    if (data.success === false) return;
    row.ip = data.ip ?? null;
    row.country = data.country ?? null;
    row.city = data.city ?? null;
  } catch {
    // No geo. The row still goes out without it.
  }
}

/**
 * Columns the table might not have yet. PostgREST rejects an insert naming an
 * unknown column outright, so a schema migration that has not been run would
 * otherwise stop all logging silently. On that specific failure we drop the
 * newest fields and send the rest, and remember to keep doing so.
 */
const OPTIONAL_FIELDS: (keyof SessionRow)[] = ['device', 'platform', 'app_version', 'meta'];
let dropOptional = false;

function payload(): Partial<SessionRow> {
  if (!dropOptional) return row;
  const copy: Partial<SessionRow> = { ...row };
  for (const key of OPTIONAL_FIELDS) delete copy[key];
  return copy;
}

/** True when the failure is "that column does not exist". */
function isUnknownColumn(status: number, body: string): boolean {
  return status === 400 && /PGRST204|column .* does not exist|Could not find the/i.test(body);
}

async function push(keepalive = false): Promise<void> {
  row.duration_s = Math.round((Date.now() - started) / 1000);
  row.meta.active_s = activeSeconds();
  try {
    if (!inserted) {
      // A plain insert, deliberately NOT an upsert. `resolution=merge-duplicates`
      // turns this into INSERT ... ON CONFLICT DO UPDATE, which needs SELECT
      // rights on the table — and the log intentionally grants none, so Postgres
      // rejects it as an RLS violation. session_id is unique per session anyway.
      let res = await fetch(REST, {
        method: 'POST',
        headers: headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify(payload()),
        keepalive
      });
      if (!res.ok && !dropOptional && isUnknownColumn(res.status, await res.clone().text())) {
        dropOptional = true;
        res = await fetch(REST, {
          method: 'POST',
          headers: headers({ Prefer: 'return=minimal' }),
          body: JSON.stringify(payload()),
          keepalive
        });
      }
      if (res.ok) inserted = true;
      return;
    }
    const res = await fetch(`${REST}?session_id=eq.${encodeURIComponent(row.session_id)}`, {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(payload()),
      keepalive
    });
    if (!res.ok && !dropOptional && isUnknownColumn(res.status, await res.clone().text())) {
      dropOptional = true;
    }
  } catch {
    // Telemetry is never allowed to surface to the player.
  }
}

/** Coalesce rapid updates so a burst of events is one write. */
function schedule(keepalive = false): void {
  if (sending) return;
  sending = new Promise<void>((resolve) => {
    setTimeout(async () => {
      sending = null;
      await push(keepalive);
      resolve();
    }, keepalive ? 0 : 400);
  });
}

let installed = false;

export function initTelemetry(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  void lookupGeo().then(() => schedule());

  // `visibilitychange` is the only event that fires reliably when a mobile
  // browser is backgrounded or the tab is closed; `pagehide` covers the rest.
  const flush = () => {
    if (document.visibilityState === 'hidden') {
      // Stop the active clock BEFORE writing, so the flushed row does not bill
      // the player for time spent with the tab in the background.
      pauseActive();
      void push(true);
    } else {
      resumeActive();
    }
  };
  document.addEventListener('visibilitychange', flush);
  window.addEventListener('pagehide', () => {
    pauseActive();
    void push(true);
  });
}

export function trackCareerStart(setup: {
  name: string;
  number: number;
  nationality: string;
  style: string;
  seed: string;
}): void {
  row.careers_started += 1;
  row.driver_name = setup.name.slice(0, 60);
  row.driver_number = setup.number;
  row.nationality = setup.nationality;
  row.style = setup.style;
  row.seed = setup.seed;
  schedule();
}

export function trackCareerEnd(summary: {
  seasons: number;
  reachedF1: boolean;
  titles: number;
  careerTitle: string;
  score: number;
}): void {
  row.careers_finished += 1;
  row.seasons = summary.seasons;
  row.reached_f1 = summary.reachedF1 || row.reached_f1;
  // Keep the best career of the session, so one row still tells the story.
  if (summary.score >= row.career_score) {
    row.titles = summary.titles;
    row.career_title = summary.careerTitle;
    row.career_score = summary.score;
  }
  schedule();
}

/**
 * Record anything else, with no schema change required. Use this first; move a
 * key into its own column only once you want to index or group by it.
 *
 *   trackExtra('reached_summary', true)
 *   trackExtra('decisions_taken', 14)
 */
export function trackExtra(key: string, value: unknown): void {
  row.meta[key] = value;
  schedule();
}

export function trackShare(result: string): void {
  row.shared = true;
  row.share_result = result;
  schedule();
}

/** For debugging from the console. */
export function telemetrySnapshot(): SessionRow {
  return {
    ...row,
    duration_s: Math.round((Date.now() - started) / 1000),
    meta: { ...row.meta, active_s: activeSeconds() }
  };
}
