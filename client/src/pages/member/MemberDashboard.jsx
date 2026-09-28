import { Link } from 'react-router-dom';
import { usePoll } from '../../hooks.js';
import { Alert, Badge, Leaderboard, Timer } from '../../components.jsx';

const TONE = { 'Not started': 'gray', 'In progress': 'amber', Completed: 'green' };

export default function MemberDashboard() {
  const me = usePoll('/member/me', 5000);
  const rounds = usePoll('/member/rounds', 10000);
  const access = me.data?.access;

  return (
    <>
      <section className="hero">
        <div>
          <p className="hero-label">Your profile</p>
          <h2>{me.data ? me.data.fullName : '…'}</h2>
          <div className="chips">
            <span className="chip">{me.data?.role}</span>
            <span className="chip">{me.data?.teamName}</span>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-box">
            <span className="hero-label">Individual XP</span>
            <span className="hero-xp">{me.data ? me.data.individualXp : '–'}</span>
          </div>
          <div className="hero-box">
            <span className="hero-label">Team XP</span>
            <span className="hero-xp">{me.data ? me.data.teamXp : '–'}</span>
          </div>
          <div className="hero-box">
            <span className="hero-label">Time left</span>
            <Timer />
          </div>
        </div>
      </section>
      <Alert>{me.error}</Alert>

      <h3 className="section-title">Rounds</h3>
      <Alert>{rounds.error}</Alert>
      {rounds.data && rounds.data.length === 0 && <div className="card muted">No rounds yet. Check back soon.</div>}
      <div className="grid three">
        {rounds.data?.map((r) => {
          const pct = r.taskCount ? Math.round((r.completedCount / r.taskCount) * 100) : 0;
          return (
            <article key={r._id} className="card round-card">
              <div className="row between wrap">
                <h3>{r.name}</h3>
                <Badge tone={TONE[r.status]}>{r.status}</Badge>
              </div>
              <p className="clamp muted">{r.description || 'No description.'}</p>
              <div className="progress" aria-label={`${pct}% of tasks marked completed`}><span style={{ width: `${pct}%` }} /></div>
              <small className="muted">{r.completedCount} of {r.taskCount} tasks marked completed</small>

              <div className="btn-pair">
                {!access || access.tests.allowed
                  ? <Link className="btn tests" to={`/member/rounds/${r._id}/tests`}>Tests</Link>
                  : <span className="btn locked" title={access.tests.reason}>🔒 Tests closed</span>}
                {!access || access.resources.allowed
                  ? <Link className="btn res" to={`/member/rounds/${r._id}/resources`}>Resources</Link>
                  : <span className="btn locked" title={access.resources.reason}>🔒 Resources closed</span>}
              </div>
            </article>
          );
        })}
      </div>

      <h3 className="section-title">Leaderboard</h3>
      <div className="card"><Leaderboard me={me.data?.teamName} limit={10} /></div>
    </>
  );
}
