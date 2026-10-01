import { Router } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { auth, requireRole } from '../middleware/auth.js';
import { AboutContent, AdminHistory, Team, TeamMember, Round, Task, Resource, CentralResource, Completion, XPRecord, Member, HintAccess, HintAudit, XPTransaction, Project } from '../models/index.js';
import { h, httpError, isHttpUrl } from '../utils/helpers.js';
import { upload, UPLOAD_DIR } from '../utils/uploads.js';
import { timerAction } from '../utils/timer.js';
import { serializeProject, buildProjectVisibilityFilter } from '../utils/projects.js';
import { IDENTITY_ROLES, normalizeTeamMemberRole } from '../utils/member-roles.js';
import { serializeAbout } from '../utils/about.js';

const r = Router();
r.use(auth, requireRole('admin'));

function describeAdminAction(req) {
  const path = req.path;
  const { tests, resources, locked, complete } = req.body || {};
  const dayMatch = path.match(/^\/round-days\/(Day%20\d+|Day\s\d+)\/(access|complete)$/i);
  const day = dayMatch ? decodeURIComponent(dayMatch[1]) : '';
  if (path === '/access' && typeof tests === 'boolean') return `${tests ? 'Opened' : 'Closed'} tests for selected teams`;
  if (path === '/access' && typeof resources === 'boolean') return `${resources ? 'Opened' : 'Closed'} resources for selected teams`;
  if (dayMatch?.[2] === 'access' && typeof locked === 'boolean') return `${locked ? 'Closed' : 'Opened'} tests for ${day}`;
  if (dayMatch?.[2] === 'complete' && typeof complete === 'boolean') return `${complete ? 'Completed' : 'Reopened'} ${day}`;
  if (/^\/rounds\/[^/]+\/access$/.test(path) && typeof locked === 'boolean') return `${locked ? 'Closed' : 'Opened'} tests for selected round`;
  const timerMatch = path.match(/^\/timer\/([a-z-]+)$/);
  if (timerMatch) return `Timer: ${timerMatch[1]}`;
  const method = { POST: 'Created', PUT: 'Updated', PATCH: 'Updated', DELETE: 'Deleted' }[req.method] || req.method;
  const section = path.split('/').filter(Boolean)[0] || 'admin settings';
  return `${method} ${section}`;
}

r.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    AdminHistory.create({ admin: req.user.id, action: describeAdminAction(req), detail: `${req.method} ${req.path}` })
      .catch((error) => console.error('Failed to record admin history:', error.message));
  });
  next();
});

r.get('/history', h(async (req, res) => {
  const filter = {};
  const start = new Date(req.query.start);
  const end = new Date(req.query.end);
  if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start < end) {
    filter.createdAt = { $gte: start, $lt: end };
  }
  const events = await AdminHistory.find(filter).populate('admin', 'username').sort({ createdAt: -1 }).limit(500).lean();
  res.json(events.map((event) => ({
    id: event._id,
    action: event.action,
    detail: event.detail,
    admin: event.admin?.username || 'Unknown admin',
    timestamp: event.createdAt,
  })));
}));

const sortRounds = { order: 1, createdAt: 1 };
const sameId = (a, b) => String(a) === String(b);
const PROFILE_FIELDS = ['linkedinUrl', 'githubUrl', 'leetcodeUrl', 'kaggleUrl'];
const removeFile = (storedName) => storedName && fs.unlink(path.join(UPLOAD_DIR, storedName), () => {});

r.get('/about', h(async (req, res) => {
  res.json(serializeAbout(await AboutContent.findOne({ key: 'main' }).lean()));
}));

