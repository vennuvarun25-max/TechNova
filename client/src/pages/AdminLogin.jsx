import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Alert } from '../components.jsx';

export default function AdminLogin() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/admin" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login('/auth/admin-login/hidden', { username, password });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card login">
        <h1>Admin access</h1>
        <p className="muted">Restricted administrator portal</p>
        <Alert>{err}</Alert>
        <form onSubmit={submit}>
          <label>Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
          </label>
          <label>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Enter admin portal'}</button>
        </form>
      </div>
    </div>
  );
}
