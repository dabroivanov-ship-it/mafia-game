export interface SitemapEntry {
  path: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: number;
}

/** Public pages that should be indexed (SPA routes with meaningful content). */
export const SITEMAP_ENTRIES: SitemapEntry[] = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/info', changefreq: 'weekly', priority: 0.9 },
  { path: '/info/rules', changefreq: 'weekly', priority: 0.9 },
  { path: '/info/roles', changefreq: 'weekly', priority: 0.9 },
  { path: '/info/chat', changefreq: 'monthly', priority: 0.8 },
  { path: '/info/rating', changefreq: 'daily', priority: 0.85 },
  { path: '/info/faq', changefreq: 'monthly', priority: 0.8 },
  { path: '/info/team', changefreq: 'monthly', priority: 0.7 },
  { path: '/info/quiz', changefreq: 'weekly', priority: 0.75 },
];

export function getPublicSiteOrigin(): string {
  const fromEnv =
    process.env.SITE_URL?.trim() ||
    process.env.CORS_ORIGIN?.split(',')[0]?.trim() ||
    process.env.VITE_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return 'https://realmafia.online';
}

export function buildRobotsTxt(origin = getPublicSiteOrigin()): string {
  const host = origin.replace(/^https?:\/\//, '');
  return `# robots.txt — Мафия онлайн
# ${origin}

User-agent: *
Disallow: /api/
Disallow: /socket.io/
Disallow: /uploads/
Disallow: /profile/

User-agent: Googlebot
Allow: /
Disallow: /api/
Disallow: /socket.io/
Disallow: /uploads/
Disallow: /profile/

User-agent: Yandex
Allow: /
Disallow: /api/
Disallow: /socket.io/
Disallow: /uploads/
Disallow: /profile/
Host: ${host}
Clean-param: tg_token&tg_error&vk_token&vk_error&vk_setup&vk_suggested&vk_display&vk_taken /

Sitemap: ${origin}/sitemap.xml
`;
}

export function buildSitemapXml(origin = getPublicSiteOrigin()): string {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = SITEMAP_ENTRIES.map(
    (entry) => `  <url>
    <loc>${origin}${entry.path === '/' ? '/' : entry.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(2)}</priority>
  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
