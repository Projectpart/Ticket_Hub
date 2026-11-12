import { useCallback, useEffect, useState } from 'react';
import { api, errorText, money, when } from '../api.js';
import BookingModal from './BookingModal.jsx';

export default function EventsPage({ email, onBooked, goToBookings }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api.listEvents(onlyAvailable);
    if (r.ok) {
      setEvents(r.data);
      setError('');
    } else {
      setError(errorText(r.data));
    }
    setLoading(false);
  }, [onlyAvailable]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section>
      <div className="page-head">
        <h1>Upcoming events</h1>
        <div className="actions">
          <label className="check">
            <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
            Only with tickets left
          </label>
          <button className="btn ghost" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert error">Event Service: {error}</div>}
      {loading && !events.length && <p className="muted">Loading events…</p>}
      {!loading && !error && !events.length && <p className="muted">No events yet. Create one in “Create event”.</p>}

      <div className="grid">
        {events.map((ev) => {
          const past = new Date(ev.eventDate) < new Date();
          const soldOut = ev.availableTickets === 0;
          const pct = Math.round((ev.availableTickets / ev.totalTickets) * 100);
          return (
            <article key={ev.id} className="card event">
              <div className="event-date">{when(ev.eventDate)}</div>
              <h2>{ev.name}</h2>
              <div className="muted">{ev.venue}</div>
              <div className="price">{money(ev.price)}</div>
              <div className="stock">
                <div className="bar">
                  <div className={`fill ${pct <= 20 ? 'low' : ''}`} style={{ width: `${pct}%` }} />
                </div>
                <span>
                  {ev.availableTickets} / {ev.totalTickets} left
                </span>
              </div>
              <button className="btn" disabled={past || soldOut} onClick={() => setSelected(ev)}>
                {past ? 'Event closed' : soldOut ? 'Sold out' : 'Book tickets'}
              </button>
            </article>
          );
        })}
      </div>

      {selected && (
        <BookingModal
          event={selected}
          email={email}
          onBooked={onBooked}
          goToBookings={goToBookings}
          onClose={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </section>
  );
}