r.put('/about', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'leadImage0', maxCount: 1 },
  { name: 'leadImage1', maxCount: 1 },
  { name: 'coLeadImage0', maxCount: 1 },
  { name: 'coLeadImage1', maxCount: 1 },
  { name: 'coLeadImage2', maxCount: 1 },
]), h(async (req, res) => {
  const files = req.files || {};
  const uploadedFiles = Object.values(files).flat();
  const cleanUploadedFiles = () => uploadedFiles.forEach((file) => removeFile(file.filename));
  const fail = (message) => { cleanUploadedFiles(); throw httpError(400, message); };
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
  for (const file of uploadedFiles) {
    if (!imageExtensions.includes(path.extname(file.originalname).toLowerCase()) || !file.mimetype?.startsWith('image/')) {
      fail('Use PNG, JPG, or WebP images');
    }
  }

  let leads;
  let coLeads;
  try {
    leads = JSON.parse(req.body.leads || '[]');
    coLeads = JSON.parse(req.body.coLeads || '[]');
  } catch {
    fail('Leadership details are invalid');
  }
  if (!Array.isArray(leads) || leads.length !== 2) fail('Add exactly two TechNova leads');
  if (!Array.isArray(coLeads) || coLeads.length < 2 || coLeads.length > 3) fail('Add two or three TechNova co-leads');
  const current = await AboutContent.findOne({ key: 'main' }).lean();
  const cleanPeople = (people, group) => people.map((person, index) => {
    const leadPrefix = group === 'leads' ? 'leadImage' : 'coLeadImage';
    const oldPerson = current?.[group]?.[index];
    const imageFile = files[`${leadPrefix}${index}`]?.[0];
    const removePortrait = req.body[`remove${leadPrefix.charAt(0).toUpperCase()}${leadPrefix.slice(1)}${index}`] === 'true';
    return {
      name: String(person?.name || '').trim(),
      bio: String(person?.bio || '').trim(),
      imageUrl: imageFile ? `/uploads/${imageFile.filename}` : removePortrait ? '' : oldPerson?.imageUrl || '',
      imageFileName: imageFile ? imageFile.originalname : removePortrait ? '' : oldPerson?.imageFileName || '',
      imageStoredName: imageFile ? imageFile.filename : removePortrait ? '' : oldPerson?.imageStoredName || '',
    };
  });
  leads = cleanPeople(leads, 'leads');
  coLeads = cleanPeople(coLeads, 'coLeads');
  if ([...leads, ...coLeads].some((person) => !person.name)) fail('Enter a name for every lead and co-lead');

  const removeImage = req.body.removeImage === 'true';
  const coverFile = files.image?.[0];
  const updates = {
    title: String(req.body.title || '').trim() || 'About TechNova',
    introduction: String(req.body.introduction || '').trim(),
    leads,
    coLeads,
  };
  if (coverFile) {
    updates.imageUrl = `/uploads/${coverFile.filename}`;
    updates.imageFileName = coverFile.originalname;
    updates.storedName = coverFile.filename;
  } else if (removeImage) {
    updates.imageUrl = '';
    updates.imageFileName = '';
    updates.storedName = '';
  }

  try {
    const about = await AboutContent.findOneAndUpdate(
      { key: 'main' },
      { $set: updates, $setOnInsert: { key: 'main' } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    const oldFiles = [current?.storedName, ...(current?.leads || []).map((person) => person.imageStoredName), ...(current?.coLeads || []).map((person) => person.imageStoredName)].filter(Boolean);
    const retainedFiles = [about.storedName, ...(about.leads || []).map((person) => person.imageStoredName), ...(about.coLeads || []).map((person) => person.imageStoredName)].filter(Boolean);
    oldFiles.filter((storedName) => !retainedFiles.includes(storedName)).forEach(removeFile);
    res.json(serializeAbout(about));
  } catch (error) {
    cleanUploadedFiles();
    throw error;
  }
}));

async function generateRoadmapFromAI({ domain, focus, audience, goal }) {
  const safeDomain = String(domain || '').trim() || 'software engineering';
  const safeFocus = String(focus || '').trim();
  const safeAudience = String(audience || 'students').trim() || 'students';
  const safeGoal = String(goal || '').trim();

  const prompt = `Create a concise career guidance roadmap for ${safeDomain}. Focus: ${safeFocus || 'general growth'}. Audience: ${safeAudience}. Goal: ${safeGoal || 'help them become job-ready'}.
Return ONLY valid JSON with this exact shape:
{
  "title": "Roadmap title",
  "summary": "brief description",
  "steps": [
    {
      "title": "step title",
      "description": "step explanation",
      "resources": [
        { "title": "resource title", "type": "link", "url": "https://example.com", "description": "why it matters" }
      ]
    }
  ]
}
Make it realistic and step-wise, with 4 to 6 steps and at least 2 resources per step. Use normal URLs rather than placeholders.`;

  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0.7,
          messages: [
            { role: 'system', content: 'You create structured, practical career roadmaps in valid JSON.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed?.steps?.length) return parsed;
      }
    } catch {
      // ignore and fall back to local template
    }
  }

  const baseSteps = [
    {
      title: `Build the fundamentals of ${safeDomain}`,
      description: `Start by understanding the core concepts, tools, and workflows used in ${safeDomain}.`,
      resources: [
        { title: `Intro to ${safeDomain}`, type: 'link', url: `https://www.google.com/search?q=${encodeURIComponent(`${safeDomain} beginner roadmap`)}`, description: 'A beginner-friendly overview.' },
        { title: `${safeDomain} fundamentals`, type: 'link', url: `https://www.google.com/search?q=${encodeURIComponent(`${safeDomain} fundamentals tutorial`)}`, description: 'Study the foundational concepts.' },
      ],
    },
    {
      title: `Practice with guided projects`,
      description: `Apply what you learn through small projects that connect theory to real-world tasks.`,
      resources: [
        { title: `${safeDomain} project ideas`, type: 'link', url: `https://www.google.com/search?q=${encodeURIComponent(`${safeDomain} project ideas for beginners`)}`, description: 'Practice with realistic mini-projects.' },
        { title: `${safeDomain} learning path`, type: 'link', url: `https://www.google.com/search?q=${encodeURIComponent(`${safeDomain} learning path`)}`, description: 'Follow a structured learning flow.' },
      ],
    },
    {
      title: `Strengthen applied skills`,
      description: `Develop problem-solving and execution skills by working on realistic scenarios and case studies.`,
      resources: [
        { title: `${safeDomain} case studies`, type: 'link', url: `https://www.google.com/search?q=${encodeURIComponent(`${safeDomain} case studies`)}`, description: 'See examples of real-world work.' },
        { title: `${safeDomain} practice resources`, type: 'link', url: `https://www.google.com/search?q=${encodeURIComponent(`${safeDomain} practice exercises`)}`, description: 'Reinforce your understanding.' },
      ],
    },
    {
      title: `Prepare for portfolio and interview readiness`,
      description: `Document your work, sharpen communication, and get ready for hiring or internship opportunities.`,
      resources: [
        { title: `${safeDomain} portfolio guide`, type: 'link', url: `https://www.google.com/search?q=${encodeURIComponent(`${safeDomain} portfolio examples`)}`, description: 'Build a portfolio that demonstrates skill.' },
        { title: `${safeDomain} interview preparation`, type: 'link', url: `https://www.google.com/search?q=${encodeURIComponent(`${safeDomain} interview questions`)}`, description: 'Prepare for interviews and technical discussions.' },
      ],
    },
  ];

  return {
    title: `${safeDomain} roadmap`,
    summary: `${safeDomain} roadmap for ${safeAudience}${safeGoal ? ` focused on ${safeGoal}` : ''}.`,
    steps: baseSteps,
  };
}

