import mongoose from 'mongoose';
import { IDENTITY_ROLES } from '../utils/member-roles.js';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, required: true });

// ---- Admin ----
export const Admin = model(
  'Admin',
  new Schema({
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
  })
);

// ---- Teams (name is unique, case-insensitive) ----
const teamSchema = new Schema(
  {
    teamId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    activeMemberNames: { type: [String], default: [] },
    // Admin-controlled access to the two student sections
    testsEnabled: { type: Boolean, default: true },
    resourcesEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);
teamSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
export const Team = model('Team', teamSchema);

// ---- Team members (max 3 per team, enforced in the API) ----
export const TeamMember = model(
  'TeamMember',
  new Schema({
    team: ref('Team'),
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: IDENTITY_ROLES, default: 'CODE ARCHITECT' },
    isActive: { type: Boolean, default: true },
    individualXp: { type: Number, default: 0 },
    problemsCompleted: { type: Number, default: 0 },
    linkedinUrl: { type: String, default: '' },
    githubUrl: { type: String, default: '' },
    leetcodeUrl: { type: String, default: '' },
    kaggleUrl: { type: String, default: '' },
    profileXpAwarded: { type: Boolean, default: false },
    profileCompletedAt: { type: Date, default: null },
  })
);

// ---- Individual member accounts (extend the existing team model) ----
const memberSchema = new Schema(
  {
    team: ref('Team'),
    teamName: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    memberId: { type: String, required: true, unique: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: IDENTITY_ROLES,
      required: true,
    },
    isActive: { type: Boolean, default: true },
    problemsAttempted: { type: Number, default: 0 },
    problemsCompleted: { type: Number, default: 0 },
    hintsUsed: { type: Number, default: 0 },
    submissions: { type: Number, default: 0 },
    individualXp: { type: Number, default: 0 },
    activityHistory: [{ type: String, default: '' }],
  },
  { timestamps: true }
);
export const Member = model('Member', memberSchema);

// ---- Task hint metadata and per-member access ----
const taskHintSchema = new Schema(
  {
    text: { type: String, default: '' },
    enabled: { type: Boolean, default: false },
    penaltyXp: { type: Number, default: 0 },
  },
  { _id: false }
);

