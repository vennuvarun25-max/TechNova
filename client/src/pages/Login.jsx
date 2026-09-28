import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Alert } from '../components.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    const dest = user.role === 'admin' ? '/admin' : '/';
    return <Navigate to={dest} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login('/auth/team-login', { teamId: a, password: b });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card login">
        <h1>TechNova</h1>
        <p className="muted">Sign in to join the competition.</p>
        <Alert>{err}</Alert>
        <form onSubmit={submit}>
          <label>Team ID / Team name
            <input value={a} onChange={(e) => setA(e.target.value)} autoComplete="username" required autoFocus />
          </label>
          <label>Team password
            <input type="password" value={b} onChange={(e) => setB(e.target.value)} autoComplete="current-password" required />
          </label>
          <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
