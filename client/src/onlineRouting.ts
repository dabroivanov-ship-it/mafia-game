export const ONLINE_PATH = '/online';

export function isPublicOnlinePath(path: string): boolean {
  const normalized = path.replace(/\/+$/, '') || '/';
  return normalized === ONLINE_PATH;
}
