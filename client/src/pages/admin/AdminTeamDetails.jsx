import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Alert, ConfirmModal } from '../../components.jsx';

const SOCIAL_LINKS = [
  { key: 'githubUrl', label: 'GitHub', src: 'https://cdn.simpleicons.org/github/ffffff', alt: 'GitHub' },
  { key: 'linkedinUrl', label: 'LinkedIn', src: 'https://cdn.simpleicons.org/linkedin/ffffff', alt: 'LinkedIn' },
  { key: 'leetcodeUrl', label: 'LeetCode', src: 'https://cdn.simpleicons.org/leetcode/ffffff', alt: 'LeetCode' },
  { key: 'kaggleUrl', label: 'Kaggle', src: 'https://cdn.simpleicons.org/kaggle/ffffff', alt: 'Kaggle' },
];

export default function AdminTeamDetails() {
  const [teams, setTeams] = useState([]);
  const [query, setQuery] = useState('');
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [confirmTeam, setConfirmTeam] = useState(null);
  const [err, setErr] = useState('');

  const load = () => api('/admin/teams').then(setTeams).catch((error) => setErr(error.message));
  useEffect(() => { load(); }, []);

  const visibleTeams = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return teams;
    return teams.filter((team) => [team.name, team.teamId, ...(team.members || [])]
      .some((value) => String(value || '').toLowerCase().includes(search)));
  }, [query, teams]);

  const confirmRemove = async () => {
    const team = confirmTeam;
    if (!team) return;
    setConfirmTeam(null);
    try {
      await api(`/admin/teams/${team._id}`, { method: 'DELETE' });
      setTeams((current) => current.filter((item) => item._id !== team._id));
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <>
      <div className="row between wrap">
        <div>
          <h2>All Teams</h2>
          <p className="muted">{visibleTeams.length} of {teams.length} teams</p>
        </div>
        <label>Search teams
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Team name, ID, or member"
          />
        </label>
      </div>
      <Alert>{err}</Alert>
      {visibleTeams.length === 0 ? (
        <div className="card muted">{teams.length ? 'No teams match your search.' : 'No teams yet. Create a team from the Teams page.'}</div>
      ) : (
        <div className="card">
          {visibleTeams.map((team) => {
            const isOpen = expandedTeam === team._id;
            return (
              <div key={team._id} style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', marginBottom: '0.9rem', overflow: 'hidden' }}>
                <button
                  type="button"
                  className="team-details-toggle"
                  onClick={() => setExpandedTeam(isOpen ? null : team._id)}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.04)', border: 'none', padding: '1rem 1.1rem',
                    textAlign: 'left', font: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <div><strong className="team-details-name">{team.name}</strong><br /><span className="muted">{team.teamId || 'No ID'}</span></div>
                  <span className="muted">{isOpen ? 'Hide' : 'Show'}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: '1rem 1.1rem 1.2rem' }}>
                    <div className="row between wrap" style={{ marginBottom: '1rem' }}>
                      <div><strong>Members:</strong> {(team.members || []).join(', ') || 'No members'}</div>
                      <div className="num"><strong>Verified XP:</strong> {team.xp}</div>
                    </div>
                    {(team.membersDetail || []).length > 0 && (
                      <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                        {team.membersDetail.map((member) => (
                          <div key={member._id} style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '0.75rem 0.9rem' }}>
                            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{member.name} <span className="muted">({member.role})</span></div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                              {SOCIAL_LINKS.map((social) => {
                                const href = member[social.key];
                                if (!href) return null;
                                return <a key={social.key} href={href} target="_blank" rel="noreferrer" className="social-link-badge" title={social.label} aria-label={social.label}><img src={social.src} alt={social.alt} /></a>;
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="row wrap" style={{ gap: '0.5rem' }}>
                      <Link className="btn small secondary" to={`/admin/teams/${team._id}`}>Progress</Link>
                      <Link className="btn small secondary" to="/admin/teams" state={{ editTeam: team }}>Edit</Link>
                      <button className="btn small danger" onClick={() => setConfirmTeam(team)}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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