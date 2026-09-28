import { Link } from 'react-router-dom';
import { formatTime, usePoll, useTimer } from './hooks.js';

export function Badge({ tone = 'gray', children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Alert({ type = 'error', children }) {
  return children ? <div className={`alert ${type}`}>{children}</div> : null;
}

export function ConfirmModal({ open, title, message, confirmText = 'Confirm', cancelText = 'Cancel', tone = 'default', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {message && <p className="modal-message">{message}</p>}
        <div className="modal-actions">
          <button type="button" className="btn small secondary" onClick={onCancel}>{cancelText}</button>
          <button type="button" className={`btn small${tone === 'danger' ? ' danger' : ''}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// PROJECT SHOWCASE — shared pieces (reused by the team and admin views)
// =========================================================

// Reusable predefined technology list for the Project Showcase multi-select.
// Kept in one place so every picker across the app offers the same options.
export const TECH_STACK_OPTIONS = [
  'React', 'Vue.js', 'Angular', 'Next.js', 'Svelte', 'Node.js', 'Express',
  'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Java', 'Python', 'TypeScript',
  'JavaScript', 'MongoDB', 'PostgreSQL', 'MySQL', 'SQLite', 'Firebase', 'Redis',
  'GraphQL', 'REST API', 'AWS', 'Docker', 'Kubernetes', 'TensorFlow', 'PyTorch',
  'Pandas', 'NumPy', 'Tailwind CSS', 'Bootstrap', 'Flutter', 'React Native',
  'Swift', 'Kotlin', 'Go', 'Rust', 'C++', 'C#', 'PHP', 'Laravel', '.NET',
  'Unity', 'Solidity', 'Figma', 'OpenCV', 'Socket.io',
];

// Pick technologies from a predefined list; selections render as themed
// badges with a remove affordance, instead of a free-text field.
export function TechStackPicker({ value = [], onChange, options = TECH_STACK_OPTIONS }) {
  const selected = Array.isArray(value) ? value : [];
  const available = options.filter((opt) => !selected.includes(opt));

  const add = (tech) => {
    if (!tech || selected.includes(tech)) return;
    onChange([...selected, tech]);
  };
  const remove = (tech) => onChange(selected.filter((t) => t !== tech));

  return (
    <div className="tech-picker">
      <select value="" onChange={(e) => add(e.target.value)} aria-label="Add a technology">
        <option value="">+ Add a technology…</option>
        {available.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <div className="tech-tags tech-picker-selected">
        {selected.length === 0 && <span className="muted small">No technologies selected yet.</span>}
        {selected.map((t) => (
          <span key={t} className="tech-tag tech-tag-removable">
            {t}
            <button type="button" className="tech-tag-remove" aria-label={`Remove ${t}`} onClick={() => remove(t)}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProjectCard({ p, mine, onEdit, onDelete }) {
  return (
    <article className="card project-card">
      <div className="row between wrap">
        <h3>{p.title}</h3>
        <Badge tone={p.status === 'Completed' ? 'green' : 'amber'}>{p.status}</Badge>
      </div>
      <div className="muted project-team-line">by <strong>{p.teamName}</strong>{mine ? <span className="badge blue project-mine-tag">Your team</span> : null}</div>
      {p.description && <p className="muted">{p.description}</p>}

      {p.techStack?.length > 0 && (
        <div className="tech-tags">
          {p.techStack.map((t) => <span key={t} className="tech-tag">{t}</span>)}
        </div>
      )}

      {p.members?.length > 0 && (
        <div className="project-members">
          <span className="project-members-label">Team</span>
          <span className="muted">{p.members.join(', ')}</span>
        </div>
      )}

      <div className="project-links">
        {p.githubUrl && <a className="btn small secondary" href={p.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
        {p.demoUrl && <a className="btn small" href={p.demoUrl} target="_blank" rel="noreferrer">Live demo</a>}
        {!p.githubUrl && !p.demoUrl && <span className="muted small">No links added yet</span>}
      </div>

      {mine && (onEdit || onDelete) && (
        <div className="row" style={{ marginTop: '.7rem' }}>
          {onEdit && <button type="button" className="btn small secondary" onClick={() => onEdit(p)}>Edit</button>}
          {onDelete && <button type="button" className="btn small danger" onClick={() => onDelete(p)}>Delete</button>}
        </div>
      )}
    </article>
  );
}

const TIMER_LABEL = { idle: 'Not started', running: 'Running', paused: 'Paused', finished: "Time's up" };
const TIMER_TONE = { idle: 'gray', running: 'green', paused: 'amber', finished: 'red' };

export function TimerView({ t, big }) {
  const statusText = {
    idle: 'Competition not started yet',
    running: 'Competition is live now',
    paused: 'Competition paused',
    finished: 'Competition ended',
  }[t.status] || 'Competition status';

  return (
    <div className={`timer-wrapper ${big ? 'big' : ''}`}>
      <div className={`timer ${big ? 'big' : ''}`}>
        <div className="time" aria-live="off">{t.ready ? formatTime(t.ms) : '--:--:--'}</div>
        <Badge tone={TIMER_TONE[t.status]}>{TIMER_LABEL[t.status]}</Badge>
      </div>

      <div className="timer-status-panel">
        <span className="timer-status-label">Status</span>
        <strong>{TIMER_LABEL[t.status]}</strong>
        <small>{statusText}</small>
      </div>
    </div>
  );
}

export function Timer({ big }) {
  const t = useTimer();
  return <TimerView t={t} big={big} />;
}

export function Leaderboard({ me, limit }) {
  const { data, error } = usePoll('/leaderboard', 5000);
  if (error && !data) return <Alert>{error}</Alert>;
  if (!data) return <p className="muted">Loading…</p>;

  const leaderboard = Array.isArray(data) ? data : data.rows || [];
  const rows = limit ? leaderboard.slice(0, limit) : leaderboard;
  const summary = Array.isArray(data) ? null : data;
  const maxXp = Math.max(...leaderboard.map((r) => Number(r.xp) || 0), 1);

  if (!rows.length) return <p className="muted">No teams yet.</p>;

  return (
    <div className="leaderboard-panel stylish">
      {summary && (
        <div className="leaderboard-summary-grid">
          <div className="leaderboard-summary-card">
            <span>Top team</span>
            <strong>{summary.topTeam ? `${summary.topTeam.name} (${summary.topTeam.xp})` : '—'}</strong>
          </div>
        </div>
      )}

      <div className="leaderboard-showcase">
        {rows.map((r, index) => {
          const rank = Number(r.rank) || index + 1;
          const palette = ['#1ec9dd', '#1d8df0', '#7d4ce8', '#e93db9'];
          const color = palette[(rank - 1) % palette.length];
          const filledStars = Math.max(3, 5 - Math.min(2, rank - 1));

          return (
            <div key={r._id || r.name} className={`leaderboard-rank-row rank-${rank}`} style={{ '--row-color': color }}>
              <div className="leaderboard-rank-badge">{rank}</div>
              <div className="leaderboard-rank-avatar">{rank === 1 ? '🏆' : '👤'}</div>
              <div className="leaderboard-rank-name">{r.name}{me && r.name === me ? ' (you)' : ''}</div>
              <div className="leaderboard-rank-score">{r.xp} PT</div>
              <div className="leaderboard-rank-stars" aria-label={`${filledStars} out of 5 stars`}>
                {Array.from({ length: 5 }, (_, starIndex) => (
                  <span key={`${r._id || r.name}-star-${starIndex}`} className={starIndex < filledStars ? 'filled' : 'empty'}>★</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Day-wise activity chart: bars auto-scale to whatever the team has done so far
// on each competition day (the days themselves are the ones the admin already
// defined on Rounds — this just aggregates live completion/XP data against them).
export function DayWiseActivityChart({ series }) {
  if (!series || series.length === 0) {
    return <p className="muted">No day-wise activity yet. It will appear here automatically as your team completes tasks.</p>;
  }
  const maxXp = Math.max(...series.map((d) => d.xp || 0), 1);
  return (
    <div className="daywise-chart">
      <div className="daywise-bars">
        {series.map((d) => {
          const pct = Math.max(4, Math.round((d.xp / maxXp) * 100));
          return (
            <div className="daywise-col" key={d.day}>
              <div className="daywise-bar-track">
                <div className="daywise-bar" style={{ height: `${pct}%` }} title={`${d.day}: ${d.xp} XP, ${d.completed} completed`}>
                  <span className="daywise-bar-value">{d.xp}</span>
                </div>
              </div>
              <span className="daywise-day-label">{d.day}</span>
              <span className="daywise-sub-label">{d.completed} task{d.completed === 1 ? '' : 's'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Shown when a section is closed (by the admin or because time is up)
export function LockedPanel({ title, message, backTo, backLabel = 'Back' }) {
  return (
    <div className="locked-panel">
      <div className="lock-icon" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
      </div>
      <h3>{title}</h3>
      <p className="muted">{message}</p>
      {backTo && <Link className="btn secondary" to={backTo}>{backLabel}</Link>}
    </div>
  );
}
