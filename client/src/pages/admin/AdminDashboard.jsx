import { Link } from 'react-router-dom';
import { usePoll } from '../../hooks.js';
import { Alert, Leaderboard, Timer } from '../../components.jsx';

export default function AdminDashboard() {
  const { data, error } = usePoll('/admin/stats', 8000);
  return (
    <>
      <h2>Admin dashboard</h2>
      <Alert>{error}</Alert>
      <div className="grid four">
        <Link to="/admin/teams" className="card"><h3>Teams</h3><div className="stat">{data?.teams ?? '–'}</div></Link>
        <Link to="/admin/rounds" className="card"><h3>Rounds</h3><div className="stat">{data?.rounds ?? '–'}</div></Link>
        <Link to="/admin/rounds" className="card"><h3>Tasks</h3><div className="stat">{data?.tasks ?? '–'}</div></Link>
        <Link to="/admin/verification" className="card"><h3>Waiting for verification</h3><div className="stat">{data?.pending ?? '–'}</div></Link>
      </div>
      <div className="grid two section">
        <div className="card admin-timer-card">
          <div className="row between"><h3>Timer</h3><Link to="/admin/timer">Control</Link></div>
          <Timer />
        </div>
        <div className="card">
          <div className="row between"><h3>Top teams</h3><Link to="/admin/leaderboard">Full leaderboard</Link></div>
          <Leaderboard limit={5} />
        </div>
      </div>
    </>
  );
}
