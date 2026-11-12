import { useState } from 'react';
import EventsPage from './components/EventsPage.jsx';
import BookingsPage from './components/BookingsPage.jsx';
import CreateEventPage from './components/CreateEventPage.jsx';
import HealthBadge from './components/HealthBadge.jsx';

const TABS = [
  ['events', 'Events'],
  ['bookings', 'My bookings'],
  ['create', 'Create event'],
];

export default function App() {
  const [tab, setTab] = useState('events');
  const [email, setEmailState] = useState(() => localStorage.getItem('tickethub.email') || '');
  const setEmail = (value) => {
    setEmailState(value);
    localStorage.setItem('tickethub.email', value);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">TH</span> TicketHub
        </div>
        <nav className="tabs">
          {TABS.map(([key, label]) => (
            <button key={key} className={tab === key ? 'tab active' : 'tab'} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="health">
          <HealthBadge service="event" label="Event Service" />
          <HealthBadge service="booking" label="Booking Service" />
        </div>
      </header>

      <main className="content">
        {tab === 'events' && (
          <EventsPage email={email} onBooked={setEmail} goToBookings={() => setTab('bookings')} />
        )}
        {tab === 'bookings' && <BookingsPage email={email} setEmail={setEmail} />}
        {tab === 'create' && <CreateEventPage onCreated={() => setTab('events')} />}
      </main>
    </div>
  );
}
