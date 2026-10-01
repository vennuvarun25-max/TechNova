import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Alert, Badge } from '../../components.jsx';

function Row({ c, onDone, onError }) {
  const [pts, setPts] = useState(c.points ?? '');
  const [busy, setBusy] = useState(false);

  const act = async (path, method, body) => {
    setBusy(true); onError('');
    try { await api(`/admin/completions/${c._id}/${path}`, { method, body }); await onDone(); }
    catch (e) { onError(e.message); }
    finally { setBusy(false); }
  };

  const profileAct = async (action) => {
    setBusy(true); onError('');
    try {
      await api(`/admin/completions/profile/${c.teamId}/${action}`, { method: 'POST' });
      await onDone();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (c.type === 'profile-link') {
    return (
      <tr>
        <td>{c.task}</td>
        <td>{new Date(c.completedAt).toLocaleString()}</td>
        <td>{c.verified ? <Badge tone="green">XP awarded</Badge> : <Badge tone="amber">Ready</Badge>}</td>
        <td className="actions">
          <span className="muted">{c.points ?? 10} XP</span>
          {c.verified ? (
            <button className="btn small secondary" disabled={busy} onClick={() => profileAct('unverify')}>Unverify</button>
          ) : (
            <button className="btn small" disabled={busy} onClick={() => profileAct('verify')}>Award XP</button>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{c.task}</td>
      <td>{new Date(c.completedAt).toLocaleString()}</td>
      <td>{c.verified ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Pending</Badge>}</td>
      <td className="actions">
        <input className="xp" type="number" min="0" value={pts} onChange={(e) => setPts(e.target.value)} placeholder="XP" aria-label="XP" />
        {c.verified ? (
          <>
            <button className="btn small" disabled={busy} onClick={() => act('xp', 'PUT', { points: pts })}>Update XP</button>
            <button className="btn small secondary" title="Remove verification and allow the team to submit this task again" disabled={busy} onClick={() => act('unverify', 'POST')}>Unverify & allow retry</button>
          </>
        ) : (
          <button className="btn small" disabled={busy} onClick={() => act('verify', 'POST', { points: pts })}>Verify & award</button>
        )}
      </td>
    </tr>
  );
}

export default function AdminVerification() {
  const [params, setParams] = useSearchParams();
  const team = params.get('team') || '';
  const [status, setStatus] = useState('pending');
  const [teams, setTeams] = useState([]);
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [expandedTeams, setExpandedTeams] = useState({});

  useEffect(() => { api('/admin/teams').then(setTeams).catch(() => {}); }, []);

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (status !== 'all') q.set('status', status);
    if (team) q.set('team', team);
    return api(`/admin/completions?${q}`).then(setList).catch((e) => setErr(e.message));
  }, [status, team]);
  useEffect(() => { load(); }, [load]);

  const grouped = (list || []).reduce((acc, item) => {
    const key = item.teamId || item.team;
    if (!acc[key]) {
      acc[key] = { team: item.team, teamId: item.teamId, rounds: {} };
    }
    const roundKey = item.round || 'General';
    if (!acc[key].rounds[roundKey]) {
      acc[key].rounds[roundKey] = [];
    }
    acc[key].rounds[roundKey].push(item);
    return acc;
  }, {});

  const groupedTeams = Object.values(grouped).sort((a, b) => a.team.localeCompare(b.team));

  const toggleTeam = (teamId) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [teamId]: !prev[teamId],
    }));
  };

  return (
    <>
      <h2>XP & verification</h2>
      <p className="muted">Review tasks by team and round before awarding XP.</p>
      <Alert>{err}</Alert>

      <div className="card row wrap verification-toolbar">
        <label className="inline">Team
          <select value={team} onChange={(e) => { e.target.value ? setParams({ team: e.target.value }) : setParams({}); }}>
            <option value="">All teams</option>
            {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </label>
        <div className="tabs compact">
          {[['pending', 'Pending'], ['verified', 'Verified'], ['all', 'All']].map(([v, l]) => (
            <button key={v} className={status === v ? 'active' : ''} onClick={() => setStatus(v)}>{l}</button>
          ))}
        </div>
        <button className="btn small secondary" onClick={load}>Refresh</button>
      </div>

      {!list ? <div className="card"><p className="muted">Loading…</p></div> : list.length === 0 ? (
        <div className="card"><p className="muted">{status === 'pending' ? 'Nothing waiting for verification.' : 'No tasks found.'}</p></div>
      ) : (
        groupedTeams.map((teamGroup) => {
          const teamKey = teamGroup.teamId || teamGroup.team;
          const isOpen = !!expandedTeams[teamKey];

          return (
            <div className="card" key={teamKey} style={{ marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => toggleTeam(teamKey)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  font: 'inherit',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <h3 style={{ margin: 0 }}>{teamGroup.team}</h3>
                <span className="muted">{isOpen ? 'Hide' : 'Show'}</span>
              </button>

              {isOpen && (
                <div style={{ marginTop: '1rem' }}>
                  {Object.entries(teamGroup.rounds).map(([roundName, items]) => (
                    <div key={`${teamKey}-${roundName}`} style={{ marginTop: '1rem' }}>
                      <h4 style={{ marginBottom: '0.75rem' }}>{roundName}</h4>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Task</th><th>Completed</th><th>Status</th><th>XP</th></tr></thead>
                          <tbody>{items.map((c) => <Row key={c._id + c.verified} c={c} onDone={load} onError={setErr} />)}</tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </>
  );
}
