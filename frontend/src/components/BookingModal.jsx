import { useState } from 'react';
import { api, errorText, money } from '../api.js';
import SagaTimeline from './SagaTimeline.jsx';

/** Booking form for one event. Submitting runs the CREATE_BOOKING saga in the Booking Service. */
export default function BookingModal({ event, email, onBooked, goToBookings, onClose }) {
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: email,
    quantity: 1,
    simulatePaymentFailure: false,
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await api.createBooking({ ...form, eventId: event.id, quantity: Number(form.quantity) });
    setResult(r);
    setBusy(false);
    if (r.data.booking) onBooked(form.customerEmail.trim().toLowerCase());
  };

  const booking = result?.data.booking;
  const max = Math.min(10, event.availableTickets);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>{event.name}</h2>
        <p className="muted">
          {event.venue} · {money(event.price)} per ticket · {event.availableTickets} left
        </p>

        {!result && (
          <form onSubmit={submit} className="form">
            <label>
              Name
              <input required value={form.customerName} onChange={set('customerName')} />
            </label>
            <label>
              Email
              <input required type="email" value={form.customerEmail} onChange={set('customerEmail')} />
            </label>
            <label>
              Tickets (max {max})
              <input type="number" min="1" max={max} value={form.quantity} onChange={set('quantity')} />
            </label>
            <div className="total">Total: {money(event.price * Number(form.quantity || 0))}</div>
            <label className="check demo">
              <input type="checkbox" checked={form.simulatePaymentFailure} onChange={set('simulatePaymentFailure')} />
              Demo: simulate payment failure (triggers saga compensation)
            </label>
            <button className="btn" disabled={busy}>
              {busy ? 'Booking…' : 'Confirm booking'}
            </button>
          </form>
        )}

        {result && (
          <div>
            {result.status === 201 ? (
              <div className="alert success">
                Booking <b>CONFIRMED</b>: {booking.quantity} ticket(s), total {money(booking.totalAmount)}, payment
                ref {booking.paymentRef}
              </div>
            ) : (
              <div className="alert error">
                <b>HTTP {result.status}</b> {result.data.error && <code>{result.data.error}</code>}{' '}
                {errorText(result.data)}
                {booking && (
                  <div>
                    Booking status: <b>{booking.status}</b>
                  </div>
                )}
              </div>
            )}
            {result.data.saga && (
              <>
                <h3>Saga steps</h3>
                <SagaTimeline steps={result.data.saga} />
              </>
            )}
            <div className="row">
              {booking && (
                <button className="btn" onClick={goToBookings}>
                  View my bookings
                </button>
              )}
              <button className="btn ghost" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