const hintAccessSchema = new Schema(
  {
    member: ref('Member'),
    team: ref('Team'),
    round: ref('Round'),
    task: ref('Task'),
    status: { type: String, enum: ['not_available', 'available', 'used'], default: 'not_available' },
    grantedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
    grantedAt: { type: Date, default: null },
    usedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);
hintAccessSchema.index({ member: 1, task: 1 }, { unique: true });
export const HintAccess = model('HintAccess', hintAccessSchema);

const hintAuditSchema = new Schema(
  {
    admin: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    member: { type: Schema.Types.ObjectId, ref: 'Member', default: null },
    team: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    round: { type: Schema.Types.ObjectId, ref: 'Round', default: null },
    task: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    action: { type: String, required: true },
    message: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
export const HintAudit = model('HintAudit', hintAuditSchema);

// ---- Hints used per member / task ----
const hintUsageSchema = new Schema(
  {
    member: ref('Member'),
    team: ref('Team'),
    round: ref('Round'),
    task: ref('Task'),
    used: { type: Boolean, default: false },
    usedAt: { type: Date, default: null },
    submissionId: { type: String, default: '' },
  },
  { timestamps: true }
);
hintUsageSchema.index({ member: 1, task: 1 }, { unique: true });
export const HintUsage = model('HintUsage', hintUsageSchema);

// ---- Individual submissions ----
const submissionSchema = new Schema(
  {
    member: ref('Member'),
    team: ref('Team'),
    round: ref('Round'),
    task: ref('Task'),
    code: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    verificationScore: { type: Number, default: 0 },
    xpAwarded: { type: Number, default: 0 },
    hintUsed: { type: Boolean, default: false },
    hintUsedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
export const Submission = model('Submission', submissionSchema);

// ---- XP transactions (single source of truth) ----
const xpTransactionSchema = new Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    team: ref('Team'),
    member: { type: Schema.Types.ObjectId, ref: 'Member', default: null },
    round: { type: Schema.Types.ObjectId, ref: 'Round', default: null },
    task: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    submission: { type: Schema.Types.ObjectId, ref: 'Submission', default: null },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['award', 'penalty', 'adjustment'], default: 'award' },
    reason: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
export const XPTransaction = model('XPTransaction', xpTransactionSchema);

// ---- Rounds ----
export const Round = model(
  'Round',
  new Schema(
    {
      name: { type: String, required: true, trim: true },
      description: { type: String, default: '' },
      instructions: { type: String, default: '' },
      day: { type: String, default: 'Day 1', trim: true },
      dayOrder: { type: Number, default: 1 },
      order: { type: Number, default: 0 },
      isLocked: { type: Boolean, default: false },
      isDayComplete: { type: Boolean, default: false },
    },
    { timestamps: true }
  )
);

// ---- Questions / tasks (belong to a round) ----
export const Task = model(
  'Task',
  new Schema(
    {
      round: ref('Round'),
      title: { type: String, required: true, trim: true },
      description: { type: String, default: '' },
      link: { type: String, default: '' }, // optional external problem link
      hint: { type: String, default: '' },
      hintEnabled: { type: Boolean, default: false },
      hintPenaltyXp: { type: Number, default: 0 },
      order: { type: Number, default: 0 },
    },
    { timestamps: true }
  )
);

// ---- Resources (belong to a round): pdf | document | link ----
export const Resource = model(
  'Resource',
  new Schema(
    {
      round: ref('Round'),
      title: { type: String, required: true, trim: true },
      type: { type: String, enum: ['pdf', 'document', 'link'], required: true },
      url: { type: String, required: true }, // /uploads/<file> or external URL
      fileName: { type: String, default: '' }, // original file name
      storedName: { type: String, default: '' }, // name on disk
    },
    { timestamps: true }
  )
);

export const CentralResource = model(
  'CentralResource',
  new Schema(
    {
      title: { type: String, required: true, trim: true },
      type: { type: String, enum: ['pdf', 'document', 'link'], required: true },
      category: { type: String, enum: ['test', 'shared'], required: true },
      url: { type: String, required: true },
      fileName: { type: String, default: '' },
      storedName: { type: String, default: '' },
      isReleased: { type: Boolean, default: false },
    },
    { timestamps: true }
  )
);

const aboutPersonSchema = new Schema(
  {
    name: { type: String, default: '', trim: true },
    bio: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '' },
    imageFileName: { type: String, default: '' },
    imageStoredName: { type: String, default: '' },
  },
  { _id: false }
);

export const AboutContent = model(
  'AboutContent',
  new Schema(
    {
      key: { type: String, default: 'main', unique: true },
      title: { type: String, default: 'About TechNova', trim: true },
      introduction: { type: String, default: '' },
      imageUrl: { type: String, default: '' },
      imageFileName: { type: String, default: '' },
      storedName: { type: String, default: '' },
      leads: { type: [aboutPersonSchema], default: [] },
      coLeads: { type: [aboutPersonSchema], default: [] },
    },
    { timestamps: true }
  )
);

// ---- Task completion (one per team + task) ----
const completionSchema = new Schema({
  team: ref('Team'),
  task: ref('Task'),
  round: ref('Round'),
  member: { type: Schema.Types.ObjectId, ref: 'TeamMember', default: null },
  completedAt: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
});
completionSchema.index({ team: 1, task: 1 }, { unique: true });
export const Completion = model('Completion', completionSchema);

// ---- XP records (created only when admin verifies) ----
const xpSchema = new Schema(
  {
    team: ref('Team'),
    task: ref('Task'),
    completion: ref('Completion'),
    member: { type: Schema.Types.ObjectId, ref: 'TeamMember', default: null },
    points: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);
xpSchema.index({ team: 1, task: 1 }, { unique: true });
export const XPRecord = model('XPRecord', xpSchema);

// ---- Projects (Project Showcase — built by teams) ----
const projectSchema = new Schema(
  {
    team: ref('Team'),
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    techStack: { type: [String], default: [] },
    githubUrl: { type: String, default: '' },
    demoUrl: { type: String, default: '' },
    status: { type: String, enum: ['Ongoing', 'Completed'], default: 'Ongoing' },
    members: { type: [String], default: [] },
  },
  { timestamps: true }
);
export const Project = model('Project', projectSchema);

// ---- Competition timer (single document) ----
export const Timer = model(
  'Timer',
  new Schema({
    key: { type: String, default: 'main', unique: true },
    durationSec: { type: Number, default: 3600 },
    status: { type: String, enum: ['idle', 'running', 'paused'], default: 'idle' },
    startedAt: { type: Date, default: null },
    elapsedMs: { type: Number, default: 0 },
    lockTestsOnTimeUp: { type: Boolean, default: true }, // close tests automatically when time is up
  })
);
