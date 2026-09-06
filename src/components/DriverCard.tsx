import type { GameState } from '../game/types';
import { STAT_KEYS, STAT_LABELS, STYLE_LABELS, agePhaseLabel } from '../game/driverDevelopment';
import { ROLE_LABELS, estimatedMarketValue, formatMoney } from '../game/contractEngine';

export function DriverCard({ state }: { state: GameState }) {
  const p = state.player;
  const team = state.teams[p.teamId];
  const accent = team?.series === 'F1' ? team.colour : '#8892a4';
  const contractLabel =
    p.contract.seasons > 1
      ? `${p.contract.seasons} years`
      : p.contract.seasons === 1
        ? 'Final year'
        : 'Expiring';

  return (
    <div className="driver-card" style={{ ['--accent' as string]: accent }}>
      <div className="driver-card-top">
        <div className="driver-name">
          <h2>{p.name}</h2>
          <span className="driver-number">#{p.number}</span>
        </div>
        <div className="driver-meta">
          {p.flag} {team ? team.name : 'No team'}
          {state.reserveTeamId ? ' — Reserve driver' : ''} · {STYLE_LABELS[p.style]} driver
        </div>
      </div>

      <div className="ovr-block">
        <div>
          <div className="ovr-value">{p.overall}</div>
          <div className="ovr-label">Overall</div>
        </div>
        <div className="attr-list">
          {STAT_KEYS.map((key) => (
            <div className="attr-row" key={key}>
              <span>{STAT_LABELS[key]}</span>
              <span className="attr-bar">
                <span style={{ width: `${Math.min(100, p.stats[key])}%` }} />
              </span>
              <span className="attr-num">{Math.round(p.stats[key])}</span>
            </div>
          ))}
        </div>
      </div>

      <dl style={{ margin: 0 }}>
        <Row label="Age" value={`${p.age} — ${agePhaseLabel(p.age)}`} />
        <Row label="Series" value={p.series} />
        <Row label="Role" value={ROLE_LABELS[p.contract.role]} />
        <Row label="Salary" value={p.contract.salary > 0 ? `${formatMoney(p.contract.salary)}/yr` : '—'} />
        <Row label="Contract" value={contractLabel} />
        <Row label="Career earnings" value={formatMoney(p.careerEarnings)} />
        <Row label="Reputation" value={String(Math.round(p.career.reputation))} />
        <Row label="Market value" value={formatMoney(estimatedMarketValue(state))} />
        {p.academyTeamId ? (
          <Row label="Academy" value={state.teams[p.academyTeamId].name} />
        ) : null}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
