import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { usePoll } from '../../hooks.js';
import { Alert, Badge, ConfirmModal, LockedPanel, Timer } from '../../components.jsx';

export default function StudentTests() {
  const { id } = useParams();
  const { data, error, reload } = usePoll(`/student/rounds/${id}/tests`, 5000);
  const [err, setErr] = useState('');
  const [confirmTask, setConfirmTask] = useState(null);

  const toggle = async (task) => {
    setErr('');
    try {
      await api(`/student/tasks/${task._id}/complete`, { method: 'POST', body: { completed: true } });
      setConfirmTask(null);
      reload();
    } catch (e) {
      setErr(e.message);
      setConfirmTask(null);
      reload();
    }
  };

  if (!data && error) {
    return <LockedPanel title="Tests are closed" message={error} backTo={`/rounds/${id}`} backLabel="Back to round" />;
  }
  if (!data) return <p className="muted">Loading…</p>;
  const { round, tasks } = data;
  const completedCount = tasks.filter((t) => t.completed).length;
  const teamStatus = completedCount === tasks.length && tasks.length > 0 ? 'Stage completed' : completedCount > 0 ? 'In progress' : 'Not started';

  return (
    <>
      <ConfirmModal
        open={!!confirmTask}
        title="Confirm task completion"
        message={confirmTask ? `Are you sure you want to mark "${confirmTask.title}" as done? This will be submitted for admin verification and cannot be edited until admin review.` : ''}
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={() => toggle(confirmTask)}
        onCancel={() => setConfirmTask(null)}
      />

      <Link to={`/rounds/${id}`} className="back">← Back to round</Link>
      <div className="page-head">
        <div><p className="eyebrow tests-tag">Tests</p><h2>{round.name}</h2></div>
        <div className="head-timer"><Timer /></div>
      </div>
      <Alert>{err}</Alert>

      <div className="card">
        <div className="row between wrap">
          <div>
            <h3>Team submission status</h3>
            <div className="muted">This round is tracked as one team submission page for all members.</div>
          </div>
          <Badge tone={teamStatus === 'Stage completed' ? 'green' : teamStatus === 'In progress' ? 'amber' : 'gray'}>{teamStatus}</Badge>
        </div>
        <div className="member-meta" style={{ marginTop: 12 }}>
          <span>Completed tasks: {completedCount}/{tasks.length || 0}</span>
          <span>Team members can view the same page together</span>
        </div>
      </div>

      {tasks.length === 0 && <div className="card muted">No tasks in this round yet.</div>}
      {tasks.map((t, i) => (
        <div className={`card task ${t.verified ? 'is-verified' : t.completed ? 'is-done' : ''}`} key={t._id}>
          <div className="row between wrap">
            <h3><span className="task-no">{i + 1}</span>{t.title}</h3>
            {t.verified ? <Badge tone="green">Verified · {t.points} XP</Badge>
              : t.completed ? <Badge tone="amber">Awaiting verification</Badge>
              : <Badge>Not completed</Badge>}
          </div>
          {t.description && <p className="pre task-desc">{t.description}</p>}
          <div className="row between wrap task-foot">
            <button
              type="button"
              className="btn small"
              disabled={t.verified || t.completed}
              onClick={() => setConfirmTask(t)}
            >
              {t.verified ? 'Verified' : t.completed ? 'Done' : 'Done'}
            </button>
            {t.link && <a className="btn small secondary" href={t.link} target="_blank" rel="noopener noreferrer">Open problem link</a>}
          </div>
        </div>
      ))}
    </>
  );
}
