import { Link, useParams } from 'react-router-dom';
import { usePoll } from '../../hooks.js';
import { Alert } from '../../components.jsx';

export default function StudentRound() {
  const { id } = useParams();
  const info = usePoll(`/student/rounds/${id}`, 10000);
  const me = usePoll('/student/me', 5000);
  const access = me.data?.access;

  if (info.error && !info.data) return <><Link to="/">← Back</Link><Alert>{info.error}</Alert></>;
  if (!info.data) return <p className="muted">Loading…</p>;
  const { round, taskCount, resourceCount, completedCount } = info.data;

  return (
    <>
      <Link to="/rounds" className="back">← Back to rounds</Link>
      <h2>{round.name}</h2>

      <div className="card">
        <h3>Description</h3>
        <p className="pre">{round.description || 'No description provided.'}</p>
        <h3>Instructions</h3>
        <p className="pre">{round.instructions || 'No instructions provided.'}</p>
      </div>

      <div className="grid two">
        <div className="card section-card tests-card">
          <h3>Tests</h3>
          <p className="muted">{taskCount} task{taskCount === 1 ? '' : 's'} · {completedCount} marked completed</p>
          {!access || access.tests.allowed
            ? <Link className="btn tests" to={`/rounds/${id}/tests`}>Open tests</Link>
            : <><span className="btn locked">🔒 Tests closed</span><small className="muted">{access.tests.reason}</small></>}
        </div>
        <div className="card section-card res-card">
          <h3>Resources</h3>
          <p className="muted">{resourceCount} item{resourceCount === 1 ? '' : 's'} · PDFs, documents and links</p>
          {!access || access.resources.allowed
            ? <Link className="btn res" to={`/rounds/${id}/resources`}>Open resources</Link>
            : <><span className="btn locked">🔒 Resources closed</span><small className="muted">{access.resources.reason}</small></>}
        </div>
      </div>
    </>
  );
}
