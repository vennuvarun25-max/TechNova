import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { Member, Team, Round, Task, Resource, Completion, XPRecord, HintAccess, HintUsage, HintAudit, Project } from '../models/index.js';
import { h, httpError } from '../utils/helpers.js';
import { computeAccess } from '../utils/access.js';
import { getTimer, serializeTimer } from '../utils/timer.js';
import { serializeProject, buildProjectVisibilityFilter } from '../utils/projects.js';
import { canAccessRoundResources, canAccessRoundTests } from '../utils/central-resources.js';

const r = Router();
r.use(auth, requireRole('member'));

const sortRounds = { dayOrder: 1, order: 1, createdAt: 1 };

async function ensureRoundOpen(roundId) {
  const round = await Round.findById(roundId).select('isLocked isDayComplete').lean();
  if (!round) throw httpError(404, 'Round not found');
  if (!canAccessRoundTests(round)) throw httpError(403, 'This day is complete or locked.');
  return round;
}

r.get('/me', h(async (req, res) => {
  const member = await Member.findById(req.user.id).populate('team', 'name').lean();
  if (!member) throw httpError(401, 'Member account no longer exists');
  if (!member.isActive) throw httpError(403, 'This member account is disabled');

  const team = await Team.findById(member.team).select('name').lean();
  const [teamMembers, teamXps] = await Promise.all([
    Member.find({ team: member.team }).sort('_id').lean(),
    XPRecord.find({ team: member.team }).lean(),
  ]);

  const totalTeamXp = teamXps.reduce((sum, x) => sum + x.points, 0);
  const access = computeAccess(team, serializeTimer(await getTimer()));

  res.json({
    _id: member._id,
    fullName: member.fullName,
    memberId: member.memberId,
    username: member.username,
    team: member.team,
    teamName: member.teamName || team?.name,
    role: member.role,
    isActive: member.isActive,
    problemsAttempted: member.problemsAttempted,
    problemsCompleted: member.problemsCompleted,
    hintsUsed: member.hintsUsed,
    submissions: member.submissions,
    individualXp: member.individualXp,
    teamXp: totalTeamXp,
    members: teamMembers.map((m) => ({
      name: m.fullName,
      role: m.role,
      username: m.username,
      memberId: m.memberId,
      active: m.isActive,
    })),
    access,
  });
}));

r.get('/rounds', h(async (req, res) => {
  const member = await Member.findById(req.user.id).select('team').lean();
  const [rounds, tasks, resources, completions] = await Promise.all([
    Round.find().sort(sortRounds).lean(),
    Task.find().select('round').lean(),
    Resource.find().select('round').lean(),
    Completion.find({ team: member.team }).select('round').lean(),
  ]);

  const count = (list, id) => list.filter((x) => String(x.round) === String(id)).length;
  res.json(rounds.map((rd) => {
    const taskCount = count(tasks, rd._id);
    const completedCount = count(completions, rd._id);
    const status = completedCount === 0 ? 'Not started' : completedCount >= taskCount ? 'Completed' : 'In progress';
    return { _id: rd._id, name: rd.name, description: rd.description, day: rd.day || 'Day 1', dayOrder: rd.dayOrder || 1, order: rd.order || 0, isLocked: rd.isLocked === true, isDayComplete: rd.isDayComplete === true, taskCount, completedCount, resourceCount: count(resources, rd._id), status };
  }));
}));

r.get('/rounds/:id', h(async (req, res) => {
  await ensureRoundOpen(req.params.id);
  const round = await Round.findById(req.params.id).lean();
  const member = await Member.findById(req.user.id).select('team').lean();
  const [taskCount, resourceCount, completedCount] = await Promise.all([
    Task.countDocuments({ round: round._id }),
    Resource.countDocuments({ round: round._id }),
    Completion.countDocuments({ team: member.team, round: round._id }),
  ]);
  res.json({ round, taskCount, resourceCount, completedCount });
}));

