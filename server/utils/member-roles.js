export const IDENTITY_ROLES = ['VISION LEAD', 'CODE ARCHITECT', 'INNOVATION STRATEGIST'];

export function roleForTeamSlot(index) {
  return IDENTITY_ROLES[index] || IDENTITY_ROLES[IDENTITY_ROLES.length - 1];
}

export function normalizeTeamMemberRole(role, index) {
  return IDENTITY_ROLES.includes(role) ? role : roleForTeamSlot(index);
}

export async function migrateMemberRoles({ Team, TeamMember, Member }) {
  const teams = await Team.find().select('_id').lean();

  for (const team of teams) {
    const roster = await TeamMember.find({ team: team._id }).sort('_id').select('_id role').lean();
    for (const [index, member] of roster.entries()) {
      const role = normalizeTeamMemberRole(member.role, index);
      if (role !== member.role) {
        await TeamMember.collection.updateOne({ _id: member._id }, { $set: { role } });
      }
    }

    const accounts = await Member.find({ team: team._id }).sort('_id').select('_id role').lean();
    const assigned = new Set(accounts.map((member) => member.role).filter((role) => IDENTITY_ROLES.includes(role)));
    for (const member of accounts) {
      if (IDENTITY_ROLES.includes(member.role)) continue;
      const role = member.role === 'Team Lead'
        ? IDENTITY_ROLES[0]
        : IDENTITY_ROLES.slice(1).find((candidate) => !assigned.has(candidate)) || roleForTeamSlot(assigned.size);
      assigned.add(role);
      await Member.collection.updateOne({ _id: member._id }, { $set: { role } });
    }
  }
}