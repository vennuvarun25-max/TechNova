import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { Roadmap, RoadmapAccess, Team } from '../models/index.js';
import { h, httpError } from '../utils/helpers.js';
import { computeRoadmapAccess } from '../utils/roadmap.js';

const r = Router();

r.get('/public', h(async (req, res) => {
  const roadmaps = await Roadmap.find().sort({ createdAt: -1 }).lean();
  res.json({ roadmaps });
}));

r.use(auth);

r.get('/all', h(async (req, res) => {
  if (req.user.role !== 'admin') throw httpError(403, 'Only admins can view all roadmaps');
  const [roadmaps, accessList] = await Promise.all([
    Roadmap.find().sort({ createdAt: -1 }).lean(),
    RoadmapAccess.find().populate('team', 'name teamId').lean(),
  ]);

  res.json({
    roadmaps: roadmaps.map((roadmap) => ({
      ...roadmap,
      access: accessList.filter((entry) => String(entry.roadmap) === String(roadmap._id)).map((entry) => ({
        _id: entry._id,
        team: entry.team ? { _id: entry.team._id, name: entry.team.name, teamId: entry.team.teamId } : null,
        isGranted: !!entry.isGranted,
        grantedBy: entry.grantedBy || null,
        message: entry.message || '',
      })),
    })),
  });
}));

r.get('/me', h(async (req, res) => {
  if (req.user.role !== 'team') throw httpError(403, 'Only teams can access this route');
  const teamId = req.user.id;
  const [roadmaps, accessList] = await Promise.all([
    Roadmap.find().sort({ createdAt: -1 }).lean(),
    RoadmapAccess.find({ team: teamId }).lean(),
  ]);

  const teamRoadmaps = roadmaps.map((roadmap) => {
    const access = computeRoadmapAccess({ roadmap, access: accessList.filter((entry) => String(entry.roadmap) === String(roadmap._id)), user: { id: teamId, role: 'team' } });
    return {
      ...roadmap,
      access: access.allowed,
      reason: access.reason,
    };
  });

  res.json({ roadmaps: teamRoadmaps });
}));

r.post('/', h(async (req, res) => {
  if (req.user.role !== 'admin') throw httpError(403, 'Only admins can create roadmaps');
  const { domain, title, description, isLocked, steps } = req.body || {};
  if (!domain || !String(domain).trim()) throw httpError(400, 'Domain is required');
  if (!title || !String(title).trim()) throw httpError(400, 'Title is required');
  if (!Array.isArray(steps) || steps.length === 0) throw httpError(400, 'At least one roadmap step is required');

  const roadmap = await Roadmap.create({
    domain: String(domain).trim(),
    title: String(title).trim(),
    description: String(description || ''),
    isLocked: !!isLocked,
    steps: steps.map((step) => ({
      title: String(step.title || '').trim(),
      description: String(step.description || ''),
      resources: Array.isArray(step.resources) ? step.resources.map((resource) => ({
        title: String(resource.title || '').trim(),
        type: ['link', 'pdf', 'document'].includes(resource.type) ? resource.type : 'link',
        url: String(resource.url || '').trim(),
        description: String(resource.description || ''),
      })).filter((resource) => resource.title && resource.url) : [],
    })).filter((step) => step.title),
    createdBy: req.user.id,
  });

  res.status(201).json({ roadmap });
}));

r.put('/:id', h(async (req, res) => {
  if (req.user.role !== 'admin') throw httpError(403, 'Only admins can update roadmaps');
  const roadmap = await Roadmap.findById(req.params.id);
  if (!roadmap) throw httpError(404, 'Roadmap not found');

  const { domain, title, description, isLocked, steps } = req.body || {};
  if (domain !== undefined) roadmap.domain = String(domain).trim();
  if (title !== undefined) roadmap.title = String(title).trim();
  if (description !== undefined) roadmap.description = String(description || '');
  if (typeof isLocked === 'boolean') roadmap.isLocked = isLocked;
  if (steps !== undefined) {
    roadmap.steps = steps.map((step) => ({
      title: String(step.title || '').trim(),
      description: String(step.description || ''),
      resources: Array.isArray(step.resources) ? step.resources.map((resource) => ({
        title: String(resource.title || '').trim(),
        type: ['link', 'pdf', 'document'].includes(resource.type) ? resource.type : 'link',
        url: String(resource.url || '').trim(),
        description: String(resource.description || ''),
      })).filter((resource) => resource.title && resource.url) : [],
    })).filter((step) => step.title);
  }

  await roadmap.save();
  res.json({ roadmap });
}));

r.delete('/:id', h(async (req, res) => {
  if (req.user.role !== 'admin') throw httpError(403, 'Only admins can delete roadmaps');
  await RoadmapAccess.deleteMany({ roadmap: req.params.id });
  await Roadmap.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

r.post('/:id/access', h(async (req, res) => {
  if (req.user.role !== 'admin') throw httpError(403, 'Only admins can manage roadmap access');
  const roadmap = await Roadmap.findById(req.params.id);
  if (!roadmap) throw httpError(404, 'Roadmap not found');

  const { teamId, isGranted, message } = req.body || {};
  if (!teamId) throw httpError(400, 'Team is required');
  const team = await Team.findById(teamId);
  if (!team) throw httpError(404, 'Team not found');

  const access = await RoadmapAccess.findOneAndUpdate(
    { roadmap: roadmap._id, team: team._id },
    {
      roadmap: roadmap._id,
      team: team._id,
      isGranted: !!isGranted,
      grantedBy: req.user.id,
      message: String(message || ''),
    },
    { upsert: true, new: true }
  );

  res.json({ access });
}));

export default r;
