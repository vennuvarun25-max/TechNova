export function buildTeamRankings(teams, xpTotals, transactionTotals) {
  const recordsByTeam = new Map(xpTotals.map(({ _id, total }) => [String(_id), total || 0]));
  const transactionsByTeam = new Map(transactionTotals.map(({ _id, total }) => [String(_id), total || 0]));

  return teams
    .map((team) => ({
      ...team,
      xp: (recordsByTeam.get(String(team._id)) || 0) + (transactionsByTeam.get(String(team._id)) || 0),
    }))
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

export function createCachedLoader(load, ttlMs, now = Date.now) {
  let cachedValue;
  let expiresAt = 0;
  let pending;

  return () => {
    if (cachedValue !== undefined && now() < expiresAt) return Promise.resolve(cachedValue);
    if (pending) return pending;

    pending = Promise.resolve()
      .then(load)
      .then((value) => {
        cachedValue = value;
        expiresAt = now() + ttlMs;
        return value;
      })
      .finally(() => { pending = null; });

    return pending;
  };
}