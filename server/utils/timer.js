import { Timer } from '../models/index.js';
import { httpError } from './helpers.js';

export const getTimer = () =>
  Timer.findOneAndUpdate({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { upsert: true, new: true });

// The server is the single source of truth. Clients get "remainingMs" and count down locally.
export function serializeTimer(t) {
  const now = Date.now();
  const elapsed = t.elapsedMs + (t.status === 'running' && t.startedAt ? now - t.startedAt.getTime() : 0);
  const remainingMs = Math.max(0, t.durationSec * 1000 - elapsed);
  const status = t.status === 'running' && remainingMs === 0 ? 'finished' : t.status;
  return {
    durationSec: t.durationSec,
    status,
    remainingMs,
    lockTestsOnTimeUp: t.lockTestsOnTimeUp !== false,
    serverTime: now,
  };
}

export async function timerAction(action, body = {}) {
  const t = await getTimer();
  const now = new Date();
  switch (action) {
    case 'duration': {
      const m = Number(body.minutes);
      if (!Number.isFinite(m) || m <= 0 || m > 1440) throw httpError(400, 'Enter minutes between 1 and 1440');
      t.durationSec = Math.round(m * 60);
      t.status = 'idle';
      t.elapsedMs = 0;
      t.startedAt = null;
      break;
    }
    case 'start':
      if (t.status !== 'idle') throw httpError(400, 'Timer already started. Reset it first.');
      t.status = 'running';
      t.startedAt = now;
      t.elapsedMs = 0;
      break;
    case 'pause':
      if (t.status !== 'running') throw httpError(400, 'Timer is not running.');
      t.elapsedMs += now - t.startedAt;
      t.startedAt = null;
      t.status = 'paused';
      break;
    case 'resume':
      if (t.status !== 'paused') throw httpError(400, 'Timer is not paused.');
      t.status = 'running';
      t.startedAt = now;
      break;
    case 'reset':
      t.status = 'idle';
      t.elapsedMs = 0;
      t.startedAt = null;
      break;
    case 'autolock':
      if (typeof body.enabled !== 'boolean') throw httpError(400, 'Invalid setting');
      t.lockTestsOnTimeUp = body.enabled;
      break;
    default:
      throw httpError(404, 'Unknown timer action');
  }
  await t.save();
  return serializeTimer(t);
}
