import { useEffect, useState } from 'react';
import { Alert } from '../../components.jsx';
import { api } from '../../api.js';

export default function AdminXPManagement() {
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [action, setAction] = useState('add');
  const [amount, setAmount] = useState('50');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/admin/xp/teams')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setTeams(list);
        if (list[0]) setTeamId(list[0]._id);
      })
      .catch(() => setErr('Unable to load teams'));
  }, []);

  useEffect(() => {
    if (!teamId) {
      setMembers([]);
      setMemberId('');
      return;
    }
    api(`/admin/xp/team/${teamId}/members`)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setMembers(list);
        if (list[0]) setMemberId(list[0]._id);
      })
      .catch(() => setMembers([]));
  }, [teamId]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setOk('');
    setBusy(true);
    try {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Enter a valid XP value greater than 0');
      }
      if (!teamId || !memberId) {
        throw new Error('Select both a team and a member');
      }
      await api('/admin/xp/adjust', {
        method: 'POST',
        body: {
          teamId,
          memberId,
          action,
          amount: value,
          reason: reason.trim() || 'Manual XP update',
        },
      });
      const updatedMembers = await api(`/admin/xp/team/${teamId}/members`);
      setMembers(Array.isArray(updatedMembers) ? updatedMembers : []);
      setOk(action === 'add' ? 'XP added to the member.' : 'XP deducted from the member.');
      setReason('');
      setAmount('50');
    } catch (e) {
      setErr(e.message || 'Unable to update XP');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>XP Management</h2>
      <p className="muted">Adjust a member's XP without overwriting the existing value.</p>
      <Alert>{err}</Alert>
      <Alert tone="success">{ok}</Alert>

      <form className="card" onSubmit={submit}>
        <div className="grid two">
          <label>
            Team
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
            </select>
          </label>
          <label>
            Member
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              {members.map((member) => <option key={member._id} value={member._id}>{member.fullName} ({member.individualXp || 0} XP)</option>)}
            </select>
          </label>
        </div>

        <div className="grid two">
          <label>
            Action
            <div className="tabs compact">
              <button type="button" className={action === 'add' ? 'active' : ''} onClick={() => setAction('add')}>Add XP</button>
              <button type="button" className={action === 'deduct' ? 'active' : ''} onClick={() => setAction('deduct')}>Deduct XP</button>
            </div>
          </label>
        </div>

        <label>
          XP points
          <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>

        <label>
          Reason
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows="3" placeholder="Bonus for exceptional solution" required />
        </label>

        <button className="btn" disabled={busy || !teamId || !memberId}>{busy ? 'Updating…' : 'Confirm XP Update'}</button>
      </form>
    </>
  );
}
