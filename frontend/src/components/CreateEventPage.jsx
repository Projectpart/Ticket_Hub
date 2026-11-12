import { useState } from 'react';
import { api, errorText } from '../api.js';

// datetime-local value one week from now, in local time
const nextWeek = () => {
  const d = new Date(Date.now() + 7 * 864e5);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function CreateEventPage({ onCreated }) {
  const [form, setForm] = useState({ name: '', venue: '', eventDate: nextWeek(), totalTickets: 50, price: 999 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await api.createEvent({
      name: form.name,
      venue: form.venue,
      eventDate: new Date(form.eventDate).toISOString(),
      totalTickets: Number(form.totalTickets),
      price: Number(form.price),
    });
    setBusy(false);
    if (r.ok) onCreated();
    else setError(errorText(r.data));
  };

  return (
    <section className="narrow">
      <h1>Create event</h1>
      <p className="muted">Creates the event and its ticket inventory in the Event Service.</p>
      {error && <div className="alert error">{error}</div>}
      <form className="form card" onSubmit={submit}>
        <label>
          Name
          <input required value={form.name} onChange={set('name')} />
        </label>
        <label>
          Venue
          <input required value={form.venue} onChange={set('venue')} />
        </label>
        <label>
          Date and time
          <input required type="datetime-local" value={form.eventDate} onChange={set('eventDate')} />
        </label>
        <div className="row">
          <label>
            Total tickets
            <input required type="number" min="1" value={form.totalTickets} onChange={set('totalTickets')} />
          </label>
          <label>
            Price (₹)
            <input required type="number" min="0" step="0.01" value={form.price} onChange={set('price')} />
          </label>
        </div>
        <button className="btn" disabled={busy}>
          {busy ? 'Creating…' : 'Create event'}
        </button>
      </form>
    </section>
  );
}
