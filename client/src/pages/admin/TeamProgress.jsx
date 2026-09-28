import { Link, useParams } from 'react-router-dom';
import { usePoll } from '../../hooks.js';
import { Alert, Badge } from '../../components.jsx';

export default function TeamProgress() {
  const { id } = useParams();
  const { data, error } = usePoll(`/admin/teams/${id}/progress`, 8000);

  if (error && !data) return <><Link to="/admin/teams">← Teams</Link><Alert>{error}</Alert></>;
  if (!data) return <p className="muted">Loading…</p>;
  const { team, rounds } = data;

  return (
    <>
      <Link to="/admin/teams">← Back to teams</Link>

      <section className="hero team-dashboard-hero">
        <div>
          <p className="hero-label">Team dashboard</p>
          <h2>{team.name}</h2>
          <div className="chips">
            <span className="chip">Team ID: {team.teamId || '—'}</span>
            <span className="chip">Rank #{team.rank || '—'}</span>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-box">
            <span className="hero-label">Total Team XP</span>
            <span className="hero-xp">{team.xp}</span>
          </div>
          <div className="hero-box">
            <span className="hero-label">Members</span>
            <span className="hero-xp">{team.members.length}</span>
          </div>
        </div>
      </section>

      <div className="card">
        <div className="row between wrap">
          <div><strong>Team members:</strong> {team.members.length ? team.members.map((m) => m.fullName).join(', ') : 'No members'}</div>
          <Link className="btn small" to={`/admin/verification?team=${team._id}`}>Verify this team's tasks</Link>
        </div>
      </div>

      <div className="card">
        <h3>Team members</h3>
        <div className="member-list">
          {team.members.length === 0 ? <p className="muted">No active members.</p> : team.members.map((member) => (
            <div key={member._id} className="member-card">
              <div className="member-card-header">
                <div>
                  <strong>{member.fullName}</strong>
                  <div className="muted">{member.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {rounds.length === 0 && <div className="card muted">No rounds created yet.</div>}
      {rounds.map((rd) => (
        <div className="card" key={rd._id}>
          <h3>{rd.name}</h3>
          {rd.tasks.length === 0 ? <p className="muted">No tasks.</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Task</th><th>Status</th><th>Completed at</th><th className="num">XP</th></tr></thead>
                <tbody>
                  {rd.tasks.map((t) => (
                    <tr key={t._id}>
                      <td>{t.title}</td>
                      <td>{t.verified ? <Badge tone="green">Verified</Badge> : t.completed ? <Badge tone="amber">Awaiting verification</Badge> : <Badge>Not completed</Badge>}</td>
                      <td>{t.completedAt ? new Date(t.completedAt).toLocaleString() : '–'}</td>
                      <td className="num">{t.points ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
