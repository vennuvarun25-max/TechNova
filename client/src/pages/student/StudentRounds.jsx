import { Link } from 'react-router-dom';
import { usePoll } from '../../hooks.js';
import { Alert, Badge } from '../../components.jsx';

const TONE = { 'Not started': 'gray', 'In progress': 'amber', Completed: 'green' };
const ROUND_DAYS = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'];

export default function StudentRounds() {
  const rounds = usePoll('/student/rounds', 10000);
  const me = usePoll('/student/me', 5000);
  const access = me.data?.access;

  return (
    <>
      <Link to="/" className="back">← Back to dashboard</Link>
      <h2>Rounds</h2>
      <Alert>{rounds.error}</Alert>
      {rounds.data && rounds.data.length === 0 && <div className="card muted">No rounds yet. Check back soon.</div>}
      {ROUND_DAYS.map((day) => {
        const dayRounds = rounds.data?.filter((round) => (round.day || 'Day 1') === day) || [];
        if (dayRounds.length === 0) return null;
        return <section key={day}>
          <h3>{day}</h3>
          <div className="grid three">
        {dayRounds.map((r) => {
          const pct = r.taskCount ? Math.round((r.completedCount / r.taskCount) * 100) : 0;
          return (
            <article key={r._id} className="card round-card">
              <div className="row between wrap">
                <h3>{r.name}</h3>
                <Badge tone={TONE[r.status]}>{r.status}</Badge>
              </div>
              {r.isDayComplete && <Badge tone="green">Day complete</Badge>}
              <p className="clamp muted">{r.description || 'No description.'}</p>
              <div className="progress" aria-label={`${pct}% of tasks marked completed`}><span style={{ width: `${pct}%` }} /></div>
              <small className="muted">{r.completedCount} of {r.taskCount} tasks marked completed</small>

              <div className="btn-pair">
                {r.isLocked || r.isDayComplete
                  ? <span className="btn locked">Tests closed</span>
                  : !access || access.tests.allowed
                  ? <Link className="btn tests" to={`/rounds/${r._id}/tests`}>Tests</Link>
                  : <span className="btn locked" title={access.tests.reason}>🔒 Tests closed</span>}
                {!r.isDayComplete && !r.isLocked && (!access || access.resources.allowed)
                  ? <Link className="btn res" to={`/rounds/${r._id}/resources`}>Resources</Link>
                  : !r.isDayComplete && <span className="btn locked" title={access?.resources.reason}>🔒 Resources closed</span>}
              </div>
              {r.isDayComplete
                ? <Link className="details-link" to="/central-resources">View released resources</Link>
                : !r.isLocked && <Link className="details-link" to={`/rounds/${r._id}`}>Round details</Link>}
            </article>
          );
        })}
          </div>
        </section>;
      })}
    </>
  );
}
