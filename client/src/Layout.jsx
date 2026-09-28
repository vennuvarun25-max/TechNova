import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './auth.jsx';

const ADMIN_LINKS = [
  ['', 'Dashboard'], ['/teams', 'Teams'], ['/rounds', 'Rounds'], ['/projects', 'Projects'],
  ['/verification', 'XP & Verification'], ['/access', 'Access'], ['/timer', 'Timer'], ['/central-resources', 'Central Resources'], ['/leaderboard', 'Leaderboard'], ['/about', 'About'],
];
const TEAM_LINKS = [['', 'Dashboard'], ['/rounds', 'Rounds'], ['/projects', 'Projects'], ['/team-progress', 'Team Progress'], ['/central-resources', 'Central Resources'], ['/leaderboard', 'Leaderboard'], ['/about', 'About']];

export default function Layout() {
  const { user, logout } = useAuth();
  const isAdmin = user.role === 'admin';
  const base = isAdmin ? '/admin' : '';
  const links = isAdmin ? ADMIN_LINKS : TEAM_LINKS;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand"><span className="logo" aria-hidden="true">T</span>TechNova</span>
          <nav aria-label="Main">
            {links.map(([to, label]) => (
              <NavLink key={label} to={base + to || '/'} end={to === ''} className={label === 'About' ? 'about-link' : undefined}>{label}</NavLink>
            ))}
          </nav>
          <div className="user">
            <span className="muted">{isAdmin ? 'Admin' : user.name}</span>
            <button className="btn small secondary" onClick={logout}>Log out</button>
          </div>
        </div>
      </header>
      <main className="container"><Outlet /></main>
    </>
  );
}
