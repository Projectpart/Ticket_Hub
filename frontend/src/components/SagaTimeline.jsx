import { when } from '../api.js';

const describe = (d) =>
  d
    ? Object.entries(d)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ')
    : '';

/** Renders the saga_steps audit log returned by the Booking Service. */
export default function SagaTimeline({ steps }) {
  if (!steps?.length) return <p className="muted">No saga steps recorded.</p>;
  return (
    <ol className="saga">
      {steps.map((s, i) => (
        <li key={i} className={`saga-step ${s.status.toLowerCase()}`}>
          <div className="saga-head">
            <span className="saga-name">{s.step.replaceAll('_', ' ')}</span>
            <span className={`chip ${s.status.toLowerCase()}`}>{s.status}</span>
          </div>
          <div className="saga-meta">
            {s.sagaType} · {when(s.at)}
          </div>
          {describe(s.details) && <div className="saga-details">{describe(s.details)}</div>}
        </li>
      ))}
    </ol>
  );
}
