import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Alert, ConfirmModal } from '../../components.jsx';

const ROUND_DAYS = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'];
const emptyForm = { name: '', day: 'Day 1', order: 0, description: '', instructions: '' };

export default function AdminRounds() {
  const [rounds, setRounds] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');
  const [confirmRound, setConfirmRound] = useState(null);
  const [ok, setOk] = useState('');

  const load = () => api('/admin/rounds').then(setRounds).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const reset = () => { setForm(emptyForm); setEditId(null); };

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    try {
      if (editId) await api(`/admin/rounds/${editId}`, { method: 'PUT', body: form });
      else await api('/admin/rounds', { method: 'POST', body: { ...form, order: form.order || rounds.length + 1 } });
      setOk(editId ? 'Round updated.' : 'Round created. Open it to add tasks and resources.');
      reset();
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const edit = (r) => {
    setEditId(r._id);
    setForm({ name: r.name, day: r.day || 'Day 1', order: r.order, description: r.description, instructions: r.instructions });
    setErr(''); setOk('');
    window.scrollTo({ top: 0 });
  };

  const remove = (r) => setConfirmRound(r);

  const confirmRemove = async () => {
    const r = confirmRound;
    if (!r) return;
    setConfirmRound(null);
    try { await api(`/admin/rounds/${r._id}`, { method: 'DELETE' }); if (editId === r._id) reset(); load(); }
    catch (e) { setErr(e.message); }
  };

  const setDayLock = async (day, locked) => {
    setErr(''); setOk('');
    try {
      await api(`/admin/round-days/${encodeURIComponent(day)}/access`, { method: 'PUT', body: { locked } });
      setOk(`${day} rounds ${locked ? 'locked' : 'unlocked'}.`);
      load();
    } catch (e) { setErr(e.message); }
  };

  const setDayComplete = async (day, complete) => {
    setErr(''); setOk('');
    try {
      await api(`/admin/round-days/${encodeURIComponent(day)}/complete`, { method: 'PUT', body: { complete } });
      setOk(`${day} marked ${complete ? 'complete' : 'in progress'}. Its round resources are ${complete ? 'now available' : 'hidden'} in Central Resources.`);
      load();
    } catch (e) { setErr(e.message); }
  };

  const setRoundLock = async (round, locked) => {
    setErr(''); setOk('');
    try {
      await api(`/admin/rounds/${round._id}/access`, { method: 'PUT', body: { locked } });
      setOk(`${round.name} ${locked ? 'locked' : 'unlocked'}.`);
      load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <h2>Rounds</h2>
      <Alert>{err}</Alert>
      <Alert type="success">{ok}</Alert>

      <form className="card" onSubmit={submit}>
        <h3>{editId ? 'Edit round' : 'Create round'}</h3>
        <div className="grid two">
          <label>Day
            <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
              {ROUND_DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
          </label>
          <label>Display order
            <input type="number" min="0" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
          </label>
        </div>
        <label>Round name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Round 1 — Learn & Build" required />
        </label>
        <label>Description
          <textarea rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label>Instructions
          <textarea rows="3" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
        </label>
        <div className="row">
          <button className="btn">{editId ? 'Save changes' : 'Create round'}</button>
          {editId && <button type="button" className="btn secondary" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <div className="card">
        {rounds.length === 0 ? <p className="muted">No rounds yet.</p> : (
          <div>
            {ROUND_DAYS.map((day) => {
              const items = rounds.filter((r) => (r.day || 'Day 1') === day);
              if (items.length === 0) return null;
              return (
                <div key={day} style={{ marginBottom: '1.5rem' }}>
                  <div className="row between wrap" style={{ marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0 }}>{day}</h3>
                    <span className="row wrap">
                      <button className="btn small secondary" disabled={items.every((round) => round.isDayComplete && round.isLocked)} onClick={() => setDayLock(day, !items.every((round) => round.isLocked))}>
                        {items.every((round) => round.isLocked) ? 'Unlock day' : 'Lock day'}
                      </button>
                      <button className="btn small secondary" onClick={() => setDayComplete(day, !items.every((round) => round.isDayComplete))}>
                        {items.every((round) => round.isDayComplete) ? 'Reopen day' : 'Mark day complete'}
                      </button>
                    </span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Round</th><th>Access</th><th>Day status</th><th className="num">Tasks</th><th className="num">Resources</th><th /></tr></thead>
                      <tbody>
                        {items.map((r) => (
                          <tr key={r._id}>
                            <td><strong>{r.name}</strong><div className="muted clamp">{r.description}</div></td>
                            <td>{r.isDayComplete ? 'Tests closed (day complete)' : r.isLocked ? 'Locked' : 'Open'}</td>
                            <td>{r.isDayComplete ? 'Day complete' : 'In progress'}</td>
                            <td className="num">{r.taskCount}</td>
                            <td className="num">{r.resourceCount}</td>
                            <td className="actions">
                              <button className="btn small secondary" disabled={r.isDayComplete && r.isLocked} onClick={() => setRoundLock(r, !r.isLocked)}>{r.isLocked ? 'Unlock' : 'Lock'}</button>
                              <Link className="btn small" to={`/admin/rounds/${r._id}`}>Tasks & resources</Link>
                              <button className="btn small secondary" onClick={() => edit(r)}>Edit</button>
                              <button className="btn small danger" onClick={() => remove(r)}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmRound}
        title="Delete round?"
        message={confirmRound ? `Delete "${confirmRound.name}" with all its tasks, resources, completions and XP?` : ''}
        confirmText="Delete"
        tone="danger"
        onConfirm={confirmRemove}
        onCancel={() => setConfirmRound(null)}
      />
    </>
  );
}
