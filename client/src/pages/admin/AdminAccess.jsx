import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useTimer } from '../../hooks.js';
import { Alert, Badge } from '../../components.jsx';

export default function AdminAccess() {
  const [teams, setTeams] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const timer = useTimer();

  const load = useCallback(() => api('/admin/teams').then(setTeams).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const all = !!teams && teams.length > 0 && sel.size === teams.length;
  const toggleAll = () => setSel(all ? new Set() : new Set(teams.map((t) => t._id)));
  const toggleOne = (id) => {
    const next = new Set(sel);
    next.has(id) ? next.delete(id) : next.add(id);
    setSel(next);
  };

  const apply = async (payload, label) => {
    setErr(''); setOk('');
    if (sel.size === 0) return setErr('Select at least one team first, or tick "Select all teams".');
    try {
      await api('/admin/access', { method: 'PUT', body: { teamIds: all ? 'all' : [...sel], ...payload } });
      setOk(`${label} for ${all ? 'all teams' : `${sel.size} team${sel.size === 1 ? '' : 's'}`}.`);
      load();
    } catch (e) { setErr(e.message); }
  };

  const setAutoLock = async (enabled) => {
    setErr(''); setOk('');
    try { await api('/admin/timer/autolock', { method: 'POST', body: { enabled } }); timer.reload(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <>
      <h2>Access control</h2>
      <p className="muted">Choose which teams can open the <strong>Tests</strong> and <strong>Resources</strong> sections. Each section is controlled separately.</p>
      <Alert>{err}</Alert>
      <Alert type="success">{ok}</Alert>

      <div className="card">
        <h3>Automatic lock</h3>
        <label className="check">
          <input type="checkbox" checked={timer.lockTestsOnTimeUp ?? true} onChange={(e) => setAutoLock(e.target.checked)} />
          Close Tests for every team when the competition timer ends
        </label>
        <small className="muted">Resources are never changed automatically. Open or close them yourself below.</small>
      </div>

      <div className="card">
        <div className="row between wrap">
          <label className="check no-margin">
            <input type="checkbox" checked={all} onChange={toggleAll} disabled={!teams?.length} />
            Select all teams
          </label>
          <span className="muted">{sel.size} selected</span>
        </div>

        <div className="action-bar">
          <div className="action-group tests-group">
            <strong>Tests</strong>
            <button className="btn small tests" onClick={() => apply({ tests: true }, 'Tests opened')}>Open</button>
            <button className="btn small danger" onClick={() => apply({ tests: false }, 'Tests closed')}>Close</button>
          </div>
          <div className="action-group res-group">
            <strong>Resources</strong>
            <button className="btn small res" onClick={() => apply({ resources: true }, 'Resources opened')}>Open</button>
            <button className="btn small danger" onClick={() => apply({ resources: false }, 'Resources closed')}>Close</button>
          </div>
        </div>

        {!teams ? <p className="muted">Loading…</p> : teams.length === 0 ? <p className="muted">No teams yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th style={{ width: 44 }} /><th>Team</th><th>Tests</th><th>Resources</th></tr></thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t._id} className={sel.has(t._id) ? 'selected' : ''}>
                    <td><input type="checkbox" checked={sel.has(t._id)} onChange={() => toggleOne(t._id)} aria-label={`Select ${t.name}`} /></td>
                    <td><strong>{t.name}</strong></td>
                    <td>{t.testsEnabled === false ? <Badge tone="red">Closed</Badge> : <Badge tone="green">Open</Badge>}</td>
                    <td>{t.resourcesEnabled === false ? <Badge tone="red">Closed</Badge> : <Badge tone="green">Open</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
