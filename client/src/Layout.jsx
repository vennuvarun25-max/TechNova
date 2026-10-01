import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './auth.jsx';

const ADMIN_LINKS = [
  ['', 'Dashboard', 'dashboard'], ['/teams', 'Teams', 'teams'], ['/team-details', 'Team Details', 'teams'], ['/rounds', 'Rounds', 'rounds'], ['/projects', 'Projects', 'projects'],
  ['/verification', 'XP & Verification', 'verification'], ['/access', 'Access', 'access'], ['/timer', 'Timer', 'timer'], ['/history', 'History', 'history'], ['/central-resources', 'Central Resources', 'resources'], ['/leaderboard', 'Leaderboard', 'leaderboard'], ['/about', 'About', 'about'],
];
const TEAM_LINKS = [['', 'Dashboard', 'dashboard'], ['/rounds', 'Rounds', 'rounds'], ['/projects', 'Projects', 'projects'], ['/team-progress', 'Team Progress', 'team-progress'], ['/central-resources', 'Central Resources', 'resources'], ['/leaderboard', 'Leaderboard', 'leaderboard'], ['/about', 'About', 'about']];

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
            {links.map(([to, label, icon]) => (
              <NavLink key={label} to={base + to || '/'} end={to === ''} data-nav-icon={icon} className={label === 'About' ? 'about-link' : undefined}>{label}</NavLink>
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