/* ------------------------------ Stats ------------------------------ */
r.get('/stats', h(async (req, res) => {
  const [teams, rounds, tasks, pendingCompletions] = await Promise.all([
    Team.countDocuments(), Round.countDocuments(), Task.countDocuments(), Completion.countDocuments({ verified: false }),
  ]);

  const teamProfileIds = await TeamMember.find({
    $or: PROFILE_FIELDS.map((field) => ({ [field]: { $ne: '' } })),
  }).distinct('team');

  const teamProfileAwards = await XPTransaction.find({
    team: { $in: teamProfileIds },
    reason: /profile/i,
  }).distinct('team');

  const pendingProfiles = teamProfileIds.filter((teamId) => !teamProfileAwards.some((id) => String(id) === String(teamId))).length;
  res.json({ teams, rounds, tasks, pending: pendingCompletions + pendingProfiles });
}));

/* ------------------------------ Teams ------------------------------ */
function normalizeTeamMembers(raw) {
  const items = Array.isArray(raw) ? raw : [];
  const normalized = items.map((entry, index) => {
    if (typeof entry === 'string') {
      return { name: String(entry || '').trim(), role: IDENTITY_ROLES[index] };
    }
    const name = String(entry?.name || '').trim();
    const role = normalizeTeamMemberRole(entry?.role, index);
    return { name, role };
  }).filter((entry) => entry.name);

  if (!normalized.some((member) => member.role === IDENTITY_ROLES[0])) throw httpError(400, 'A team must include a VISION LEAD');
  if (new Set(normalized.map((member) => member.role)).size !== normalized.length) {
    throw httpError(400, 'Assign one person to each identity role');
  }
  return normalized;
}

async function setMembers(teamId, members) {
  const list = normalizeTeamMembers(members);
  await TeamMember.deleteMany({ team: teamId });
  await TeamMember.insertMany(list.map((m) => ({ team: teamId, name: m.name, role: m.role, isActive: true })));
}

function checkPassword(p) {
  if (!p || String(p).length < 4) throw httpError(400, 'Password must be at least 4 characters');
  return String(p);
}

r.get('/teams', h(async (req, res) => {
  const [teams, members, totals] = await Promise.all([
    Team.find().sort('name').select('-passwordHash').collation({ locale: 'en', strength: 2 }).lean(),
    TeamMember.find().sort('_id').lean(),
    XPRecord.aggregate([{ $group: { _id: '$team', xp: { $sum: '$points' } } }]),
  ]);
  const xpMap = new Map(totals.map((t) => [String(t._id), t.xp]));
  res.json(teams.map((t) => {
    const teamMembers = members.filter((m) => sameId(m.team, t._id));
    return {
      ...t,
      members: teamMembers.map((m) => m.name),
      membersDetail: teamMembers.map((m) => ({
        _id: m._id,
        name: m.name,
        role: normalizeTeamMemberRole(m.role, teamMembers.indexOf(m)),
        linkedinUrl: m.linkedinUrl || '',
        githubUrl: m.githubUrl || '',
        leetcodeUrl: m.leetcodeUrl || '',
        kaggleUrl: m.kaggleUrl || '',
      })),
      xp: xpMap.get(String(t._id)) || 0,
    };
  }));
}));

r.get('/members', h(async (req, res) => {
  const members = await Member.find().sort('fullName').populate('team', 'name').lean();
  res.json(members.map((m) => ({
    _id: m._id,
    fullName: m.fullName,
    memberId: m.memberId,
    username: m.username,
    team: m.team ? { _id: m.team._id, name: m.team.name } : null,
    role: m.role,
    isActive: m.isActive,
    individualXp: m.individualXp,
    hintsUsed: m.hintsUsed,
    problemsCompleted: m.problemsCompleted,
  })));
}));

