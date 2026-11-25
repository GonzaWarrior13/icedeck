const keyForTeam = teamId => `rinkbeats-billing-demo:team:${teamId}`;

export function readBillingDemoPlan(teamId) {
  try {
    const plan = sessionStorage.getItem(keyForTeam(teamId));
    return plan === 'monthly' || plan === 'annual' ? plan : null;
  } catch {
    return null;
  }
}

export function writeBillingDemoPlan(teamId, plan) {
  try {
    if (plan) sessionStorage.setItem(keyForTeam(teamId), plan);
    else sessionStorage.removeItem(keyForTeam(teamId));
  } catch {
    // The current screen can still simulate payment without browser storage.
  }
}
export const FREE_SHARED_TRACK_LIMIT = 30;