r.get('/rounds/:id/tests', h(async (req, res) => {
  await ensureRoundOpen(req.params.id);
  const round = await Round.findById(req.params.id).select('name').lean();
  if (!round) throw httpError(404, 'Round not found');
  const [tasks, completions, hintAccess] = await Promise.all([
    Task.find({ round: round._id }).sort(sortRounds).lean(),
    Completion.find({ team: (await Member.findById(req.user.id).select('team').lean())?.team }).lean(),
    HintAccess.find({ member: req.user.id }).lean(),
  ]);
  const cMap = new Map(completions.map((c) => [String(c.task), c]));
  const hintMap = new Map(hintAccess.map((h) => [String(h.task), h]));
  res.json({
    round,
    tasks: tasks.map((t) => {
      const c = cMap.get(String(t._id));
      const access = hintMap.get(String(t._id));
      const hintStatus = access?.status || 'not_available';
      const hintVisible = hintStatus === 'available' || hintStatus === 'used';
      return {
        _id: t._id,
        title: t.title,
        description: t.description,
        link: t.link,
        completed: !!c,
        verified: !!c?.verified,
        hintAvailable: hintVisible,
        hintStatus,
        hintText: hintVisible ? t.hint : null,
        hintPenaltyXp: t.hintPenaltyXp || 0,
      };
    }),
  });
}));

r.get('/rounds/:id/resources', h(async (req, res) => {
  const round = await Round.findById(req.params.id).select('name isLocked isDayComplete').lean();
  if (!round) throw httpError(404, 'Round not found');
  if (round.isDayComplete || !canAccessRoundResources(round)) throw httpError(403, 'Round resources for a completed day are available in Central Resources.');
  const resources = await Resource.find({ round: round._id }).sort('createdAt').select('-storedName').lean();
  res.json({ round, resources });
}));

r.get('/tasks/:id/hint', h(async (req, res) => {
  const member = await Member.findById(req.user.id).select('team').lean();
  const task = await Task.findById(req.params.id).lean();
  if (!task) throw httpError(404, 'Task not found');
  await ensureRoundOpen(task.round);
  const access = await HintAccess.findOne({ member: req.user.id, task: task._id }).lean();
  if (!access || access.status !== 'available') {
    throw httpError(403, 'Hint is not available for this member');
  }
  if (!task.hintEnabled || !task.hint) throw httpError(404, 'No hint is configured for this task');
  await HintAccess.findByIdAndUpdate(access._id, { status: 'used', usedAt: new Date(), viewCount: (access.viewCount || 0) + 1 });
  await HintUsage.findOneAndUpdate(
    { member: req.user.id, task: task._id },
    { member: req.user.id, team: member.team, round: task.round, task: task._id, used: true, usedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await HintAudit.create({ admin: access.grantedBy || req.user.id, member: req.user.id, team: member.team, round: task.round, task: task._id, action: 'hint_used', message: 'Member viewed and used hint' });
  res.json({ hint: task.hint, used: true, usedAt: new Date() });
}));

r.get('/tasks/:id/hint-status', h(async (req, res) => {
  const member = await Member.findById(req.user.id).select('team').lean();
  const task = await Task.findById(req.params.id).lean();
  if (!task) throw httpError(404, 'Task not found');
  await ensureRoundOpen(task.round);
  const access = await HintAccess.findOne({ member: req.user.id, task: task._id }).lean();
  if (!task.hintEnabled) return res.json({ status: 'not_available', hint: null });
  const status = access?.status || 'not_available';
  res.json({ status, hint: status === 'used' || status === 'available' ? task.hint : null, used: status === 'used' });
}));

// =========================================================
// PROJECT SHOWCASE (read-only)
// =========================================================
// Mirrors the team account's /student/projects feed: a member only ever
// gets back Completed projects from other teams, plus every project
// belonging to their own team (any status). Members don't own the team
// account, so there is no create/edit/delete here — only the owning
// `team` account (or an admin) manages a project's content.
r.get('/projects', h(async (req, res) => {
  const member = await Member.findById(req.user.id).select('team').lean();
  if (!member) throw httpError(401, 'Member account no longer exists');
  const { q = '', tech = '', status = '' } = req.query;
  const filter = buildProjectVisibilityFilter({ q, tech, status, ownTeamId: member.team });
  const [projects, teams] = await Promise.all([
    Project.find(filter).sort({ createdAt: -1 }).lean(),
    Team.find().select('_id name').lean(),
  ]);
  const teamNameById = new Map(teams.map((t) => [String(t._id), t.name]));
  res.json(projects.map((p) => serializeProject(p, teamNameById)));
}));

export default r;
