// Thin client for the two TicketHub microservices. All calls go to the same
// origin under /event-api and /booking-api; the dev server (Vite) or nginx
// (Kubernetes) forwards them to the real services.
const EVENT = '/event-api/api/v1';
const BOOKING = '/booking-api/api/v1';

async function request(url, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: 'NETWORK_ERROR', message: err.message } };
  }
}

export const api = {
  health: (service) => request(`/${service}-api/health/ready`),

  // Event Service
  listEvents: (onlyAvailable) => request(`${EVENT}/events${onlyAvailable ? '?available=true' : ''}`),
  createEvent: (event) => request(`${EVENT}/events`, { method: 'POST', body: event }),

  // Booking Service
  createBooking: (booking) => request(`${BOOKING}/bookings`, { method: 'POST', body: booking }),
  listBookings: (customerEmail) =>
    request(`${BOOKING}/bookings${customerEmail ? `?customerEmail=${encodeURIComponent(customerEmail)}` : ''}`),
  bookingDetails: (id) => request(`${BOOKING}/bookings/${id}/details`),
  sagaLog: (id) => request(`${BOOKING}/bookings/${id}/saga`),
  cancelBooking: (id, simulateRefundFailure) =>
    request(`${BOOKING}/bookings/${id}/cancel`, { method: 'POST', body: { simulateRefundFailure } }),
};

/** Human-readable message from an API error body {error, message, details}. */
export function errorText(data) {
  const parts = [data.message || data.error || 'Request failed'];
  if (Array.isArray(data.details)) parts.push(data.details.join('; '));
  else if (data.details && typeof data.details === 'object') {
    parts.push(Object.entries(data.details).map(([k, v]) => `${k}: ${v}`).join(', '));
  }
  return parts.join(' — ');
}

export const money = (n) =>
  n === null || n === undefined ? '–' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const when = (iso) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
