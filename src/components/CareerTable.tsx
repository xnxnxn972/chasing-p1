import type { GameState, SeasonResult } from '../game/types';
import { ordinal } from '../game/seasonSimulator';

/** The growing career record — the emotional payoff of the whole game. */
export function CareerTable({ state, title = 'Career record' }: { state: GameState; title?: string }) {
  if (state.history.length === 0) {
    return (
      <section className="panel panel-pad">
        <div className="eyebrow">{title}</div>
        <p className="hint" style={{ marginTop: 10 }}>
          Nothing yet. Your first season starts here.
        </p>
      </section>
    );
  }

  return (
    <section className="panel panel-pad">
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        {title}
      </div>
      <div className="table-scroll">
        <table className="standings-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Age</th>
              <th>Series</th>
              <th>Team</th>
              <th>OVR</th>
              <th>Starts</th>
              <th>W</th>
              <th>Pod</th>
              <th>Pole</th>
              <th>Pts</th>
              <th>Pos</th>
            </tr>
          </thead>
          <tbody>
            {state.history.map((row) => (
              <Row key={`${row.year}-${row.teamId}`} row={row} colour={state.teams[row.teamId]?.colour} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({ row, colour }: { row: SeasonResult; colour?: string }) {
  return (
    <tr className={row.championshipPosition === 1 && !row.reserveYear ? 'is-player' : ''}>
      <td style={{ fontFamily: 'var(--body)' }}>{row.year}</td>
      <td>{row.age}</td>
      <td style={{ fontFamily: 'var(--body)' }}>{row.series}</td>
      <td>
        {row.series === 'F1' && colour ? (
          <span className="team-dot" style={{ background: colour }} />
        ) : null}
        {row.teamName}
        {row.reserveYear ? ' (reserve)' : ''}
      </td>
      <td>{row.driverOverallEnd}</td>
      <td>{row.races}</td>
      <td>{row.wins}</td>
      <td>{row.podiums}</td>
      <td>{row.poles}</td>
      <td>{row.points}</td>
      <td>{row.reserveYear ? '—' : ordinal(row.championshipPosition)}</td>
    </tr>
  );
}
