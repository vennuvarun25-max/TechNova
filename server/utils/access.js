// Decides what a team may open right now.
// Tests:     closed by admin  OR  timer finished (when auto-lock is on)
// Resources: closed by admin
import { canAccessRoundTests } from './central-resources.js';

export function computeAccess(team, timer, round = null) {
  const testsOn = team.testsEnabled !== false;
  const resourcesOn = team.resourcesEnabled !== false;
  const timeUp = timer.status === 'finished' && timer.lockTestsOnTimeUp;
  const roundLocked = round?.isLocked === true;
  const dayComplete = round?.isDayComplete === true;
  return {
    tests: {
      allowed: testsOn && !timeUp && canAccessRoundTests(round || {}),
      reason: dayComplete ? 'This day is complete, so its tests are closed.' : roundLocked ? 'The admin has locked this round.' : !testsOn ? 'The admin has closed the tests for now.' : timeUp ? "Time is up, so the tests are closed." : '',
    },
    resources: {
      allowed: resourcesOn && !roundLocked,
      reason: roundLocked ? 'The admin has locked this round.' : resourcesOn ? '' : 'The admin has closed the resources for now.',
    },
    round: { allowed: !roundLocked, reason: roundLocked ? 'The admin has locked this round.' : '' },
  };
}
