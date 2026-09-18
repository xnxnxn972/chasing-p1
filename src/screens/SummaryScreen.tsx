import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '../game/types';
import {
  careerScore,
  careerTitle,
  careerVerdict,
  computeTotals,
  scorePercentile
} from '../game/careerVerdict';
import { formatMoney } from '../game/contractEngine';
import { CareerTable } from '../components/CareerTable';
import { AchievementBadge } from '../components/StepCard';
import { BrandLockup, RuleBar, TAGLINE } from '../components/Brand';
import { canShareImages, shareCareerCard, shareDataFor } from '../components/shareCard';
import { trackExtra, trackPromptShown, trackShare } from '../game/telemetry';
import { ambitionOutcome, nextAmbition } from '../game/unfinishedBusiness';
import { challengeOutcome, shouldInviteChallenge } from '../game/challenge';

export function SummaryScreen({
  state,
  onRestart,
  previousBest = 0,
  careerIndex = 1
}: {
  state: GameState;
  onRestart: () => void;
  /** Best score of the careers played BEFORE this one, this visit. */
  previousBest?: number;
  careerIndex?: number;
}) {
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const canShare = useMemo(() => canShareImages(), []);
  // Counts presses within one career, so a cancel-then-retry is visible.
  const shareAttempts = useRef(0);
  const totals = useMemo(() => computeTotals(state), [state]);
  const score = careerScore(state, totals);
  const title = careerTitle(state, totals);
  const verdict = careerVerdict(state, totals);
  const percentile = scorePercentile(score);
  // What the last career asked of this one, and what this one leaves behind.
  const carried = ambitionOutcome(state, totals);
  const next = nextAmbition(state, totals);
  // A challenge someone sent, and whether this career answered it.
  const challenge = challengeOutcome(state.challengeScore, score);
  // Whether this is the moment worth interrupting someone to share.
  const invite = shouldInviteChallenge({ score, careerIndex, previousBest });

  // Record that the prompt was actually put in front of this player, so its
  // effect can be measured against unprompted careers in the same build.
  useEffect(() => {
    if (invite) trackPromptShown(score);
  }, [invite, score]);

  const f1Seasons = state.history.filter((h) => h.series === 'F1' && !h.reserveYear);
  const teamPath: string[] = [];
  for (const s of f1Seasons) if (teamPath[teamPath.length - 1] !== s.teamName) teamPath.push(s.teamName);
  const peakOverall = state.history.reduce((max, h) => Math.max(max, h.driverOverallEnd), 0);
  const peakValue = state.history.reduce((max, h) => Math.max(max, h.salary), 0);
  const firstYear = state.history[0]?.year ?? state.year;
  const lastYear = state.history[state.history.length - 1]?.year ?? state.year;

  return (
    <div className="app">
      <RuleBar left="Chasing P1" right="Career summary" accent />

      <header className="summary-hero">
        <h1 className="summary-title">{title}</h1>
        <h2 className="summary-name">
          {state.player.flag} {state.player.name} #{state.player.number}
        </h2>
        <div className="summary-sub">
          {firstYear}–{lastYear} · Retired at {state.player.retiredAge ?? state.player.age} · Peak OVR{' '}
          {peakOverall}
        </div>
      </header>

      <div className="stack">
        <div className="big-stats">
          <Stat value={totals.f1Starts} label="Grands Prix" />
          <Stat value={totals.f1Wins} label="Wins" />
          <Stat value={totals.f1Podiums} label="Podiums" />
          <Stat value={totals.f1Poles} label="Poles" />
          <Stat value={totals.titles} label="World titles" />
        </div>

        <section className="panel panel-pad">
          <p className="verdict">{verdict}</p>
        </section>

        <div className="share-card">
          <BrandLockup size="md" />
          <h2 className="summary-title" style={{ fontSize: 'clamp(32px, 6vw, 56px)' }}>
            {title}
          </h2>
          <h3 style={{ fontSize: 24 }}>
            {state.player.name} {state.player.flag} #{state.player.number}
          </h3>
          {totals.titles > 0 ? (
            <div style={{ fontSize: 26, marginTop: 10 }}>
              {'🏆'.repeat(Math.min(totals.titles, 8))}
              <div className="eyebrow" style={{ marginTop: 4 }}>
                {totals.titles}× World Champion
              </div>
            </div>
          ) : null}
          <div className="teams-path">{teamPath.join(' → ') || 'Never reached Formula 1'}</div>
          <div className="big-stats" style={{ marginTop: 18 }}>
            <Stat value={totals.f1Wins} label="Wins" />
            <Stat value={totals.f1Podiums} label="Podiums" />
            <Stat value={totals.f1Poles} label="Poles" />
            <Stat value={peakOverall} label="Peak OVR" />
          </div>
          <div className="score-row">
            <span className="score">{score.toLocaleString()}</span>
            <span className="percentile">{percentile}</span>
          </div>
          {invite && (
            <div className="share-invite">
              <span className="label">Your best yet</span>
              <p>
                Career {careerIndex}, and better than anything you have managed today
                {previousBest > 0 ? ` — ${previousBest.toLocaleString()} was your last best.` : '.'}{' '}
                Send it to someone and see if they can beat {score.toLocaleString()}.
              </p>
            </div>
          )}

          <div className="actions" style={{ marginTop: 18 }}>
            <button
              className="btn btn-primary"
              disabled={sharing}
              onClick={async () => {
                setSharing(true);
                setShareNote(null);
                shareAttempts.current += 1;
                const trace = await shareCareerCard(shareDataFor(state));
                trackShare(trace.result);
                // Why a share went the way it did. See ShareTrace for what
                // each field separates; `attempts` catches the player who
                // cancels and immediately tries again, which reads as a
                // failed sheet rather than a changed mind.
                trackExtra('share_path', trace.path);
                trackExtra('share_render_ms', trace.renderMs);
                trackExtra('share_sheet_ms', trace.sheetMs);
                trackExtra('share_attempts', shareAttempts.current);
                setSharing(false);
                if (trace.result === 'downloaded') setShareNote('Image saved');
                else if (trace.result === 'failed') setShareNote('Could not create the image');
              }}
            >
              {sharing ? 'Preparing…' : canShare ? 'Share career' : 'Save career image'}
            </button>
            <button className="btn" onClick={onRestart}>
              Play again
            </button>
            {shareNote ? <span className="share-note">{shareNote}</span> : null}
          </div>

          {/* THE REASON TO PRESS IT, not a second button.
              "Challenge yourself" and "Play again" started the same career and
              differed only in wording, so one of them had to go. The ambition
              works better as the sentence attached to the action than as a
              panel underneath asking the player to look somewhere else. */}
          {next ? (
            <p className="next-challenge">
              <span className="label">Unfinished business</span>
              But this time, challenge yourself to {next.label.charAt(0).toLowerCase() + next.label.slice(1)}.
            </p>
          ) : (
            <p className="next-challenge">
              <span className="label">Nothing left to prove</span>
              You have done everything this sport can ask of a driver. Start again and see whether
              it was you or the car.
            </p>
          )}

          {/* The career is over; this is the only thing on the page that points
              forward. It sits directly under the buttons for that reason. */}
          <div className="unfinished">
            {challenge && (
              <div className={`ambition-result${challenge.beaten ? ' is-met' : ''}`}>
                <span className="label">
                  {challenge.beaten ? 'Challenge beaten' : 'Challenge not beaten'}
                </span>
                <p>
                  {challenge.beaten
                    ? `You were set ${challenge.target.toLocaleString()} to beat. You finished ${challenge.margin.toLocaleString()} clear of it.`
                    : `You were set ${challenge.target.toLocaleString()} to beat and came up ${challenge.margin.toLocaleString()} short.`}
                </p>
              </div>
            )}
            {carried && (
              <div className={`ambition-result${carried.met ? ' is-met' : ''}`}>
                <span className="label">{carried.met ? 'Ambition met' : 'Ambition missed'}</span>
                <p>{carried.met ? carried.ambition.done : carried.ambition.missed}</p>
              </div>
            )}
          </div>
        </div>

        <section className="panel panel-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Career totals
          </div>
          <div className="big-stats">
            <Stat value={formatMoney(state.player.careerEarnings)} label="Career earnings" />
            <Stat value={formatMoney(peakValue)} label="Peak salary" />
            <Stat value={teamPath.length} label="F1 teams" />
            <Stat value={totals.juniorTitles} label="Junior titles" />
            <Stat value={state.history.length} label="Seasons raced" />
          </div>
        </section>

        {state.achievements.length > 0 ? (
          <section className="panel panel-pad">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Achievements ({state.achievements.length})
            </div>
            <div className="achievements">
              {state.achievements.map((a) => (
                <AchievementBadge key={a.id} achievement={a} />
              ))}
            </div>
          </section>
        ) : null}

        <CareerTable state={state} title="Full timeline" />

        <div className="actions">
          <button className="btn btn-primary" onClick={onRestart}>
            Start a new career
          </button>
        </div>

        <div className="page-foot">
          <RuleBar left="Chasing P1" right={TAGLINE} accent />
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="big-stat">
      <b>{typeof value === 'number' ? value.toLocaleString() : value}</b>
      <span>{label}</span>
    </div>
  );
}
