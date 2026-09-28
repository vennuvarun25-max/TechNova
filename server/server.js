import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import { AboutContent, Admin, CentralResource, Member, Resource, Round, Team, TeamMember } from './models/index.js';
import { UPLOAD_DIR } from './utils/uploads.js';
import { verifyToken } from './middleware/auth.js';
import { getTimer, serializeTimer } from './utils/timer.js';
import { computeAccess } from './utils/access.js';
import { canAccessRoundResources, isCentralResourceAvailable } from './utils/central-resources.js';
import { migrateMemberRoles } from './utils/member-roles.js';
import { h } from './utils/helpers.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import studentRoutes from './routes/student.js';
import memberRoutes from './routes/member.js';
import commonRoutes from './routes/common.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
// Uploaded files are NOT public: a valid login is required, and teams need Resources access.
app.get('/uploads/:name', h(async (req, res) => {
  const bearer = (req.headers.authorization || '').replace('Bearer ', '');
  let user;
  try { user = verifyToken(req.query.token || bearer); } catch { return res.status(401).send('Please log in again.'); }
  const name = path.basename(req.params.name);
  const [resource, centralResource, aboutContent] = await Promise.all([
    Resource.findOne({ storedName: name }),
    CentralResource.findOne({ storedName: name }),
    AboutContent.findOne({ $or: [
      { storedName: name },
      { 'leads.imageStoredName': name },
      { 'coLeads.imageStoredName': name },
    ] }),
  ]);
  const foundResource = resource || centralResource || aboutContent;
  if (!foundResource) return res.status(404).send('File not found.');
  if (user.role === 'team') {
    const team = await Team.findById(user.id).lean();
    if (!team) return res.status(401).send('Team no longer exists.');
    if (!aboutContent) {
      const access = computeAccess(team, serializeTimer(await getTimer()));
      if (!access.resources.allowed) return res.status(403).send(access.resources.reason);
      if (centralResource && !isCentralResourceAvailable(centralResource)) return res.status(403).send('Test resources are locked until the admin releases them.');
      if (resource) {
        const round = await Round.findById(resource.round).select('isLocked isDayComplete').lean();
        if (!round || !canAccessRoundResources(round)) return res.status(403).send('The admin has locked this round.');
      }
    }
  } else if (user.role !== 'admin') {
    return res.status(403).send('Not allowed.');
  }
  res.set('X-Content-Type-Options', 'nosniff');
  const file = path.join(UPLOAD_DIR, name);
  return req.query.download ? res.download(file, foundResource.fileName || name) : res.sendFile(file);
}));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/member', memberRoutes);
app.use('/api', commonRoutes); // /api/timer, /api/leaderboard
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// Serve the built React app in production
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Error handler
app.use((err, req, res, next) => {
  if (err.code === 11000) return res.status(409).json({ message: 'That name already exists' });
  if (['CastError', 'ValidationError', 'MulterError'].includes(err.name)) {
    return res.status(400).json({ message: err.message || 'Invalid request data' });
  }
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Server error' });
});

async function ensureAdmin() {
  if (await Admin.countDocuments()) return;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  await Admin.create({ username, passwordHash: await bcrypt.hash(password, 10) });
  console.log(`Admin account created -> username: "${username}"`);
}

const PORT = process.env.PORT || 5000;
connectDB()
  .then(() => migrateMemberRoles({ Team, TeamMember, Member }))
  .then(ensureAdmin)
  .then(() => app.listen(PORT, () => console.log(`TechNova server running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
