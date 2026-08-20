import { getPublicSiteOrigin } from '../seo/siteSeo.js';

const MESSENGER_RE =
  /(?:^|[^a-z0-9])(?:t\.me\/|telegram\.me\/|telegram\.dog\/|discord\.gg\/|discord\.com\/invite\/|wa\.me\/|chat\.whatsapp\.com\/|vk\.me\/|vk\.cc\/|viber\.com\/|invite\.viber\.com\/)/i;

const URL_RE = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;

const BARE_DOMAIN_RE =
  /(?:^|[^a-z0-9./@])([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)(?=[^\w-]|$)/gi;

const AD_PHRASE_RE =
  /(?:наш\s+(?:сайт|сервер|канал|чат|проект|клуб)|играй\s+(?:у\s+нас|тут|здесь)|переход(?:и|ите)\s+по\s+ссылк|подписыва(?:йся|йтесь)|промокод|бесплатн\w*\s+(?:монет|бонус|алмаз)|заходи\s+(?:к\s+нам|на\s+сайт))/i;

function hostFromOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function allowedHosts(): Set<string> {
  const hosts = new Set<string>(['realmafia.online', 'localhost', '127.0.0.1']);
  const fromEnv = hostFromOrigin(getPublicSiteOrigin());
  if (fromEnv) hosts.add(fromEnv.replace(/^www\./, ''));
  const siteUrl = process.env.SITE_URL?.trim() || process.env.VITE_SITE_URL?.trim();
  if (siteUrl) {
    const h = hostFromOrigin(siteUrl);
    if (h) hosts.add(h.replace(/^www\./, ''));
  }
  return hosts;
}

function isAllowedHost(hostname: string, allow: Set<string>): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  if (allow.has(host)) return true;
  for (const allowed of allow) {
    if (host === allowed || host.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

function extractHostname(raw: string): string | null {
  const cleaned = raw.replace(/[),.;!?]+$/g, '');
  try {
    const withProto = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    return new URL(withProto).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** True if text looks like advertising / external invite (per chat rules). */
export function looksLikeAdvertising(text: string): boolean {
  const raw = String(text || '').trim();
  if (!raw) return false;

  if (MESSENGER_RE.test(raw)) return true;

  const allow = allowedHosts();
  const urls = raw.match(URL_RE) || [];
  for (const url of urls) {
    const host = extractHostname(url);
    if (!host) continue;
    if (!isAllowedHost(host, allow)) return true;
  }

  BARE_DOMAIN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BARE_DOMAIN_RE.exec(raw)) !== null) {
    const host = match[1].toLowerCase();
    // Skip version-like or IP-ish noise; need a real TLD feel
    if (!/\.[a-z]{2,}$/i.test(host)) continue;
    if (isAllowedHost(host, allow)) continue;
    // Single-label like "ok.ru" / "ya.ru" / game sites — treat as external
    return true;
  }

  if (AD_PHRASE_RE.test(raw) && (URL_RE.test(raw) || MESSENGER_RE.test(raw) || /@\w{3,}/.test(raw))) {
    return true;
  }

  return false;
}

export const ADVERTISING_BLOCK_MESSAGE =
  'Реклама и сторонние ссылки запрещены. Сообщение записано в журнал модерации.';
