export const BLOG_PATH = '/blog';

export function isPublicBlogPath(path: string): boolean {
  const normalized = path.replace(/\/+$/, '') || '/';
  return normalized === BLOG_PATH || normalized.startsWith(`${BLOG_PATH}/`);
}

export function blogPostIdFromPath(path: string): number | null {
  const normalized = path.replace(/\/+$/, '') || '/';
  const match = normalized.match(/^\/blog\/(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function blogPostPath(id: number): string {
  return `${BLOG_PATH}/${id}`;
}
