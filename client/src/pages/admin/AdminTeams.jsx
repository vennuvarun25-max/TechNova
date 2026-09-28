import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Alert, ConfirmModal } from '../../components.jsx';
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
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [confirmTeam, setConfirmTeam] = useState(null);

  const load = () => api('/admin/teams').then(setTeams).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const reset = () => { setForm(emptyForm); setEditId(null); };

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    try {
      const members = form.members.map((member, idx) => ({
        name: String(member?.name || '').trim(),
        role: IDENTITY_ROLES[idx],
      })).filter((entry) => entry.name);
      if (members.length !== 3) throw new Error('VISION LEAD, CODE ARCHITECT, and INNOVATION STRATEGIST are required');
      const body = { name: form.name, teamId: form.teamId, members };
      if (form.password) body.password = form.password;
      if (editId) await api(`/admin/teams/${editId}`, { method: 'PUT', body });
      else await api('/admin/teams', { method: 'POST', body });
      setOk(editId ? 'Team updated.' : 'Team created.');
      reset();
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const edit = (t) => {
    setEditId(t._id);
    const members = Array.isArray(t.members) ? t.members : [];
    const prepared = Array.from({ length: 3 }, (_, idx) => {
      const current = members[idx] || {};
      return createMemberSlot(current.name || '');
    });
    setForm({ name: t.name, teamId: t.teamId || '', password: '', members: prepared });
    setErr(''); setOk('');
    window.scrollTo({ top: 0 });
  };

  const remove = (t) => setConfirmTeam(t);

  const confirmRemove = async () => {
    const t = confirmTeam;
    if (!t) return;
    setConfirmTeam(null);
    try { await api(`/admin/teams/${t._id}`, { method: 'DELETE' }); if (editId === t._id) reset(); load(); }
    catch (e) { setErr(e.message); }
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
              <input value={m?.name || ''} onChange={(e) => setMember(i + 1, e.target.value)} placeholder="Name" required />
            </label>
          ))}
        </div>
        <div className="row">
          <button className="btn">{editId ? 'Save changes' : 'Create team'}</button>
          {editId && <button type="button" className="btn secondary" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <div className="card">
        {teams.length === 0 ? <p className="muted">No teams yet. Create the first one above.</p> : (
          <div>
            {teams.map((t) => {
              const isOpen = expandedTeam === t._id;
              return (
                <div key={t._id} style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', marginBottom: '0.9rem', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedTeam(isOpen ? null : t._id)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.04)',
                      border: 'none',
                      padding: '1rem 1.1rem',
                      textAlign: 'left',
                      font: 'inherit',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <strong>{t.name}</strong><br />
                      <span className="muted">{t.teamId || 'No ID'}</span>
                    </div>
                    <span className="muted">{isOpen ? 'Hide' : 'Show'}</span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '1rem 1.1rem 1.2rem' }}>
                      <div className="row between wrap" style={{ marginBottom: '1rem' }}>
                        <div><strong>Members:</strong> {t.members.join(', ') || 'No members'}</div>
                        <div className="num"><strong>Verified XP:</strong> {t.xp}</div>
                      </div>
                      {(t.membersDetail || []).length > 0 && (
                        <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                          {t.membersDetail.map((member) => (
                            <div key={member._id} style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '0.75rem 0.9rem' }}>
                              <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{member.name} <span className="muted">({member.role})</span></div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                                {SOCIAL_LINKS.map((social) => {
                                  const href = member[social.key];
                                  if (!href) return null;
                                  return (
                                    <a key={social.key} href={href} target="_blank" rel="noreferrer" className="social-link-badge" title={social.label} aria-label={social.label}>
                                      <img src={social.src} alt={social.alt} />
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="row wrap" style={{ gap: '0.5rem' }}>
                        <Link className="btn small secondary" to={`/admin/teams/${t._id}`}>Progress</Link>
                        <button className="btn small secondary" onClick={() => edit(t)}>Edit</button>
                        <button className="btn small danger" onClick={() => remove(t)}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmTeam}
        title="Delete team?"
        message={confirmTeam ? `Delete team "${confirmTeam.name}" and all of its progress and XP?` : ''}
        confirmText="Delete"
        tone="danger"
        onConfirm={confirmRemove}
        onCancel={() => setConfirmTeam(null)}
      />
    </>
  );
}
