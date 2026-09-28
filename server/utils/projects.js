// Shared helpers for the Project Showcase feature. Kept separate so the
// admin, student (team) and member routers can all serialize/scope
// projects the same way instead of duplicating logic.

export function serializeProject(p, teamNameById) {
  return {
    _id: p._id,
    team: p.team,
    teamName: teamNameById.get(String(p.team)) || 'Unknown team',
    title: p.title,
    description: p.description || '',
    techStack: p.techStack || [],
    githubUrl: p.githubUrl || '',
    demoUrl: p.demoUrl || '',
    status: p.status || 'Ongoing',
    members: p.members || [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// Builds a Mongo filter for a project-showcase query, restricted to what the
// viewer is allowed to see, then narrowed further by their search/filter
// controls (status/tech/q). `ownTeamId` should be the viewer's own team id
// (or null/undefined for viewers with no team, e.g. admins who don't need
// scoping at all).
export function buildProjectVisibilityFilter({ q = '', tech = '', status = '', ownTeamId = null, seeAll = false }) {
  const searchClauses = [];
  if (status && ['Ongoing', 'Completed'].includes(status)) searchClauses.push({ status });
  if (tech) {
    searchClauses.push({ techStack: { $regex: `^${String(tech).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
  }
  if (q) {
    const rx = { $regex: String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    searchClauses.push({ $or: [{ title: rx }, { description: rx }, { techStack: rx }, { members: rx }] });
  }

  // Visibility: admins (seeAll) see everything. Everyone else only sees
  // Completed projects from other teams, plus every project belonging to
  // their own team (any status). This is enforced here, server-side, not
  // just hidden in the UI.
  const visibility = seeAll ? null : { $or: [{ status: 'Completed' }, ...(ownTeamId ? [{ team: ownTeamId }] : [])] };

  if (!visibility) return searchClauses.length ? { $and: searchClauses } : {};
  return searchClauses.length ? { $and: [visibility, ...searchClauses] } : visibility;
}
