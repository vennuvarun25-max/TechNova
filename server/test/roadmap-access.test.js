import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRoadmapAccess } from '../utils/roadmap.js';

test('roadmap access is granted when matching access record is enabled', () => {
  const result = computeRoadmapAccess({
    roadmap: { isLocked: false },
    access: [{ isGranted: true, team: 'team-1', member: null }],
    user: { role: 'team', id: 'team-1' },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, '');
});

test('roadmap access is denied when the roadmap is locked for the user', () => {
  const result = computeRoadmapAccess({
    roadmap: { isLocked: true },
    access: [],
    user: { role: 'team', id: 'team-2' },
  });

  assert.equal(result.allowed, false);
  assert.match(result.reason, /locked|request access/i);
});
