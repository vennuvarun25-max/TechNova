import { useState } from 'react';
import { api } from '../../api.js';
import { useTimer } from '../../hooks.js';
import { Alert, ConfirmModal, TimerView } from '../../components.jsx';

export default function AdminTimer() {
  const t = useTimer();
  const [minutes, setMinutes] = useState('');
  const [err, setErr] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const act = async (action, body) => {
    setErr('');
    try { await api(`/admin/timer/${action}`, { method: 'POST', body }); await t.reload(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <>
      <h2>Competition timer</h2>
      <Alert>{err}</Alert>
      <div className="card center">
        <TimerView t={t} big />
        <p className="muted">Total duration: {t.ready ? `${Math.round(t.durationSec / 60)} minutes` : '…'}. Students see this same timer live.</p>
        <div className="row center-row">
          <button className="btn" disabled={t.status !== 'idle'} onClick={() => act('start')}>Start</button>
          <button className="btn secondary" disabled={t.status !== 'running'} onClick={() => act('pause')}>Pause</button>
          <button className="btn secondary" disabled={t.status !== 'paused'} onClick={() => act('resume')}>Resume</button>
          <button className="btn danger" onClick={() => setShowResetConfirm(true)}>Reset</button>
        </div>
      </div>

      <ConfirmModal
        open={showResetConfirm}
        title="Reset competition timer"
        message="This will clear the current timer state and reset the countdown. Do you want to continue?"
        confirmText="Reset timer"
        cancelText="Cancel"
        onConfirm={() => {
          setShowResetConfirm(false);
          act('reset');
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      <form className="card" onSubmit={(e) => { e.preventDefault(); act('duration', { minutes }); setMinutes(''); }}>
        <h3>Set duration</h3>
        <p className="muted">Setting a new duration also resets the timer.</p>
        <div className="row">
          <label className="inline">Minutes
            <input type="number" min="1" max="1440" value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
          </label>
          <button className="btn">Set duration</button>
        </div>
      </form>
    </>
  );
}
