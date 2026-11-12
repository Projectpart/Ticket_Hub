import { useCallback, useEffect, useState } from 'react';
import { api, errorText, money, when } from '../api.js';
import BookingDetail from './BookingDetail.jsx';

export default function BookingsPage({ email, setEmail }) {
  const [query, setQuery] = useState(email);
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    if (!email) return;
    const r = await api.listBookings(email);
    if (r.ok) {
      setBookings(r.data);
      setError('');
    } else {
      setError(errorText(r.data));
    }
  }, [email]);

  useEffect(() => {
    load();
  }, [load]);

  const search = (e) => {
    e.preventDefault();
    setOpenId(null);
    setEmail(query.trim().toLowerCase());
  };

  return (
    <section>
      <div className="page-head">
        <h1>My bookings</h1>
        <form className="actions" onSubmit={search}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn">Find</button>
        </form>
      </div>

      {error && <div className="alert error">Booking Service: {error}</div>}
      {!email && <p className="muted">Enter the email you booked with.</p>}
      {bookings && !bookings.length && <p className="muted">No bookings for {email}.</p>}

      {bookings?.length > 0 && (
        <div className="table">
          <div className="tr th">
            <span>Booking</span>
            <span>Event</span>
            <span>Tickets</span>
            <span>Total</span>
            <span>Status</span>
            <span>Created</span>
          </div>
          {bookings.map((b) => (
            <div key={b.id}>
              <button className={`tr ${openId === b.id ? 'open' : ''}`} onClick={() => setOpenId(openId === b.id ? null : b.id)}>
                <span className="mono">{b.id.slice(0, 8)}</span>
                <span>#{b.eventId}</span>
                <span>{b.quantity}</span>
                <span>{money(b.totalAmount)}</span>
                <span>
                  <span className={`chip ${b.status.toLowerCase()}`}>{b.status}</span>
                </span>
                <span className="muted">{when(b.createdAt)}</span>
              </button>
              {openId === b.id && <BookingDetail id={b.id} onChanged={load} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
