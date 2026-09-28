import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Fetch a GET endpoint now and then every `ms` milliseconds
export function usePoll(path, ms = 5000) {
  const [state, setState] = useState({ data: null, at: 0 });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api(path);
      setState({ data, at: Date.now() });
      setError('');
    } catch (e) {
      // 403 = section closed by admin: drop the old data so nothing stays visible
      if (e.status === 403 || e.status === 404) setState({ data: null, at: Date.now() });
      setError(e.message);
    }
  }, [path]);

  useEffect(() => {
    load();
    const id = setInterval(load, ms);
    return () => clearInterval(id);
  }, [load, ms]);

  return { data: state.data, at: state.at, error, reload: load };
}

// Competition timer: server sends remaining time, we count down locally between polls
export function useTimer() {
  const { data, at, reload } = usePoll('/timer', 10000);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  if (!data) return { ready: false, ms: 0, status: 'idle', durationSec: 0, reload };
  let ms = data.remainingMs;
  let status = data.status;
  if (status === 'running') {
    ms = Math.max(0, data.remainingMs - (now - at));
    if (ms === 0) status = 'finished';
  }
  return { ready: true, ms, status, durationSec: data.durationSec, lockTestsOnTimeUp: data.lockTestsOnTimeUp, reload };
}

export function formatTime(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
