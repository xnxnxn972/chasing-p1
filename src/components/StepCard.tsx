import type {
  Achievement,
  GameState,
  PendingDecision,
  PendingNews,
  PendingOffers,
  PendingResult
} from '../game/types';
import { ROLE_LABELS, formatMoney } from '../game/contractEngine';
import { ordinal } from '../game/seasonSimulator';

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
        {step.options.map((option) => (
          <button key={option.id} className="option" onClick={() => onChoose(option.id)}>
            <div className="option-label">{option.label}</div>
            {option.detail ? <div className="option-detail">{option.detail}</div> : null}
            {(option.pros?.length || option.cons?.length) ? (
              <div className="option-effects">
                {option.pros?.map((p) => (
                  <span className="pro" key={p}>
                    + {p}
                  </span>
                ))}
                {option.cons?.map((c) => (
                  <span className="con" key={c}>
                    − {c}
                  </span>
                ))}
              </div>
            ) : null}
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

export function NewsCard({ step, onContinue }: { step: PendingNews; onContinue: () => void }) {
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
