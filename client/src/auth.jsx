import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { role: 'admin' | 'team', name }
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (path, body) => {
    const d = await api(path, { method: 'POST', body });
    localStorage.setItem('token', d.token);
    setUser(d.user);
  };
  const logout = async () => {
    const currentUser = user;
    try {
      if (currentUser?.role === 'team') {
        await api('/auth/team-logout', { method: 'POST' });
      }
    } catch {
      // ignore logout API failures; still clear the local session
    }
    localStorage.removeItem('token');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
