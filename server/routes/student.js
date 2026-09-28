import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { Team, TeamMember, Round, Task, Resource, CentralResource, Completion, XPRecord, XPTransaction, Member, Project } from '../models/index.js';
import { h, httpError } from '../utils/helpers.js';
import { getTimer, serializeTimer } from '../utils/timer.js';
import { computeAccess } from '../utils/access.js';
import { serializeProject, buildProjectVisibilityFilter } from '../utils/projects.js';
import { buildCentralResourceVisibilityFilter, canAccessRoundResources } from '../utils/central-resources.js';
import { normalizeTeamMemberRole } from '../utils/member-roles.js';
import { buildTeamRankings, createCachedLoader } from '../utils/team-rank.js';

const r = Router();
r.use(auth, requireRole('team'));

const sortRounds = { order: 1, createdAt: 1 };
const PROFILE_FIELDS = ['linkedinUrl', 'githubUrl', 'leetcodeUrl', 'kaggleUrl'];
const getTeamRankings = createCachedLoader(async () => {
  const [teams, xpTotals, transactionTotals] = await Promise.all([
    Team.find().select('_id name').lean(),
    XPRecord.aggregate([{ $group: { _id: '$team', total: { $sum: '$points' } } }]),
    XPTransaction.aggregate([{ $group: { _id: '$team', total: { $sum: '$amount' } } }]),
  ]);
  return buildTeamRankings(teams, xpTotals, transactionTotals);
}, 5000);

async function loadAccess(teamId, roundId = null) {
  const [team, timer, round] = await Promise.all([
    Team.findById(teamId).lean(),
    getTimer(),
    roundId ? Round.findById(roundId).lean() : null,
  ]);
  if (!team) throw httpError(401, 'Team no longer exists');
  if (roundId && !round) throw httpError(404, 'Round not found');
  return { team, round, access: computeAccess(team, serializeTimer(timer), round) };
}

// Team info, verified XP and what the team may currently open
r.get('/me', h(async (req, res) => {
  const { team, access } = await loadAccess(req.user.id);
  const [teamMembers, xps, txns, ranked] = await Promise.all([
    TeamMember.find({ team: team._id }).sort('_id').lean(),
    XPRecord.find({ team: team._id }).lean(),
    XPTransaction.find({ team: team._id }).lean(),
    getTeamRankings(),
  ]);

  const roster = teamMembers.map((member, index) => ({
    _id: member._id,
    fullName: member.name,
    role: normalizeTeamMemberRole(member.role, index),
    linkedinUrl: member.linkedinUrl || '',
    githubUrl: member.githubUrl || '',
    leetcodeUrl: member.leetcodeUrl || '',
    kaggleUrl: member.kaggleUrl || '',
    profileXpAwarded: !!member.profileXpAwarded,
  }));

  const totalTeamXp = xps.reduce((sum, x) => sum + (x.points || 0), 0) + txns.reduce((sum, x) => sum + (x.amount || 0), 0);
  const rank = ranked.find((entry) => String(entry._id) === String(team._id))?.rank || 0;

  res.json({
    teamId: team.teamId,
    name: team.name,
    xp: totalTeamXp,
    rank,
    teamCount: ranked.length,
    members: roster,
    access,
  });
}));

r.post('/members/:memberId/profile-links', h(async (req, res) => {
  const { team } = await loadAccess(req.user.id);
  const member = await TeamMember.findOne({ _id: req.params.memberId, team: team._id });
  if (!member) throw httpError(404, 'Candidate not found');
  for (const field of PROFILE_FIELDS) {
    if (req.body?.[field] !== undefined) member[field] = String(req.body[field] ?? '').trim();
  }
  member.profileXpAwarded = false;
  member.profileCompletedAt = new Date();
  await member.save();
  res.json({ ok: true });
}));

// Round cards
r.get('/rounds', h(async (req, res) => {
  const [rounds, tasks, resources, completions] = await Promise.all([
    Round.find().sort({ dayOrder: 1, order: 1, createdAt: 1 }).lean(),
    Task.find().select('round').lean(),
    Resource.find().select('round').lean(),
    Completion.find({ team: req.user.id }).select('round').lean(),
  ]);
  const count = (list, id) => list.filter((x) => String(x.round) === String(id)).length;
  res.json(rounds.map((rd) => {
    const taskCount = count(tasks, rd._id);
    const completedCount = count(completions, rd._id);
    const status = completedCount === 0 ? 'Not started' : completedCount >= taskCount ? 'Completed' : 'In progress';
    return { _id: rd._id, name: rd.name, description: rd.description, day: rd.day || 'Day 1', dayOrder: rd.dayOrder || 1, order: rd.order || 0, isLocked: rd.isLocked === true, isDayComplete: rd.isDayComplete === true, taskCount, completedCount, resourceCount: count(resources, rd._id), status };
  }));
}));

