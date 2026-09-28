export function computeRoadmapAccess({ roadmap, access, user }) {
  const roadmapLocked = !!roadmap?.isLocked;
  const isAdmin = user?.role === 'admin';
  const hasGrantedAccess = Array.isArray(access) && access.some((entry) => {
    if (!entry || !entry.isGranted) return false;
    if (user?.role === 'team') return String(entry.team) === String(user.id);
    return false;
  });

  if (isAdmin) {
    return { allowed: true, reason: '' };
  }

  if (!roadmapLocked || hasGrantedAccess) {
    return { allowed: true, reason: '' };
  }

  return {
    allowed: false,
    reason: 'This roadmap is locked. Please request access from the admin.',
  };
}
