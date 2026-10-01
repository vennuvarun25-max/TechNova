import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './Layout.jsx';
import Login from './pages/Login.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminTeams from './pages/admin/AdminTeams.jsx';
import AdminTeamDetails from './pages/admin/AdminTeamDetails.jsx';
import TeamProgress from './pages/admin/TeamProgress.jsx';
import AdminRounds from './pages/admin/AdminRounds.jsx';
import AdminRoundManage from './pages/admin/AdminRoundManage.jsx';
import AdminVerification from './pages/admin/AdminVerification.jsx';
import AdminTimer from './pages/admin/AdminTimer.jsx';
import AdminAccess from './pages/admin/AdminAccess.jsx';
import AdminProjects from './pages/admin/AdminProjects.jsx';
import AdminCentralResources from './pages/admin/AdminCentralResources.jsx';
import StudentDashboard from './pages/student/StudentDashboard.jsx';
import StudentRounds from './pages/student/StudentRounds.jsx';
import StudentProgress from './pages/student/StudentProgress.jsx';
import StudentRound from './pages/student/StudentRound.jsx';
import StudentTests from './pages/student/StudentTests.jsx';
import StudentResources from './pages/student/StudentResources.jsx';
import StudentProjects from './pages/student/StudentProjects.jsx';
import StudentCentralResources from './pages/student/StudentCentralResources.jsx';
import AboutPage from './pages/student/AboutPage.jsx';
import AdminAbout from './pages/admin/AdminAbout.jsx';
import AdminHistory from './pages/admin/AdminHistory.jsx';

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin-login" element={<AdminLogin />} />

      <Route path="/admin" element={<Protected role="admin"><Layout /></Protected>}>
        <Route index element={<AdminDashboard />} />
        <Route path="teams" element={<AdminTeams />} />
        <Route path="team-details" element={<AdminTeamDetails />} />
        <Route path="teams/:id" element={<TeamProgress />} />
        <Route path="rounds" element={<AdminRounds />} />
        <Route path="rounds/:id" element={<AdminRoundManage />} />
        <Route path="projects" element={<AdminProjects />} />
        <Route path="central-resources" element={<AdminCentralResources />} />
        <Route path="about" element={<AdminAbout />} />
        <Route path="verification" element={<AdminVerification />} />
        <Route path="access" element={<AdminAccess />} />
        <Route path="timer" element={<AdminTimer />} />
        <Route path="history" element={<AdminHistory />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
      </Route>

      <Route path="/" element={<Protected role="team"><Layout /></Protected>}>
        <Route index element={<StudentDashboard />} />
        <Route path="rounds" element={<StudentRounds />} />
        <Route path="projects" element={<StudentProjects />} />
        <Route path="central-resources" element={<StudentCentralResources />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="team-progress" element={<StudentProgress />} />
        <Route path="rounds/:id" element={<StudentRound />} />
        <Route path="rounds/:id/tests" element={<StudentTests />} />
        <Route path="rounds/:id/resources" element={<StudentResources />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