// Round overview (description + instructions). Tests and resources are separate endpoints.
r.get('/rounds/:id', h(async (req, res) => {
  const round = await Round.findById(req.params.id).lean();
  if (!round) throw httpError(404, 'Round not found');
  if (round.isLocked || round.isDayComplete) throw httpError(403, 'This day is complete or locked. Open released resources from Central Resources.');
  const [taskCount, resourceCount, completedCount] = await Promise.all([
    Task.countDocuments({ round: round._id }),
    Resource.countDocuments({ round: round._id }),
    Completion.countDocuments({ team: req.user.id, round: round._id }),
  ]);
  res.json({ round, taskCount, resourceCount, completedCount });
}));

// TESTS section (blocked when closed by admin or time is up)
r.get('/rounds/:id/tests', h(async (req, res) => {
  const { access } = await loadAccess(req.user.id, req.params.id);
  if (!access.tests.allowed) throw httpError(403, access.tests.reason);
  const round = await Round.findById(req.params.id).select('name').lean();
  if (!round) throw httpError(404, 'Round not found');
  const [tasks, completions, xps] = await Promise.all([
    Task.find({ round: round._id }).sort(sortRounds).lean(),
    Completion.find({ team: req.user.id, round: round._id }).lean(),
    XPRecord.find({ team: req.user.id }).lean(),
  ]);
  const cMap = new Map(completions.map((c) => [String(c.task), c]));
  const xMap = new Map(xps.map((x) => [String(x.task), x]));
  res.json({
    round,
    tasks: tasks.map((t) => {
      const c = cMap.get(String(t._id));
      return {
        _id: t._id, title: t.title, description: t.description, link: t.link,
        completed: !!c, verified: !!c?.verified,
        points: c?.verified ? xMap.get(String(t._id))?.points ?? 0 : null,
      };
    }),
  });
}));

// RESOURCES section (blocked when closed by admin)
r.get('/rounds/:id/resources', h(async (req, res) => {
  const { access } = await loadAccess(req.user.id);
  if (!access.resources.allowed) throw httpError(403, access.resources.reason);
  const round = await Round.findById(req.params.id).select('name isLocked isDayComplete').lean();
  if (!round) throw httpError(404, 'Round not found');
  if (round.isDayComplete || !canAccessRoundResources(round)) throw httpError(403, 'Round resources for a completed day are available in Central Resources.');
  const resources = await Resource.find({ round: round._id }).sort('createdAt').select('-storedName').lean();
  res.json({ round, resources });
}));

// Tick / untick "Completed" (recorded for this team only; never awards XP)
r.post('/tasks/:id/complete', h(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw httpError(404, 'Task not found');
  const { access } = await loadAccess(req.user.id, task.round);
  if (!access.tests.allowed) throw httpError(403, access.tests.reason);
  const existing = await Completion.findOne({ team: req.user.id, task: task._id });
  if (req.body.completed) {
    if (!existing) await Completion.create({ team: req.user.id, task: task._id, round: task.round, completedAt: new Date() });
    else if (!existing.verified) {
      throw httpError(400, 'This task is already submitted and waiting for admin review');
    }
  } else if (existing) {
    if (existing.verified) throw httpError(400, 'This task is already verified and locked');
    throw httpError(400, 'This task is already submitted and cannot be edited until admin review');
  }
  res.json({ ok: true });
}));