r.post('/members', h(async (req, res) => {
  const { fullName, username, password, teamId, role } = req.body;
  if (!fullName || !String(fullName).trim()) throw httpError(400, 'Member full name is required');
  if (!username || !String(username).trim()) throw httpError(400, 'Member username is required');
  if (!teamId) throw httpError(400, 'Select a team for the member');
  const team = await Team.findById(teamId);
  if (!team) throw httpError(404, 'Team not found');
  const memberCount = await Member.countDocuments({ team: teamId, isActive: true });
  if (memberCount >= 3) throw httpError(400, 'A team can have at most 3 active members');
  const pwd = checkPassword(password);
  const safeUsername = String(username).trim().toLowerCase();
  const memberId = `MEM-${Date.now().toString().slice(-6)}`;
  if (await Member.findOne({ username: safeUsername })) throw httpError(409, 'That username is already in use');
  if (!IDENTITY_ROLES.includes(role)) throw httpError(400, 'Choose one of the identity roles');
  const validRole = role;
  if (await Member.countDocuments({ team: teamId, role: validRole, isActive: true })) {
    throw httpError(400, 'This identity role is already assigned in the team');
  }
  const member = await Member.create({
    team: team._id,
    teamName: team.name,
    fullName: String(fullName).trim(),
    memberId,
    username: safeUsername,
    passwordHash: await bcrypt.hash(pwd, 10),
    role: validRole,
    isActive: true,
  });
  res.status(201).json({ _id: member._id, memberId: member.memberId, username: member.username });
}));

r.post('/teams', h(async (req, res) => {
  const { name, teamId, password, members } = req.body;
  if (!name || !String(name).trim()) throw httpError(400, 'Team name is required');
  const pw = checkPassword(password);
  const list = normalizeTeamMembers(members);
  if (new Set(list.map((member) => member.role)).size !== list.length) throw httpError(400, 'Assign one person to each identity role');

  const generatedTeamId = String(teamId || `TNV-${Date.now().toString().slice(-6)}`).trim();
  if (await Team.findOne({ teamId: generatedTeamId })) throw httpError(409, 'That team ID is already in use');

  const team = await Team.create({ teamId: generatedTeamId, name: String(name).trim(), passwordHash: await bcrypt.hash(pw, 10) });
  await setMembers(team._id, list);
  res.status(201).json({ _id: team._id, teamId: team.teamId });
}));

r.put('/teams/:id', h(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw httpError(404, 'Team not found');
  const { name, teamId, password, members } = req.body;
  if (name !== undefined) {
    if (!String(name).trim()) throw httpError(400, 'Team name is required');
    team.name = String(name).trim();
  }
  if (teamId !== undefined && String(teamId).trim()) {
    const nextTeamId = String(teamId).trim();
    if (nextTeamId !== team.teamId && (await Team.findOne({ teamId: nextTeamId }))) {
      throw httpError(409, 'That team ID is already in use');
    }
    team.teamId = nextTeamId;
  }
  if (password) team.passwordHash = await bcrypt.hash(checkPassword(password), 10);
  const list = members !== undefined ? normalizeTeamMembers(members) : null;
  await team.save();
  if (list) await setMembers(team._id, list);
  res.json({ ok: true });
}));

r.delete('/teams/:id', h(async (req, res) => {
  const id = req.params.id;
  await Promise.all([
    Completion.deleteMany({ team: id }), XPRecord.deleteMany({ team: id }), TeamMember.deleteMany({ team: id }),
    Project.deleteMany({ team: id }),
  ]);
  await Team.findByIdAndDelete(id);
  res.json({ ok: true });
}));

// Open / close the Tests and Resources sections for selected teams (or all teams)
r.put('/access', h(async (req, res) => {
  const { teamIds, tests, resources } = req.body;
  const set = {};
  if (typeof tests === 'boolean') set.testsEnabled = tests;
  if (typeof resources === 'boolean') set.resourcesEnabled = resources;
  if (!Object.keys(set).length) throw httpError(400, 'Nothing to change');
  let filter;
  if (teamIds === 'all') filter = {};
  else if (Array.isArray(teamIds) && teamIds.length) filter = { _id: { $in: teamIds } };
  else throw httpError(400, 'Select at least one team');
  const result = await Team.updateMany(filter, { $set: set });
  res.json({ updated: result.matchedCount });
}));

r.put('/round-days/:day/access', h(async (req, res) => {
  const day = decodeURIComponent(req.params.day);
  const { locked } = req.body;
  if (!/^Day ([1-9]|10)$/.test(day)) throw httpError(400, 'Invalid round day');
  if (typeof locked !== 'boolean') throw httpError(400, 'Locked must be a boolean');
  const result = await Round.updateMany({ day }, { $set: { isLocked: locked } });
  res.json({ updated: result.matchedCount });
}));

r.put('/round-days/:day/complete', h(async (req, res) => {
  const day = decodeURIComponent(req.params.day);
  const { complete } = req.body;
  if (!/^Day ([1-9]|10)$/.test(day)) throw httpError(400, 'Invalid round day');
  if (typeof complete !== 'boolean') throw httpError(400, 'Complete must be a boolean');
  const set = { isDayComplete: complete };
  if (complete) set.isLocked = true;
  const result = await Round.updateMany({ day }, { $set: set });
  res.json({ updated: result.matchedCount });
}));

