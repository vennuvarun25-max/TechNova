import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { Alert } from '../../components.jsx';
import { IDENTITY_ROLES } from '../../roles.js';

const createMemberSlot = (name = '') => ({ name });
const emptyForm = { name: '', teamId: '', password: '', members: [createMemberSlot(), createMemberSlot(), createMemberSlot()] };
const SOCIAL_LINKS = [
  { key: 'githubUrl', label: 'GitHub', src: 'https://cdn.simpleicons.org/github/ffffff', alt: 'GitHub' },
  { key: 'linkedinUrl', label: 'LinkedIn', src: 'https://cdn.simpleicons.org/linkedin/ffffff', alt: 'LinkedIn' },
  { key: 'leetcodeUrl', label: 'LeetCode', src: 'https://cdn.simpleicons.org/leetcode/ffffff', alt: 'LeetCode' },
  { key: 'kaggleUrl', label: 'Kaggle', src: 'https://cdn.simpleicons.org/kaggle/ffffff', alt: 'Kaggle' },
];

export default function AdminTeams() {
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const team = location.state?.editTeam;
    if (!team) return;
    const prepared = Array.from({ length: 3 }, () => createMemberSlot());
    (team.membersDetail || []).forEach((member, index) => {
      const slot = IDENTITY_ROLES.indexOf(member.role);
      prepared[slot >= 0 ? slot : index] = createMemberSlot(member.name);
    });
    if (!team.membersDetail?.length) {
      (team.members || []).forEach((name, index) => { prepared[index] = createMemberSlot(name); });
    }
    setEditId(team._id);
    setForm({ name: team.name, teamId: team.teamId || '', password: '', members: prepared });
    setErr(''); setOk('');
    navigate(location.pathname, { replace: true, state: null });
    window.scrollTo({ top: 0 });
  }, [location.pathname, location.state, navigate]);

  const reset = () => { setForm(emptyForm); setEditId(null); };

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    try {
      const members = form.members.map((member, idx) => ({
        name: String(member?.name || '').trim(),
        role: IDENTITY_ROLES[idx],
      })).filter((entry) => entry.name);
      if (!members.some((member) => member.role === IDENTITY_ROLES[0])) throw new Error('VISION LEAD is required');
      const body = { name: form.name, teamId: form.teamId, members };
      if (form.password) body.password = form.password;
      if (editId) await api(`/admin/teams/${editId}`, { method: 'PUT', body });
      else await api('/admin/teams', { method: 'POST', body });
      setOk(editId ? 'Team updated.' : 'Team created.');
      reset();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const setMember = (i, value) => setForm({
    ...form,
    members: form.members.map((m, j) => (j === i ? { ...m, name: value } : m)),
  });

  return (
    <>
      <h2>Teams</h2>
      <Alert>{err}</Alert>
      <Alert type="success">{ok}</Alert>

      <form className="card" onSubmit={submit}>
        <h3>{editId ? 'Edit team' : 'Create team'}</h3>
        <div className="grid two">
          <label>Team name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>Team ID
            <input value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}
              placeholder="TNV-001" autoComplete="off" />
          </label>
        </div>
        <div className="grid two">
          <label>VISION LEAD
            <input value={form.members[0]?.name || ''} onChange={(e) => setMember(0, e.target.value)} placeholder="Name" required />
          </label>
          <label>{editId ? 'New password' : 'Team password'}
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editId ? 'Leave blank to keep current password' : 'Shared team login password'}
              required={!editId} minLength={form.password ? 4 : undefined} autoComplete="off" />
          </label>
        </div>
        <div className="grid three">
          {form.members.slice(1).map((m, i) => (
            <label key={i + 1}>{IDENTITY_ROLES[i + 1]}
              <input value={m?.name || ''} onChange={(e) => setMember(i + 1, e.target.value)} placeholder="Optional" />
            </label>
          ))}
        </div>
        <div className="row">
          <button className="btn">{editId ? 'Save changes' : 'Create team'}</button>
          {editId && <button type="button" className="btn secondary" onClick={reset}>Cancel</button>}
        </div>
      </form>
    </>
  );
}