// =========================================================
// PROJECT SHOWCASE
// =========================================================
r.get('/central-resources', h(async (req, res) => {
  const category = String(req.query.category || 'all');
  if (!['all', 'test', 'shared'].includes(category)) throw httpError(400, 'Invalid resource category');
  const { access } = await loadAccess(req.user.id);
  if (!access.resources.allowed) throw httpError(403, access.resources.reason);
  const [central, completedRounds] = await Promise.all([
    CentralResource.find(buildCentralResourceVisibilityFilter(category)).select('-storedName').lean(),
    category === 'shared' ? [] : Round.find({ isDayComplete: true }).select('_id name day').lean(),
  ]);
  const roundResources = completedRounds.length
    ? await Resource.find({ round: { $in: completedRounds.map((round) => round._id) } }).select('-storedName').lean()
    : [];
  const roundById = new Map(completedRounds.map((round) => [String(round._id), round]));
  res.json([
    ...central,
    ...roundResources.map((resource) => ({
      ...resource,
      category: 'test',
      isReleased: true,
      roundName: roundById.get(String(resource.round))?.name || '',
      day: roundById.get(String(resource.round))?.day || 'Day 1',
      source: 'round',
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
}));

// Showcase feed. Visibility is enforced here, not just in the UI:
// a team account only ever gets back Completed projects from other teams,
// plus its own team's projects (Ongoing or Completed). Optional search/filter
// query params still apply on top of that: ?q=text  ?tech=React  ?status=Ongoing|Completed
r.get('/projects', h(async (req, res) => {
  const { q = '', tech = '', status = '' } = req.query;
  const filter = buildProjectVisibilityFilter({ q, tech, status, ownTeamId: req.user.id });
  const [projects, teams] = await Promise.all([
    Project.find(filter).sort({ createdAt: -1 }).lean(),
    Team.find().select('_id name').lean(),
  ]);
  const teamNameById = new Map(teams.map((t) => [String(t._id), t.name]));
  res.json(projects.map((p) => serializeProject(p, teamNameById)));
}));

// The signed-in team's own projects (for managing / editing)
r.get('/projects/mine', h(async (req, res) => {
  const [projects, team] = await Promise.all([
    Project.find({ team: req.user.id }).sort({ createdAt: -1 }).lean(),
    Team.findById(req.user.id).select('name').lean(),
  ]);
  const teamNameById = new Map([[String(req.user.id), team?.name || 'Your team']]);
  res.json(projects.map((p) => serializeProject(p, teamNameById)));
}));

// Create a project for the signed-in team
r.post('/projects', h(async (req, res) => {
  const { title, description = '', techStack = [], githubUrl = '', demoUrl = '', status = 'Ongoing', members = [] } = req.body || {};
  if (!String(title || '').trim()) throw httpError(400, 'Project title is required');
  const cleanTech = (Array.isArray(techStack) ? techStack : String(techStack).split(','))
    .map((t) => String(t).trim()).filter(Boolean);
  const cleanMembers = (Array.isArray(members) ? members : String(members).split(','))
    .map((m) => String(m).trim()).filter(Boolean);
  const project = await Project.create({
    team: req.user.id,
    title: String(title).trim(),
    description: String(description || '').trim(),
    techStack: cleanTech,
    githubUrl: String(githubUrl || '').trim(),
    demoUrl: String(demoUrl || '').trim(),
    status: ['Ongoing', 'Completed'].includes(status) ? status : 'Ongoing',
    members: cleanMembers,
  });
  const team = await Team.findById(req.user.id).select('name').lean();
  res.status(201).json(serializeProject(project.toObject(), new Map([[String(req.user.id), team?.name || 'Your team']])));
}));

// Edit a project (only the owning team may edit)
r.put('/projects/:id', h(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, team: req.user.id });
  if (!project) throw httpError(404, 'Project not found');
  const { title, description, techStack, githubUrl, demoUrl, status, members } = req.body || {};
  if (title !== undefined) project.title = String(title).trim();
  if (description !== undefined) project.description = String(description).trim();
  if (techStack !== undefined) {
    project.techStack = (Array.isArray(techStack) ? techStack : String(techStack).split(','))
      .map((t) => String(t).trim()).filter(Boolean);
  }
  if (githubUrl !== undefined) project.githubUrl = String(githubUrl).trim();
  if (demoUrl !== undefined) project.demoUrl = String(demoUrl).trim();
  if (status !== undefined && ['Ongoing', 'Completed'].includes(status)) project.status = status;
  if (members !== undefined) {
    project.members = (Array.isArray(members) ? members : String(members).split(','))
      .map((m) => String(m).trim()).filter(Boolean);
  }
  await project.save();
  const team = await Team.findById(req.user.id).select('name').lean();
  res.json(serializeProject(project.toObject(), new Map([[String(req.user.id), team?.name || 'Your team']])));
}));

// Delete a project (only the owning team may delete)
r.delete('/projects/:id', h(async (req, res) => {
  const project = await Project.findOneAndDelete({ _id: req.params.id, team: req.user.id });
  if (!project) throw httpError(404, 'Project not found');
  res.json({ ok: true });
}));

// =========================================================
// DAY-WISE ACTIVITY (auto-computed from this team's completions/XP,
// grouped by the Round.day set up by the admin — no manual entry needed)
// =========================================================
r.get('/activity-by-day', h(async (req, res) => {
  const [rounds, completions, xps, txns] = await Promise.all([
    Round.find().select('day dayOrder').lean(),
    Completion.find({ team: req.user.id }).select('round completedAt verified').lean(),
    XPRecord.find({ team: req.user.id }).select('round points').lean(),
    XPTransaction.find({ team: req.user.id }).select('round amount').lean(),
  ]);

  const dayByRound = new Map(rounds.map((rd) => [String(rd._id), rd.day || 'Day 1']));
  const dayOrderByDay = new Map();
  rounds.forEach((rd) => {
    const day = rd.day || 'Day 1';
    if (!dayOrderByDay.has(day)) dayOrderByDay.set(day, rd.dayOrder ?? 0);
  });

  const buckets = new Map(); // day -> { completed, verified, xp }
  const ensure = (day) => {
    if (!buckets.has(day)) buckets.set(day, { day, completed: 0, verified: 0, xp: 0 });
    return buckets.get(day);
  };

  completions.forEach((c) => {
    const day = dayByRound.get(String(c.round)) || 'Day 1';
    const b = ensure(day);
    b.completed += 1;
    if (c.verified) b.verified += 1;
  });
  xps.forEach((x) => {
    const day = dayByRound.get(String(x.round)) || 'Day 1';
    ensure(day).xp += x.points || 0;
  });
  txns.forEach((x) => {
    const day = x.round ? (dayByRound.get(String(x.round)) || 'Day 1') : null;
    if (day) ensure(day).xp += x.amount || 0;
  });

  const series = Array.from(buckets.values()).sort((a, b) => {
    const oa = dayOrderByDay.get(a.day) ?? 0;
    const ob = dayOrderByDay.get(b.day) ?? 0;
    return oa - ob || a.day.localeCompare(b.day);
  });

  res.json({ series });
}));

export default r;
