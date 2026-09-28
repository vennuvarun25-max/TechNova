import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAccess } from '../utils/access.js';
import { buildProjectVisibilityFilter } from '../utils/projects.js';
import { buildCentralResourceVisibilityFilter, canAccessRoundResources, canAccessRoundTests, isCentralResourceAvailable } from '../utils/central-resources.js';
import { IDENTITY_ROLES, normalizeTeamMemberRole, roleForTeamSlot } from '../utils/member-roles.js';
import { buildTeamRankings, createCachedLoader } from '../utils/team-rank.js';

test('locking a round closes its tests and resources', () => {
  const access = computeAccess(
    { testsEnabled: true, resourcesEnabled: true },
    { status: 'running', lockTestsOnTimeUp: true },
    { isLocked: true }
  );

  assert.equal(access.tests.allowed, false);
  assert.equal(access.resources.allowed, false);
  assert.match(access.tests.reason, /locked/i);
});

test('unlocked rounds still respect team section locks', () => {
  const access = computeAccess(
    { testsEnabled: false, resourcesEnabled: true },
    { status: 'running', lockTestsOnTimeUp: true },
    { isLocked: false }
  );

  assert.equal(access.tests.allowed, false);
  assert.equal(access.resources.allowed, true);
});

test('teams see ongoing projects only from their own team', () => {
  const filter = buildProjectVisibilityFilter({ ownTeamId: 'team-1' });

  assert.deepEqual(filter, {
    $or: [{ status: 'Completed' }, { team: 'team-1' }],
  });
  assert.deepEqual(buildProjectVisibilityFilter({ ownTeamId: 'team-1', seeAll: true }), {});
});

test('central Test Resources remain hidden until released while Shared Resources are available', () => {
  assert.deepEqual(buildCentralResourceVisibilityFilter('test'), { category: 'test', isReleased: true });
  assert.deepEqual(buildCentralResourceVisibilityFilter('shared'), { category: 'shared' });
  assert.equal(isCentralResourceAvailable({ category: 'test', isReleased: false }), false);
  assert.equal(isCentralResourceAvailable({ category: 'test', isReleased: true }), true);
  assert.equal(isCentralResourceAvailable({ category: 'shared', isReleased: false }), true);
});

test('day completion releases round resources without unlocking tests', () => {
  assert.equal(canAccessRoundTests({ isLocked: true, isDayComplete: true }), false);
  assert.equal(canAccessRoundTests({ isLocked: false, isDayComplete: true }), false);
  assert.equal(canAccessRoundTests({ isLocked: false, isDayComplete: false }), true);
  assert.equal(computeAccess(
    { testsEnabled: true, resourcesEnabled: true },
    { status: 'running', lockTestsOnTimeUp: true },
    { isLocked: false, isDayComplete: true }
  ).tests.allowed, false);
  assert.equal(canAccessRoundResources({ isLocked: true, isDayComplete: false }), false);
  assert.equal(canAccessRoundResources({ isLocked: true, isDayComplete: true }), true);
  assert.equal(canAccessRoundResources({ isLocked: false, isDayComplete: false }), true);
});

test('team roster slots use the identity-based roles and normalize legacy labels', () => {
  assert.deepEqual([0, 1, 2].map(roleForTeamSlot), IDENTITY_ROLES);
  assert.equal(normalizeTeamMemberRole('Team Lead', 0), 'VISION LEAD');
  assert.equal(normalizeTeamMemberRole('Team Member', 1), 'CODE ARCHITECT');
  assert.equal(normalizeTeamMemberRole('Team Member', 2), 'INNOVATION STRATEGIST');
});

test('team rankings combine grouped XP totals and preserve deterministic rank order', () => {
  const rankings = buildTeamRankings(
    [{ _id: 'team-a', name: 'Alpha' }, { _id: 'team-b', name: 'Beta' }, { _id: 'team-c', name: 'Gamma' }],
    [{ _id: 'team-a', total: 20 }, { _id: 'team-b', total: 25 }],
    [{ _id: 'team-a', total: 10 }, { _id: 'team-c', total: 40 }]
  );

  assert.deepEqual(rankings.map(({ name, xp, rank }) => ({ name, xp, rank })), [
    { name: 'Gamma', xp: 40, rank: 1 },
    { name: 'Alpha', xp: 30, rank: 2 },
    { name: 'Beta', xp: 25, rank: 3 },
  ]);
});

test('cached ranking loader deduplicates concurrent work and reuses fresh values', async () => {
  let now = 100;
  let calls = 0;
  const load = createCachedLoader(async () => ({ version: ++calls }), 50, () => now);
  const [first, concurrent] = await Promise.all([load(), load()]);
  assert.equal(calls, 1);
  assert.equal(first, concurrent);
  assert.equal((await load()).version, 1);
  now = 151;
  assert.equal((await load()).version, 2);
});
