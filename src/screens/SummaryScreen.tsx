import { useMemo, useState } from 'react';
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

export function SummaryScreen({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const canShare = useMemo(() => canShareImages(), []);
  const totals = useMemo(() => computeTotals(state), [state]);
  const score = careerScore(state, totals);
  const title = careerTitle(state, totals);
  const verdict = careerVerdict(state, totals);
  const percentile = scorePercentile(score);

  const f1Seasons = state.history.filter((h) => h.series === 'F1' && !h.reserveYear);
  const teamPath: string[] = [];
  for (const s of f1Seasons) if (teamPath[teamPath.length - 1] !== s.teamName) teamPath.push(s.teamName);
  const peakOverall = state.history.reduce((max, h) => Math.max(max, h.driverOverallEnd), 0);
  const peakValue = state.history.reduce((max, h) => Math.max(max, h.salary), 0);
  const firstYear = state.history[0]?.year ?? state.year;
  const lastYear = state.history[state.history.length - 1]?.year ?? state.year;

  const shareText = [
    `${title} — ${state.player.name} ${state.player.flag} #${state.player.number}`,
    `F1 CAREER ${f1Seasons[0]?.year ?? '—'}–${lastYear}`,
    totals.titles > 0 ? `${'🏆'.repeat(Math.min(totals.titles, 8))} ${totals.titles}× WORLD CHAMPION` : 'NO TITLES',
    `${totals.f1Wins} wins · ${totals.f1Podiums} podiums · ${totals.f1Poles} poles`,
    teamPath.join(' → ') || 'Never reached Formula 1',
    `Peak OVR ${peakOverall} · Career score ${score.toLocaleString()} (${percentile})`,
    `Seed ${state.seed}`
  ].join('\n');

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
          <div className="actions" style={{ marginTop: 18 }}>
            <button
              className="btn btn-primary"
              disabled={sharing}
              onClick={async () => {
                setSharing(true);
                setShareNote(null);
                const result = await shareCareerCard(shareDataFor(state));
                setSharing(false);
                if (result === 'downloaded') setShareNote('Image saved');
                else if (result === 'failed') setShareNote('Could not create the image');
              }}
            >
              {sharing ? 'Preparing…' : canShare ? 'Share career' : 'Save career image'}
            </button>
            <button className="btn" onClick={onRestart}>
              Play again
            </button>
          </div>
          <div className="share-actions">
            <button
              className="btn btn-ghost"
              onClick={() => {
                navigator.clipboard?.writeText(shareText).then(
                  () => setCopied(true),
                  () => setCopied(false)
                );
              }}
            >
              {copied ? 'Copied to clipboard' : 'Copy as text'}
            </button>
            {shareNote ? <span className="share-note">{shareNote}</span> : null}
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
