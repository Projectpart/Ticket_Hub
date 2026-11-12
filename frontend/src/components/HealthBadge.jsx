import { useEffect, useState } from 'react';
import { api } from '../api.js';

/** Polls /health/ready of a service every 10 s; the tooltip shows which pod answered. */
export default function HealthBadge({ service, label }) {
  const [state, setState] = useState({ up: null, pod: '' });

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const r = await api.health(service);
      if (alive) setState({ up: r.ok, pod: r.data.pod || '' });
    };
    check();
    const timer = setInterval(check, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [service]);

  const cls = state.up === null ? 'unknown' : state.up ? 'up' : 'down';
  return (
    <span className={`health-badge ${cls}`} title={state.pod ? `answered by pod ${state.pod}` : ''}>
      <span className="dot" /> {label}
    </span>
  );
}
