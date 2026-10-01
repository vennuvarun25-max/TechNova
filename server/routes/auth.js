import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Admin, AdminHistory, Team, Member, TeamMember } from '../models/index.js';
import { auth, signToken } from '../middleware/auth.js';
import { h, httpError } from '../utils/helpers.js';

const r = Router();
const CI = { locale: 'en', strength: 2 }; // case-insensitive team names

async function recordAdminLogin(admin) {
  await AdminHistory.create({ admin: admin._id, action: 'Admin login', detail: `${admin.username} logged in` });
}

r.post('/admin-login', h(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) throw httpError(400, 'Username and password are required');
  const admin = await Admin.findOne({ username: String(username).trim() });
  if (!admin || !(await bcrypt.compare(String(password), admin.passwordHash))) {
    throw httpError(401, 'Invalid username or password');
  }
  await recordAdminLogin(admin);
  res.json({ token: signToken({ id: admin._id, role: 'admin' }), user: { role: 'admin', name: admin.username } });
}));

r.post('/admin-login/hidden', h(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) throw httpError(400, 'Username and password are required');
  const admin = await Admin.findOne({ username: String(username).trim() });
  if (!admin || !(await bcrypt.compare(String(password), admin.passwordHash))) {
    throw httpError(401, 'Invalid username or password');
  }
  await recordAdminLogin(admin);
  res.json({ token: signToken({ id: admin._id, role: 'admin' }), user: { role: 'admin', name: admin.username } });
}));

r.post('/team-login', h(async (req, res) => {
  const { teamId, teamName, password } = req.body;
  const rawTeamId = String(teamId ?? teamName ?? '').trim();
  if (!rawTeamId || !password) throw httpError(400, 'Team name/ID and password are required');

  let team = null;
  if (rawTeamId.length === 24) {
    team = await Team.findById(rawTeamId);
  }
  if (!team) {
    team = await Team.findOne({ $or: [{ teamId: rawTeamId }, { name: rawTeamId }] }).collation(CI);
  }

  if (!team || !(await bcrypt.compare(String(password), team.passwordHash))) {
    throw httpError(401, 'Invalid team ID/name or password');
  }

  res.json({
    token: signToken({ id: team._id, role: 'team' }),
    user: { role: 'team', name: team.name },
  });
}));

r.post('/team-logout', auth, h(async (req, res) => {
  if (req.user.role !== 'team') return res.json({ ok: true });
  res.json({ ok: true });
}));

r.post('/member-login', h(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) throw httpError(400, 'Username and password are required');
  const member = await Member.findOne({ username: String(username).trim().toLowerCase() });
  if (!member || !member.isActive || !(await bcrypt.compare(String(password), member.passwordHash))) {
    throw httpError(401, 'Invalid member username or password');
  }
  res.json({ token: signToken({ id: member._id, role: 'member' }), user: { role: 'member', name: member.fullName } });
}));

r.get('/me', auth, h(async (req, res) => {
  let doc;
  if (req.user.role === 'admin') doc = await Admin.findById(req.user.id);
  else if (req.user.role === 'team') doc = await Team.findById(req.user.id);
  else doc = await Member.findById(req.user.id).populate('team', 'name');
  if (!doc) throw httpError(401, 'Account no longer exists');
  const name = req.user.role === 'member' ? doc.fullName : (doc.username || doc.name);
  res.json({ user: { role: req.user.role, name } });
}));

export default r;
