import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { AboutContent, Team, XPRecord, XPTransaction, Member } from '../models/index.js';
import { getTimer, serializeTimer } from '../utils/timer.js';
import { h } from '../utils/helpers.js';
import { serializeAbout } from '../utils/about.js';

const r = Router();
r.use(auth); // any logged-in user (admin or team)

r.get('/timer', h(async (req, res) => {
  res.json(serializeTimer(await getTimer()));
}));

r.get('/about', h(async (req, res) => {
  const about = await AboutContent.findOne({ key: 'main' }).lean();
  res.json(serializeAbout(about));
}));

// Leaderboard uses VERIFIED XP only (XP records exist only after admin verification)
r.get('/leaderboard', h(async (req, res) => {
  const [teams, recordTotals, txTotals] = await Promise.all([
    Team.find().select('name').lean(),
    XPRecord.aggregate([{ $group: { _id: '$team', xp: { $sum: '$points' } } }]),
    XPTransaction.aggregate([{ $group: { _id: '$team', xp: { $sum: '$amount' } } }]),
  ]);
  const xpMap = new Map(recordTotals.map((t) => [String(t._id), t.xp]));
  const txnMap = new Map(txTotals.map((t) => [String(t._id), t.xp]));
  const rows = teams
    .map((t) => ({ _id: t._id, name: t.name, xp: (xpMap.get(String(t._id)) || 0) + (txnMap.get(String(t._id)) || 0) }))
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
  let rank = 0;
  let prev = null;
  rows.forEach((row, i) => {
    if (row.xp !== prev) { rank = i + 1; prev = row.xp; } // ties share a rank
    row.rank = rank;
  });

  res.json({
    rows,
    topTeam: rows[0] ? { name: rows[0].name, xp: rows[0].xp } : null,
  });
}));

export default r;
