import { useCallback, useEffect, useState } from 'react';
import { api, errorText, money, when } from '../api.js';
import SagaTimeline from './SagaTimeline.jsx';

/**
 * One booking: API-composition details (booking + event), the saga audit log,
 * and the CANCEL_BOOKING saga.
 */
export default function BookingDetail({ id, onChanged }) {
  const [details, setDetails] = useState(null);
  const [saga, setSaga] = useState([]);
  const [error, setError] = useState('');
  const [simulateRefundFailure, setSimulateRefundFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelResult, setCancelResult] = useState(null);

  const load = useCallback(async () => {
    const [d, s] = await Promise.all([api.bookingDetails(id), api.sagaLog(id)]);
    if (d.ok) setDetails(d.data);
    else setError(errorText(d.data));
    if (s.ok) setSaga(s.data.steps);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async () => {
    setBusy(true);
    const r = await api.cancelBooking(id, simulateRefundFailure);
    setCancelResult(r);
    setBusy(false);
    await load();
    onChanged();
  };

  if (error) return <div className="detail alert error">{error}</div>;
  if (!details) return <div className="detail muted">Loading…</div>;

  const ev = details.event;
  const cancellable = details.status === 'CONFIRMED' || details.status === 'CANCELLING';

  return (
    <div className="detail">
      <div className="detail-grid">
        <div>
          <h3>Event</h3>
          {ev ? (
            <>
              <div className="strong">{ev.name}</div>
              <div className="muted">
                {ev.venue} · {when(ev.eventDate)}
              </div>
            </>
          ) : (
            <div className="alert warn">{details.warning || 'Event details unavailable'}</div>
          )}
        </div>
        <div>
          <h3>Booking</h3>
          <dl>
            <dt>Customer</dt>
            <dd>
              {details.customerName} ({details.customerEmail})
            </dd>
            <dt>Tickets</dt>
            <dd>
              {details.quantity} × {money(details.unitPrice)} = {money(details.totalAmount)}
            </dd>
            <dt>Payment ref</dt>
            <dd className="mono">{details.paymentRef || '–'}</dd>
            <dt>Refund ref</dt>
            <dd className="mono">{details.refundRef || '–'}</dd>
            {details.failureReason && (
              <>
                <dt>Failure</dt>
                <dd>{details.failureReason}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {cancellable && (
        <div className="cancel-box">
          <button className="btn danger" disabled={busy} onClick={cancel}>
            {busy ? 'Cancelling…' : details.status === 'CANCELLING' ? 'Retry cancellation' : 'Cancel booking'}
          </button>
          <label className="check demo">
            <input
              type="checkbox"
              checked={simulateRefundFailure}
              onChange={(e) => setSimulateRefundFailure(e.target.checked)}
            />
            Demo: simulate refund failure
          </label>
        </div>
      )}

      {cancelResult && (
        <div className={`alert ${cancelResult.status === 200 ? 'success' : cancelResult.status === 202 ? 'warn' : 'error'}`}>
          <b>HTTP {cancelResult.status}</b>{' '}
          {cancelResult.status === 200
            ? `Booking ${cancelResult.data.booking.status}. Refund ref ${cancelResult.data.booking.refundRef || '–'}`
            : errorText(cancelResult.data)}
        </div>
      )}

      <h3>Saga log</h3>
      <SagaTimeline steps={saga} />
    </div>
  );
}
