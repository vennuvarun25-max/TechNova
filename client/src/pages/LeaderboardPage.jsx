import { useAuth } from '../auth.jsx';
import { Leaderboard } from '../components.jsx';

export default function LeaderboardPage() {
  const { user } = useAuth();
  return (
    <>
      <h2>Leaderboard</h2>
      <div className="card">
        <p className="muted">Ranked by verified team XP.</p>
        <Leaderboard me={user.role === 'team' ? user.name : null} />
      </div>
    </>
  );
}
