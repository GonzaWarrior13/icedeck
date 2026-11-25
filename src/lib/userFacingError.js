export function userFacingError(error, fallback) {
  if (error?.status === 401 || error?.code === 'PGRST301') {
    return 'Your session ended. Sign out, then sign in again.';
  }
  if (error?.status === 403 || error?.code === '42501') {
    return 'You don’t have permission to do that. Ask a team admin for access.';
  }
  if (error?.status === 429) return 'Too many attempts. Wait a moment, then try again.';
  return fallback;
}
