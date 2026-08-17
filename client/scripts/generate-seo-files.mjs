import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const origin =
  process.env.SITE_URL?.replace(/\/+$/, '') ||
  process.env.VITE_SITE_URL?.replace(/\/+$/, '') ||
  process.env.CORS_ORIGIN?.split(',')[0]?.trim().replace(/\/+$/, '') ||
  'https://realmafia.online';

const host = origin.replace(/^https?:\/\//, '');

const sitemapEntries = [
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

const lastmod = new Date().toISOString().slice(0, 10);

const robotsTxt = `# robots.txt — Мафия онлайн
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
Clean-param: tg_token&tg_error /

Sitemap: ${origin}/sitemap.xml
`;

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
  .map(
    (entry) => `  <url>
    <loc>${origin}${entry.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(2)}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8');
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
console.log(`SEO files generated for ${origin}`);
