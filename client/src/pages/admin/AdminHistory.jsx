import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Alert } from '../../components.jsx';

function localDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDayBounds(value) {
  const [year, month, day] = value.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function AdminHistory() {
  const [date, setDate] = useState(() => localDateValue(new Date()));
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const { start, end } = localDayBounds(date);
    setError('');
    api(`/admin/history?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .then((items) => { if (active) setEvents(items); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [date]);

  return (
    <>
      <div className="row between wrap">
        <h2>Admin history</h2>
        <label>Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>
      <Alert>{error}</Alert>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Timestamp</th><th>Admin</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.timestamp).toLocaleString()}</td>
                <td>{event.admin}</td>
                <td><strong>{event.action}</strong></td>
                <td className="muted">{event.detail || '—'}</td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan="4" className="muted">No admin activity for this date.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}