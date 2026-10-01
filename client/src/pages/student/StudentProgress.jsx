import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePoll } from '../../hooks.js';
import { Alert, Badge, DayWiseActivityChart } from '../../components.jsx';

function TeamProgressChart({ teamName, day, entries }) {
  const values = entries.map((entry, index) => {
    const x = entries.length === 1 ? 320 : 40 + (index / (entries.length - 1)) * 560;
    const y = 170 - (entry.progress / 100) * 120;
    return { ...entry, x, y };
  });

  const path = values.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="card">
      <h3>{teamName} team progress · {day} rounds</h3>
      <svg viewBox="0 0 640 220" className="leaderboard-line-chart" role="img" aria-label="Team task completion progress by round">
        {[0, 1, 2, 3].map((step) => <line key={step} x1="40" x2="600" y1={20 + step * 45} y2={20 + step * 45} className="leaderboard-grid-line" />)}
        <path d={path} className="leaderboard-line-path" style={{ stroke: '#6d8bff' }} />
        {values.map((point) => (
          <g key={point.label}>
            <title>{`${point.roundName} (${point.day}): ${point.completedCount} of ${point.taskCount} tasks complete (${Math.round(point.progress)}%)`}</title>
            <circle cx={point.x} cy={point.y} r="5" fill="white" stroke="#6d8bff" strokeWidth="2.5" />
            <text x={point.x} y="205" textAnchor="middle" className="leaderboard-point-label">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function StudentProgress() {
  const me = usePoll('/student/me', 5000);
  const rounds = usePoll('/student/rounds', 10000);
  const daywise = usePoll('/student/activity-by-day', 10000);

  const currentDayRounds = useMemo(() => {
    const allRounds = rounds.data || [];
    const nextRound = allRounds.find((round) => !round.isDayComplete);
    const day = nextRound?.day || allRounds[allRounds.length - 1]?.day || 'Day 1';
    return { day, rounds: allRounds.filter((round) => (round.day || 'Day 1') === day) };
  }, [rounds.data]);

  const progressEntries = useMemo(() => {
    return currentDayRounds.rounds.map((round, index) => ({
      label: `R${index + 1}`,
      roundName: round.name,
      day: currentDayRounds.day,
      completedCount: Number(round.completedCount || 0),
      taskCount: Number(round.taskCount || 0),
      progress: round.taskCount ? Math.min(Number(round.completedCount || 0) / Number(round.taskCount) * 100, 100) : 0,
    }));
  }, [currentDayRounds]);

  if (!me.data) return <p className="muted">Loading…</p>;

  return (
    <>
      <Link to="/" className="back">← Back to dashboard</Link>
      <section className="hero">
        <div>
          <p className="hero-label">Team progress</p>
          <h2>{me.data.name}</h2>
          <div className="chips">
            <span className="chip">Team ID: {me.data.teamId || '—'}</span>
            <span className="chip">Total XP: {me.data.xp ?? 0}</span>
          </div>
        </div>
      </section>

      <Alert>{me.error}</Alert>
      <Alert>{rounds.error}</Alert>

      <TeamProgressChart teamName={me.data.name} day={currentDayRounds.day} entries={progressEntries} />

      <div className="card">
        <h3>Day-wise activity</h3>
        <p className="muted" style={{ marginTop: '-.3rem' }}>Updates automatically as your team completes tasks across each competition day.</p>
        <DayWiseActivityChart series={daywise.data?.series} />
      </div>

      <div className="card">
        <h3>Round tracking</h3>
        {rounds.data?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Status</th>
                  <th className="num">Completed tasks</th>
                  <th className="num">XP</th>
                </tr>
              </thead>
              <tbody>
                {rounds.data.map((round) => (
                  <tr key={round._id}>
                    <td>{round.name}</td>
                    <td><Badge tone={round.status === 'Completed' ? 'green' : round.status === 'In progress' ? 'amber' : 'gray'}>{round.status}</Badge></td>
                    <td className="num">{round.completedCount || 0} / {round.taskCount || 0}</td>
                    <td className="num">{Math.min((round.completedCount || 0) * 10, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No round activity yet.</p>
        )}
      </div>
    </>
  );
}
