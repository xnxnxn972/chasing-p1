import { useEffect, useRef, useState } from 'react';
import type {
  Achievement,
  GameState,
  OutcomeView,
  PendingDecision,
  PendingNews,
  PendingOffers,
  PendingResult
} from '../game/types';
import { ROLE_LABELS, formatMoney } from '../game/contractEngine';
import { ordinal } from '../game/seasonSimulator';

/** One outcome row: odds chip, effect, and a clause of colour. */
function OutcomeRow({
  outcome,
  certain,
  state
}: {
  outcome: OutcomeView;
  certain: boolean;
  state?: 'idle' | 'rolling' | 'won' | 'lost';
}) {
  const classes = ['outcome', `tone-${outcome.tone}`];
  if (state && state !== 'idle') classes.push(`is-${state}`);
  return (
    <div className={classes.join(' ')}>
      {certain ? (
        <span className="outcome-arrow" aria-hidden="true">
          &rarr;
        </span>
      ) : (
        <span className="outcome-chance">{outcome.percent}%</span>
      )}
      <span className="outcome-text">
        <span className="outcome-effect">{outcome.effect}</span>
        {outcome.detail ? <span className="outcome-detail">{outcome.detail}</span> : null}
      </span>
    </div>
  );
}

/** A decision: the whole game, one card at a time. */
export function DecisionCard({
  step,
  onChoose
}: {
  step: PendingDecision;
  onChoose: (optionId: string) => void;
}) {
  return (
    <section className="panel panel-pad step-card">
      <div className="step-tag">{step.tag}</div>
      <h2 className="step-title">{step.title}</h2>
      <p className="step-body">{step.body}</p>
      <div className="options">
        {step.options.map((option, index) => (
          <button key={option.id} className="option" onClick={() => onChoose(option.id)}>
            <span className="option-index">{index + 1}</span>
            <div className="option-label">{option.label}</div>
            {option.detail ? <div className="option-detail">{option.detail}</div> : null}
            <div className="outcomes">
              {option.outcomes.map((outcome) => (
                <OutcomeRow key={outcome.id} outcome={outcome} certain={option.certain} />
              ))}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export function OffersCard({
  step,
  onSign,
  onDecline
}: {
  step: PendingOffers;
  onSign: (offerId: string) => void;
  onDecline: () => void;
}) {
  return (
    <section className="panel panel-pad step-card">
      <div className="step-tag">{step.tag}</div>
      <h2 className="step-title">{step.title}</h2>
      <p className="step-body">{step.body}</p>
      <div className="offers">
        {step.offers.map((offer) => (
          <button
            key={offer.id}
            className="offer"
            style={{ ['--accent' as string]: offer.colour }}
            onClick={() => onSign(offer.id)}
          >
            <h3>{offer.teamName}</h3>
            <div className="offer-salary">
              {offer.salary > 0
                ? `${formatMoney(offer.salary)}/season`
                : offer.isReserve
                  ? 'Retainer only'
                  : 'Unpaid seat'}
            </div>
            <div className="offer-rows">
              <div className="offer-row">
                <span>Series</span>
                <span>{offer.series}</span>
              </div>
              <div className="offer-row">
                <span>Car estimate</span>
                <span className="stars">
                  {offer.carStars > 0 ? '★'.repeat(offer.carStars) + '☆'.repeat(5 - offer.carStars) : '—'}
                </span>
              </div>
              <div className="offer-row">
                <span>Expectation</span>
                <span>{offer.expectation}</span>
              </div>
              <div className="offer-row">
                <span>Role</span>
                <span>{offer.isReserve ? 'Reserve' : ROLE_LABELS[offer.role]}</span>
              </div>
              <div className="offer-row">
                <span>Term</span>
                <span>
                  {offer.seasons} season{offer.seasons === 1 ? '' : 's'}
                  {offer.performanceClause ? ' · clause' : ''}
                </span>
              </div>
            </div>
            <p className="offer-pitch">
              {offer.carEstimate}. {offer.pitch}
            </p>
            <span className="sign">Sign {offer.teamName}</span>
          </button>
        ))}
      </div>
      {step.canDecline ? (
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-ghost" onClick={onDecline}>
            {step.declineLabel ?? 'Turn them all down'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * The reveal. The outcome is already decided by the engine before this mounts —
 * the cycling is presentation, not chance — but it is the beat that makes a
 * 45% gamble feel like one. It decelerates into the row that actually landed,
 * and is skipped entirely for anyone who asked for reduced motion.
 */
function RollReveal({ step, onContinue }: { step: PendingNews; onContinue: () => void }) {
  const roll = step.roll!;
  const resultIndex = Math.max(
    0,
    roll.outcomes.findIndex((o) => o.id === roll.resultId)
  );
  const [settled, setSettled] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (prefersReducedMotion() || roll.outcomes.length < 2) {
      setActive(resultIndex);
      setSettled(true);
      return;
    }
    let index = 0;
    let delay = 80;
    let elapsed = 0;
    const tick = () => {
      setActive(index % roll.outcomes.length);
      // Once past the minimum spin, stop the moment we are on the real result.
      if (elapsed > 850 && index % roll.outcomes.length === resultIndex) {
        setSettled(true);
        return;
      }
      index += 1;
      elapsed += delay;
      if (elapsed > 500) delay = Math.min(delay * 1.28, 320);
      timer.current = window.setTimeout(tick, delay);
    };
    timer.current = window.setTimeout(tick, delay);
    return () => window.clearTimeout(timer.current);
    // The roll is fixed for the life of this card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    window.clearTimeout(timer.current);
    setActive(resultIndex);
    setSettled(true);
  };

  return (
    <section className={`panel panel-pad step-card roll-card${settled ? ' is-settled' : ''}`}>
      <div className="step-tag">{step.tag}</div>
      <h2 className="step-title">{step.title}</h2>
      <div className="roll-option">{roll.optionLabel}</div>

      <div className="outcomes roll-outcomes" aria-live="polite">
        {roll.outcomes.map((outcome, i) => (
          <OutcomeRow
            key={outcome.id}
            outcome={outcome}
            certain={false}
            state={
              settled
                ? i === resultIndex
                  ? 'won'
                  : 'lost'
                : i === active
                  ? 'rolling'
                  : 'idle'
            }
          />
        ))}
      </div>

      {settled ? (
        <>
          <p className="step-body roll-note">{step.body}</p>
          <button className="btn btn-primary" onClick={onContinue}>
            {step.continueLabel}
          </button>
        </>
      ) : (
        <button className="btn btn-ghost roll-skip" onClick={skip}>
          Skip
        </button>
      )}
    </section>
  );
}

export function NewsCard({ step, onContinue }: { step: PendingNews; onContinue: () => void }) {
  if (step.roll) return <RollReveal key={step.roll.resultId + step.title} step={step} onContinue={onContinue} />;
  return (
    <section className="panel panel-pad step-card">
      <div className="step-tag">{step.tag}</div>
      <h2 className="step-title">{step.title}</h2>
      <p className="step-body">{step.body}</p>
      <button className="btn btn-primary" onClick={onContinue}>
        {step.continueLabel}
      </button>
    </section>
  );
}

export function ResultCard({
  step,
  state,
  onContinue
}: {
  step: PendingResult;
  state: GameState;
  onContinue: () => void;
}) {
  const r = step.report.result;
  const ovrDelta = r.driverOverallEnd - r.driverOverallStart;

  return (
    <section className="panel panel-pad step-card">
      <div className="step-tag">{r.year} season · {r.series}</div>
      <h2 className="step-title">
        {r.reserveYear
          ? `Reserve driver — ${r.teamName}`
          : `${ordinal(r.championshipPosition)} — ${r.teamName}`}
      </h2>

      {!r.reserveYear ? (
        <div className="result-stats">
          <Tile value={r.races} label="Races" />
          <Tile value={r.wins} label="Wins" />
          <Tile value={r.podiums} label="Podiums" />
          <Tile value={r.poles} label="Poles" />
          <Tile value={r.points} label="Points" />
          <Tile value={r.dnfs} label="DNFs" />
        </div>
      ) : null}

      <ul className="headlines">
        {step.report.headlines.map((h) => (
          <li key={h}>{h}</li>
        ))}
        {step.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
        <li>
          Rating {r.driverOverallStart} → {r.driverOverallEnd}{' '}
          {ovrDelta === 0 ? '(no change)' : `(${ovrDelta > 0 ? '+' : ''}${ovrDelta})`}
        </li>
      </ul>

      {step.newAchievements.length > 0 ? (
        <div className="achievements" style={{ marginBottom: 16 }}>
          {step.newAchievements.map((a) => (
            <AchievementBadge key={a.id} achievement={a} />
          ))}
        </div>
      ) : null}

      {step.report.standings.length > 0 ? (
        <>
          <details className="more">
            <summary>
              {r.series === 'F1' ? "Drivers' championship" : 'Championship standings'}
            </summary>
            <div className="table-scroll">
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Driver</th>
                    <th>Team</th>
                    <th>Pts</th>
                    <th>W</th>
                    <th>Pod</th>
                    <th>Pole</th>
                  </tr>
                </thead>
                <tbody>
                  {step.report.standings.slice(0, 12).map((row, i) => (
                    <tr key={row.driverId} className={row.isPlayer ? 'is-player' : ''}>
                      <td>{i + 1}</td>
                      <td>
                        {row.flag} {row.name}
                      </td>
                      <td>{row.teamName}</td>
                      <td>{row.points}</td>
                      <td>{row.wins}</td>
                      <td>{row.podiums}</td>
                      <td>{row.poles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {r.series === 'F1' ? (
            <details className="more">
              <summary>Constructors' championship</summary>
              <div className="table-scroll">
                <table className="standings-table">
                  <tbody>
                    {step.report.constructors.map((c, i) => (
                      <tr key={c.teamId} className={c.teamId === r.teamId ? 'is-player' : ''}>
                        <td style={{ width: 40 }}>{i + 1}</td>
                        <td>
                          <span className="team-dot" style={{ background: c.colour }} />
                          {c.teamName}
                        </td>
                        <td>{c.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </>
      ) : null}

      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onContinue}>
        {state.player.age >= 45 ? 'Finish' : 'Continue'}
      </button>
    </section>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat-tile">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

export function AchievementBadge({ achievement }: { achievement: Achievement }) {
  return (
    <div className="achievement">
      <b>{achievement.name}</b>
      <span>{achievement.description}</span>
    </div>
  );
}
