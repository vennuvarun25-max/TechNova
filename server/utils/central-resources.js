export function buildCentralResourceVisibilityFilter(category = 'all') {
  if (category === 'test') return { category: 'test', isReleased: true };
  if (category === 'shared') return { category: 'shared' };
  return { $or: [{ category: 'shared' }, { category: 'test', isReleased: true }] };
}

export function isCentralResourceAvailable(resource) {
  return resource.category === 'shared' || (resource.category === 'test' && resource.isReleased === true);
}

export function canAccessRoundTests(round) {
  return !round.isLocked && round.isDayComplete !== true;
}

export function canAccessRoundResources(round) {
  return !round.isLocked || round.isDayComplete === true;
}