export interface SitemapEntry {
  path: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: number;
}

export interface PublicPageMeta {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}

export type SpaRouteKind = 'indexed' | 'app' | 'unknown';

export const SITE_NAME = 'Мафия онлайн';
export const SITE_DEFAULT_DESCRIPTION =
  'Приглашаем в онлайн-игру «Мафия». Это отличное место для игры любого уровня от новичка до профи';
export const OG_IMAGE_PATH = '/og-image.png';

/** Public pages that should be indexed (SPA routes with meaningful content). */
export const SITEMAP_ENTRIES: SitemapEntry[] = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/info', changefreq: 'weekly', priority: 0.9 },
  { path: '/info/about', changefreq: 'monthly', priority: 0.85 },
  { path: '/info/rules', changefreq: 'weekly', priority: 0.9 },
  { path: '/info/roles', changefreq: 'weekly', priority: 0.9 },
  { path: '/info/ai', changefreq: 'weekly', priority: 0.85 },
  { path: '/info/chat', changefreq: 'monthly', priority: 0.8 },
  { path: '/info/rating', changefreq: 'daily', priority: 0.85 },
  { path: '/info/faq', changefreq: 'monthly', priority: 0.8 },
  { path: '/info/team', changefreq: 'monthly', priority: 0.7 },
  { path: '/info/quiz', changefreq: 'weekly', priority: 0.75 },
];

/** Keep titles/descriptions in sync with client/src/seo.ts */
const PUBLIC_PAGE_META: Record<string, PublicPageMeta> = {
  '/': {
    title: SITE_NAME,
    description: SITE_DEFAULT_DESCRIPTION,
    path: '/',
  },
  '/info': {
    title: 'Информация об игре',
    description:
      'Правила игры «Мафия онлайн», история Мафии, описание ролей, игры с AI-агентами, правила чата и команда проекта. Всё для новичков и опытных игроков.',
    path: '/info',
  },
  '/info/about': {
    title: 'Об игре',
    description:
      'История игры «Мафия»: Дмитрий Давыдов, МГУ, 1986 год, прототипы, клубы и первые онлайн-партии. Как психологическая игра дошла до браузера.',
    path: '/info/about',
  },
  '/info/rules': {
    title: 'Правила игры',
    description:
      'Как играть в мафию онлайн: регистрация в комнате, фазы дня и ночи, голосование, победа мирных и мафии, начисление очков.',
    path: '/info/rules',
  },
  '/info/roles': {
    title: 'Игровые роли',
    description:
      'Описание ролей в онлайн-игре Мафия: мафия, адвокат, Катани, доктор, путана, бомж, маньяк, клоун, горец и другие. Состав зависит от числа игроков.',
    path: '/info/roles',
  },
  '/info/ai': {
    title: 'Игры с AI-агентами',
    description:
      'Как играть в мафию с AI-агентами: комнаты с меткой «AI», роли ботов, чат, голосование и ночные ходы по тем же правилам, что у людей.',
    path: '/info/ai',
  },
  '/info/chat': {
    title: 'Правила чата',
    description:
      'Правила общения в игре «Мафия онлайн»: чаты комнат, личные сообщения, честная игра, модерация и наказания.',
    path: '/info/chat',
  },
  '/info/team': {
    title: 'Команда проекта',
    description: 'Администраторы и модераторы онлайн-игры «Мафия».',
    path: '/info/team',
  },
  '/info/rating': {
    title: 'Рейтинг игроков',
    description: 'Топ игроков онлайн-игры «Мафия»: очки за партии, число игр и репутация.',
    path: '/info/rating',
  },
  '/info/faq': {
    title: 'Частые вопросы',
    description:
      'Ответы на частые вопросы об онлайн-игре «Мафия»: как начать, сколько игроков нужно, роли, AI-агенты и ведущий.',
    path: '/info/faq',
  },
  '/info/quiz': {
    title: 'Самые умные',
    description: 'Топ-10 игроков по верным ответам в викторине на сайте.',
    path: '/info/quiz',
  },
};

const INDEXED_PATHS = new Set(SITEMAP_ENTRIES.map((entry) => normalizePath(entry.path)));

export function getPublicSiteOrigin(): string {
  const fromEnv =
    process.env.SITE_URL?.trim() ||
    process.env.CORS_ORIGIN?.split(',')[0]?.trim() ||
    process.env.VITE_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return 'https://realmafia.online';
}

export function normalizePath(pathname: string): string {
  const raw = pathname.split('?')[0]?.split('#')[0] || '/';
  if (raw === '/') return '/';
  return raw.replace(/\/+$/, '') || '/';
}

export function classifySpaPath(pathname: string): SpaRouteKind {
  const path = normalizePath(pathname);
  if (INDEXED_PATHS.has(path)) return 'indexed';
  if (/^\/profile\/\d+$/.test(path)) return 'app';
  if (/^\/room\/\d+(\/who)?$/.test(path)) return 'app';
  if (path === '/news') return 'app';
  return 'unknown';
}

export function getPublicPageMeta(pathname: string): PublicPageMeta | null {
  return PUBLIC_PAGE_META[normalizePath(pathname)] ?? null;
}

export function pageFullTitle(meta: PublicPageMeta): string {
  if (meta.path === '/' && !meta.title.includes('|')) return meta.title;
  if (meta.title.includes(SITE_NAME)) return meta.title;
  return `${meta.title} | ${SITE_NAME}`;
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
Clean-param: tg_error&vk_error&vk_setup&vk_suggested&vk_display&vk_taken /

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

export function buildSecurityTxt(origin = getPublicSiteOrigin()): string {
  const expires = new Date();
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  return `Contact: https://t.me/realmaf_bot
Expires: ${expires.toISOString()}
Preferred-Languages: ru, en
Canonical: ${origin}/.well-known/security.txt
`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function replaceOnce(html: string, pattern: RegExp, replacement: string): string {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace('</head>', `    ${replacement}\n  </head>`);
}

function setMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
  const tag = `<meta ${attr}="${key}" content="${escapeAttr(content)}" />`;
  const pattern = new RegExp(`<meta\\s+${attr}="${key}"[^>]*>`, 'i');
  return replaceOnce(html, pattern, tag);
}

export function applySpaHtmlMeta(html: string, meta: PublicPageMeta, origin = getPublicSiteOrigin()): string {
  const path = meta.path.startsWith('/') ? meta.path : `/${meta.path}`;
  const url = `${origin}${path === '/' ? '/' : path}`;
  const title = pageFullTitle(meta);
  const image = `${origin}${OG_IMAGE_PATH}`;
  const robots = meta.noindex ? 'noindex, nofollow' : 'index, follow';

  let next = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttr(title)}</title>`);
  next = setMeta(next, 'name', 'description', meta.description);
  next = setMeta(next, 'name', 'robots', robots);
  next = setMeta(next, 'property', 'og:title', title);
  next = setMeta(next, 'property', 'og:description', meta.description);
  next = setMeta(next, 'property', 'og:url', url);
  next = setMeta(next, 'property', 'og:image', image);
  next = setMeta(next, 'name', 'twitter:title', title);
  next = setMeta(next, 'name', 'twitter:description', meta.description);
  next = setMeta(next, 'name', 'twitter:image', image);
  next = replaceOnce(
    next,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeAttr(url)}" />`
  );
  return next;
}
