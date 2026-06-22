export function profileStatsPath(userId: number): string {
  return `/profile/${userId}#statistic`;
}

export function profileUserIdFromPath(path: string): number | null {
  const normalized = path.replace(/\/+$/, '') || '/';
  const match = normalized.match(/^\/profile\/(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function isPublicProfilePath(path: string): boolean {
  return profileUserIdFromPath(path) != null;
}

export function readInitialProfileUserId(): number | null {
  if (typeof window === 'undefined') return null;
  return profileUserIdFromPath(window.location.pathname);
}