// Progress of one team: every task with completion / verification state
r.get('/teams/:id/progress', h(async (req, res) => {
  const team = await Team.findById(req.params.id).select('teamId name').lean();
  if (!team) throw httpError(404, 'Team not found');

  const [teamMembers, rounds, tasks, completions, xps, txns, allTeams] = await Promise.all([
    TeamMember.find({ team: team._id }).sort('name').lean(),
    Round.find().sort(sortRounds).lean(),
    Task.find().sort(sortRounds).lean(),
    Completion.find({ team: team._id }).lean(),
    XPRecord.find({ team: team._id }).lean(),
    XPTransaction.find({ team: team._id }).lean(),
    Team.find().select('_id teamId name').lean(),
  ]);

  const roster = teamMembers.map((member) => ({
    _id: member._id,
    fullName: member.name,
    memberId: '—',
    role: normalizeTeamMemberRole(member.role, teamMembers.indexOf(member)),
    linkedinUrl: member.linkedinUrl || '',
    githubUrl: member.githubUrl || '',
    leetcodeUrl: member.leetcodeUrl || '',
    kaggleUrl: member.kaggleUrl || '',
  }));

  const cMap = new Map(completions.map((c) => [String(c.task), c]));
  const xMap = new Map(xps.map((x) => [String(x.task), x]));
  const totalTeamXp = xps.reduce((sum, x) => sum + (x.points || 0), 0) + txns.reduce((sum, x) => sum + (x.amount || 0), 0);

  const teamTotals = await Promise.all(allTeams.map(async (t) => {
    const [recordTotal, txnTotal] = await Promise.all([
      XPRecord.aggregate([{ $match: { team: t._id } }, { $group: { _id: null, total: { $sum: '$points' } } }]),
      XPTransaction.aggregate([{ $match: { team: t._id } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);
    return { ...t, xp: (recordTotal[0]?.total || 0) + (txnTotal[0]?.total || 0) };
  }));
  const ranked = teamTotals.sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
  const rank = ranked.findIndex((entry) => String(entry._id) === String(team._id)) + 1;

  res.json({
    team: {
      _id: team._id,
      teamId: team.teamId,
      name: team.name,
      xp: totalTeamXp,
      rank,
      members: roster,
    },
    rounds: rounds.map((rd) => ({
      _id: rd._id,
      name: rd.name,
      tasks: tasks.filter((t) => sameId(t.round, rd._id)).map((t) => {
        const c = cMap.get(String(t._id));
        return {
          _id: t._id, title: t.title, completed: !!c, verified: !!c?.verified,
          completedAt: c?.completedAt || null, points: xMap.get(String(t._id))?.points ?? null,
        };
      }),
    })),
  });
}));

/* ------------------------------ Rounds ------------------------------ */
const ROUND_DAYS = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'];

function roundBody(b) {
  if (!b.name || !String(b.name).trim()) throw httpError(400, 'Round name is required');
  const day = String(b.day || 'Day 1').trim();
  const normalizedDay = ROUND_DAYS.includes(day) ? day : 'Day 1';
  return {
    name: String(b.name).trim(),
    description: String(b.description || ''),
    instructions: String(b.instructions || ''),
    day: normalizedDay,
    dayOrder: ROUND_DAYS.indexOf(normalizedDay) + 1,
    order: Number.isFinite(Number(b.order)) ? Number(b.order) : 0,
  };
}

r.get('/rounds', h(async (req, res) => {
  const [rounds, tasks, resources] = await Promise.all([
    Round.find().sort({ dayOrder: 1, order: 1, createdAt: 1 }).lean(), Task.find().select('round').lean(), Resource.find().select('round').lean(),
  ]);
  res.json(rounds.map((rd) => ({
    ...rd,
    taskCount: tasks.filter((t) => sameId(t.round, rd._id)).length,
    resourceCount: resources.filter((x) => sameId(x.round, rd._id)).length,
  })));
}));

r.put('/rounds/:id/access', h(async (req, res) => {
  const { locked } = req.body;
  if (typeof locked !== 'boolean') throw httpError(400, 'Locked must be a boolean');
  const round = await Round.findByIdAndUpdate(req.params.id, { $set: { isLocked: locked } }, { new: true });
  if (!round) throw httpError(404, 'Round not found');
  res.json({ isLocked: round.isLocked });
}));

r.post('/rounds', h(async (req, res) => {
  const round = await Round.create(roundBody(req.body));
  res.status(201).json(round);
}));

r.get('/rounds/:id', h(async (req, res) => {
  const round = await Round.findById(req.params.id).lean();
  if (!round) throw httpError(404, 'Round not found');
  const [tasks, resources] = await Promise.all([
    Task.find({ round: round._id }).sort(sortRounds).lean(),
    Resource.find({ round: round._id }).sort('createdAt').lean(),
  ]);
  res.json({ round, tasks, resources });
}));

r.put('/rounds/:id', h(async (req, res) => {
  const round = await Round.findByIdAndUpdate(req.params.id, roundBody(req.body), { new: true });
  if (!round) throw httpError(404, 'Round not found');
  res.json(round);
}));

r.delete('/rounds/:id', h(async (req, res) => {
  const id = req.params.id;
  const [tasks, resources] = await Promise.all([Task.find({ round: id }).select('_id'), Resource.find({ round: id })]);
  resources.forEach((x) => removeFile(x.storedName));
  await Promise.all([
    XPRecord.deleteMany({ task: { $in: tasks.map((t) => t._id) } }),
    Completion.deleteMany({ round: id }),
    Task.deleteMany({ round: id }),
    Resource.deleteMany({ round: id }),
  ]);
  await Round.findByIdAndDelete(id);
  res.json({ ok: true });
}));

/* ------------------------------ Tasks ------------------------------ */
function taskBody(b) {
  if (!b.title || !String(b.title).trim()) throw httpError(400, 'Task title is required');
  const link = String(b.link || '').trim();
  if (link && !isHttpUrl(link)) throw httpError(400, 'Problem link must start with http:// or https://');
  const hint = String(b.hint || '').trim();
  const hintPenaltyXp = Number(b.hintPenaltyXp ?? 0);
  return {
    title: String(b.title).trim(),
    description: String(b.description || ''),
    link,
    hint,
    hintEnabled: !!b.hintEnabled,
    hintPenaltyXp: Number.isFinite(hintPenaltyXp) ? Math.max(0, hintPenaltyXp) : 0,
  };
}

r.post('/rounds/:roundId/tasks', h(async (req, res) => {
  const round = await Round.findById(req.params.roundId);
  if (!round) throw httpError(404, 'Round not found');
  const count = await Task.countDocuments({ round: round._id });
  const task = await Task.create({ ...taskBody(req.body), round: round._id, order: count });
  res.status(201).json(task);
}));

r.put('/tasks/:id', h(async (req, res) => {
  const task = await Task.findByIdAndUpdate(req.params.id, taskBody(req.body), { new: true });
  if (!task) throw httpError(404, 'Task not found');
  res.json(task);
}));

r.get('/tasks/:id/hints', h(async (req, res) => {
  const task = await Task.findById(req.params.id).populate('round', 'name').lean();
  if (!task) throw httpError(404, 'Task not found');
  const members = await Member.find().select('team fullName role memberId').lean();
  const teamIds = [...new Set(members.map((m) => String(m.team)))];
  const access = await HintAccess.find({ task: task._id }).lean();
  const map = new Map(access.map((entry) => [String(entry.member), entry]));
  res.json({
    task: { _id: task._id, title: task.title, round: task.round?.name, hint: task.hint, hintEnabled: task.hintEnabled, hintPenaltyXp: task.hintPenaltyXp },
    members: members.map((m) => ({
      _id: m._id,
      teamId: m.team,
      name: m.fullName,
      role: m.role,
      memberId: m.memberId,
      status: map.get(String(m._id))?.status || 'not_available',
      grantedAt: map.get(String(m._id))?.grantedAt || null,
      usedAt: map.get(String(m._id))?.usedAt || null,
    })),
    teams: teamIds.map((teamId) => ({
      teamId,
      memberCount: members.filter((m) => String(m.team) === String(teamId)).length,
    })),
  });
}));

r.post('/tasks/:id/hints/grant', h(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw httpError(404, 'Task not found');
  const { memberId, teamId, mode = 'member' } = req.body;
  const memberIds = [];
  if (mode === 'member' && memberId) memberIds.push(memberId);
  if (mode === 'team' && teamId) {
    const m = await Member.find({ team: teamId }).select('_id').lean();
    memberIds.push(...m.map((x) => String(x._id)));
  }
  if (!memberIds.length) throw httpError(400, 'Select a member or team to grant a hint');
  const updates = [];
  for (const member of memberIds) {
    const doc = await HintAccess.findOneAndUpdate(
      { member, task: task._id },
      { member, team: (await Member.findById(member).select('team').lean())?.team || null, round: task.round, task: task._id, status: 'available', grantedBy: req.user.id, grantedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    updates.push(doc);
    await HintAudit.create({ admin: req.user.id, member: doc.member, team: doc.team, round: doc.round, task: doc.task, action: 'hint_provided', message: 'Hint granted to member' });
  }
  res.json({ ok: true, count: updates.length });
}));

r.post('/tasks/:id/hints/revoke', h(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw httpError(404, 'Task not found');
  const { memberId, teamId } = req.body;
  const memberIds = [];
  if (memberId) memberIds.push(memberId);
  if (teamId) {
    const members = await Member.find({ team: teamId }).select('_id').lean();
    memberIds.push(...members.map((x) => String(x._id)));
  }
  if (!memberIds.length) throw httpError(400, 'Select a member or team to revoke');
  const ids = [...new Set(memberIds)];
  for (const member of ids) {
    const doc = await HintAccess.findOne({ member, task: task._id });
    if (doc) {
      doc.status = 'not_available';
      doc.grantedAt = null;
      doc.usedAt = null;
      await doc.save();
      await HintAudit.create({ admin: req.user.id, member: doc.member, team: doc.team, round: doc.round, task: doc.task, action: 'hint_revoked', message: 'Hint revoked' });
    }
  }
  res.json({ ok: true, count: ids.length });
}));

r.delete('/tasks/:id', h(async (req, res) => {
  await Promise.all([Completion.deleteMany({ task: req.params.id }), XPRecord.deleteMany({ task: req.params.id })]);
  await Task.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

/* ------------------------------ Resources ------------------------------ */
r.get('/central-resources', h(async (req, res) => {
  const [central, completedRounds] = await Promise.all([
    CentralResource.find().sort({ category: 1, createdAt: -1 }).lean(),
    Round.find({ isDayComplete: true }).select('_id name day').lean(),
  ]);
  const roundResources = await Resource.find({ round: { $in: completedRounds.map((round) => round._id) } })
    .sort({ createdAt: -1 }).lean();
  const roundById = new Map(completedRounds.map((round) => [String(round._id), round]));
  res.json([
    ...central.map((resource) => ({ ...resource, source: 'central' })),
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

r.post('/central-resources', upload.single('file'), h(async (req, res) => {
  const file = req.file;
  const fail = (msg) => { if (file) removeFile(file.filename); throw httpError(400, msg); };
  const { type, category } = req.body;
  const url = String(req.body.url || '').trim();
  const problemUrl = String(req.body.problemUrl || '').trim();
  const description = String(req.body.description || '').trim();
  const title = String(req.body.title || '').trim();
  if (!['pdf', 'document', 'link'].includes(type)) fail('Choose a resource type');
  if (!['test', 'shared'].includes(category)) fail('Choose Test or Shared resources');
  if (problemUrl && !isHttpUrl(problemUrl)) fail('Problem link must start with http:// or https://');

  let doc;
  if (type === 'link') {
    if (!isHttpUrl(url)) fail('Enter a valid link starting with http:// or https://');
    doc = { url, type, title: title || url };
  } else {
    if (!file) fail('Choose a file to upload');
    if (type === 'pdf' && path.extname(file.originalname).toLowerCase() !== '.pdf') fail('The file must be a PDF');
    doc = { url: `/uploads/${file.filename}`, type, title: title || file.originalname, fileName: file.originalname, storedName: file.filename };
  }
  const resource = await CentralResource.create({ ...doc, category, description, problemUrl, isReleased: category === 'shared' });
  res.status(201).json(resource);
}));

r.put('/central-resources/:id/access', h(async (req, res) => {
  const { isReleased } = req.body;
  if (typeof isReleased !== 'boolean') throw httpError(400, 'Release state must be a boolean');
  const resource = await CentralResource.findById(req.params.id);
  if (!resource) throw httpError(404, 'Central resource not found');
  if (resource.category !== 'test') throw httpError(400, 'Only Test Resources can be locked or released');
  resource.isReleased = isReleased;
  await resource.save();
  res.json({ isReleased: resource.isReleased });
}));

r.delete('/central-resources/:id', h(async (req, res) => {
  const resource = await CentralResource.findByIdAndDelete(req.params.id) || await Resource.findByIdAndDelete(req.params.id);
  if (!resource) throw httpError(404, 'Central resource not found');
  removeFile(resource.storedName);
  res.json({ ok: true });
}));

r.post('/rounds/:roundId/resources', upload.single('file'), h(async (req, res) => {
  const file = req.file;
  const fail = (msg) => { if (file) removeFile(file.filename); throw httpError(400, msg); };
  const round = await Round.findById(req.params.roundId);
  if (!round) fail('Round not found');
  const { type } = req.body;
  const url = String(req.body.url || '').trim();
  let title = String(req.body.title || '').trim();
  if (!['pdf', 'document', 'link'].includes(type)) fail('Choose a resource type');

  let doc;
  if (type === 'link') {
    if (!isHttpUrl(url)) fail('Enter a valid link starting with http:// or https://');
    doc = { url, type, title: title || url };
  } else {
    if (!file) fail('Choose a file to upload');
    if (type === 'pdf' && path.extname(file.originalname).toLowerCase() !== '.pdf') fail('The file must be a PDF');
    doc = { url: `/uploads/${file.filename}`, type, title: title || file.originalname, fileName: file.originalname, storedName: file.filename };
  }
  res.status(201).json(await Resource.create({ ...doc, round: round._id }));
}));

r.post('/rounds/:roundId/resources/ai-roadmap', h(async (req, res) => {
  const round = await Round.findById(req.params.roundId);
  if (!round) throw httpError(404, 'Round not found');

  const domain = String(req.body?.domain || '').trim();
  const focus = String(req.body?.focus || '').trim();
  const audience = String(req.body?.audience || 'students').trim() || 'students';
  const goal = String(req.body?.goal || '').trim();

  if (!domain) throw httpError(400, 'Domain is required for the AI roadmap');

  const roadmap = await generateRoadmapFromAI({ domain, focus, audience, goal });
  const created = [];

  for (const step of roadmap.steps || []) {
    for (const resource of step.resources || []) {
      const finalUrl = String(resource.url || '').trim();
      if (!finalUrl) continue;
      created.push(await Resource.create({
        round: round._id,
        title: String(resource.title || step.title || 'Resource').trim(),
        type: 'link',
        url: finalUrl,
      }));
    }
  }

  res.status(201).json({
    roadmap,
    added: created.length,
    round: { _id: round._id, name: round.name },
  });
}));

r.delete('/resources/:id', h(async (req, res) => {
  const doc = await Resource.findByIdAndDelete(req.params.id);
  if (doc) removeFile(doc.storedName);
  res.json({ ok: true });
}));

/* ------------------------------ Verification & XP ------------------------------ */
r.get('/completions', h(async (req, res) => {
  const q = {};
  if (req.query.team) q.team = req.query.team;
  if (req.query.status === 'pending') q.verified = false;
  if (req.query.status === 'verified') q.verified = true;
  const list = await Completion.find(q).sort({ completedAt: -1 })
    .populate('team', 'name').populate('task', 'title').populate('round', 'name').lean();
  const xps = await XPRecord.find({ completion: { $in: list.map((c) => c._id) } }).lean();
  const xMap = new Map(xps.map((x) => [String(x.completion), x.points]));
  const profileLinks = await TeamMember.find({
    $or: PROFILE_FIELDS.map((field) => ({ [field]: { $ne: '' } })),
  }).populate('team', 'name').lean();

  const profileAwardTeams = await XPTransaction.find({ reason: /profile/i }).distinct('team');
  const profileMap = new Map();
  for (const member of profileLinks) {
    const teamId = String(member.team?._id || '');
    if (!teamId) continue;
    if (!profileMap.has(teamId)) {
      profileMap.set(teamId, {
        team: member.team?.name || 'Team',
        teamId,
        round: 'Profile links',
        task: 'Team profile links',
        completedAt: member.profileCompletedAt || new Date(),
        verified: false,
        points: null,
        type: 'profile-link',
      });
    }
    const current = profileMap.get(teamId);
    if (member.profileCompletedAt && new Date(member.profileCompletedAt) > new Date(current.completedAt)) {
      current.completedAt = member.profileCompletedAt;
    }
  }

  const profileRecords = [...profileMap.values()].map((record) => ({
    ...record,
    verified: profileAwardTeams.some((teamId) => String(teamId) === String(record.teamId)),
    points: profileAwardTeams.some((teamId) => String(teamId) === String(record.teamId)) ? 10 : null,
  }));

  const completionRecords = list.filter((c) => c.team && c.task && c.round).map((c) => ({
    _id: c._id, team: c.team.name, teamId: c.team._id, round: c.round.name, task: c.task.title,
    completedAt: c.completedAt, verified: c.verified, points: xMap.get(String(c._id)) ?? null,
    type: 'completion',
  }));

  if (req.query.team) {
    const teamId = String(req.query.team);
    const filtered = [...completionRecords, ...profileRecords].filter((item) => String(item.teamId) === teamId);
    return res.json(filtered);
  }

  res.json([...completionRecords, ...profileRecords]);
}));

function readPoints(body) {
  const raw = body && body.points !== undefined ? body.points : 10;
  const points = Number(raw);
  if (!Number.isFinite(points) || points < 0) {
    return 10;
  }
  return points;
}

r.post('/completions/profile/:teamId/verify', h(async (req, res) => {
  const teamId = req.params.teamId;

  const existing = await XPTransaction.findOne({ team: teamId, reason: /profile/i });
  if (existing) {
    return res.json({ ok: true, alreadyVerified: true, points: 10 });
  }

  await XPTransaction.create({
    transactionId: `PROFILE-${String(teamId)}-${Date.now()}`,
    team: teamId,
    amount: 10,
    type: 'award',
    reason: 'Profile link approval for team',
  });

  res.json({ ok: true, points: 10 });
}));

r.post('/completions/profile/:teamId/unverify', h(async (req, res) => {
  const teamId = req.params.teamId;
  await XPTransaction.deleteMany({ team: teamId, reason: /profile/i });
  res.json({ ok: true });
}));

// Verify a completed task and award XP manually
r.post('/completions/:id/verify', h(async (req, res) => {
  const points = readPoints(req.body);
  const c = await Completion.findById(req.params.id);
  if (!c) throw httpError(404, 'Completion not found');
  c.verified = true;
  c.verifiedAt = new Date();
  await c.save();
  await XPRecord.findOneAndUpdate(
    { team: c.team, task: c.task }, { completion: c._id, points }, { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json({ ok: true });
}));

// Edit XP for an already verified task
r.put('/completions/:id/xp', h(async (req, res) => {
  const points = readPoints(req.body);
  const c = await Completion.findById(req.params.id);
  if (!c) throw httpError(404, 'Completion not found');
  if (!c.verified) throw httpError(400, 'Verify the task first');
  await XPRecord.findOneAndUpdate({ team: c.team, task: c.task }, { completion: c._id, points }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json({ ok: true });
}));

// Reopen a verified task for student resubmission (removes its XP and completion).
r.post('/completions/:id/unverify', h(async (req, res) => {
  const c = await Completion.findById(req.params.id);
  if (!c) throw httpError(404, 'Completion not found');
  if (!c.verified) throw httpError(400, 'Task is not verified');
  await Promise.all([
    Completion.deleteOne({ _id: c._id }),
    XPRecord.deleteMany({ team: c.team, task: c.task }),
  ]);
  res.json({ ok: true, reopened: true });
}));

/* --------------------------- Project Showcase --------------------------- */
// Admins can see every project regardless of team or status (enforced here,
// not just in the UI). Same optional search/filter params as the team view.
r.get('/projects', h(async (req, res) => {
  const { q = '', tech = '', status = '' } = req.query;
  const filter = buildProjectVisibilityFilter({ q, tech, status, seeAll: true });
  const [projects, teams] = await Promise.all([
    Project.find(filter).sort({ createdAt: -1 }).lean(),
    Team.find().select('_id name').lean(),
  ]);
  const teamNameById = new Map(teams.map((t) => [String(t._id), t.name]));
  res.json(projects.map((p) => serializeProject(p, teamNameById)));
}));

/* ------------------------------ Timer ------------------------------ */
// actions: duration (body.minutes), start, pause, resume, reset, autolock (body.enabled)
r.post('/timer/:action', h(async (req, res) => {
  res.json(await timerAction(req.params.action, req.body));
}));

export default r;
