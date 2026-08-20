import { getPublicSiteOrigin } from '../seo/siteSeo.js';
import type { ViolationType } from './violationLog.js';

const MESSENGER_RE =
  /(?:^|[^a-z0-9])(?:t\.me\/|telegram\.me\/|telegram\.dog\/|discord\.gg\/|discord\.com\/invite\/|wa\.me\/|chat\.whatsapp\.com\/|vk\.me\/|vk\.cc\/|viber\.com\/|invite\.viber\.com\/)/i;

const URL_RE = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;

const BARE_DOMAIN_RE =
  /(?:^|[^a-z0-9./@])([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)(?=[^\w-]|$)/gi;

const AD_PHRASE_RE =
  /(?:наш\s+(?:сайт|сервер|канал|чат|проект|клуб)|играй\s+(?:у\s+нас|тут|здесь)|переход(?:и|ите)\s+по\s+ссылк|подписыва(?:йся|йтесь)|промокод|бесплатн\w*\s+(?:монет|бонус|алмаз)|заходи\s+(?:к\s+нам|на\s+сайт))/i;

/** Common Russian obscenity stems (obfuscation-tolerant). */
const PROFANITY_STEMS = [
  'бля',
  'блять',
  'бляд',
  'еба',
  'ебл',
  'ёба',
  'ёбл',
  'ебан',
  'ебат',
  'ебуч',
  'ёбуч',
  'хуй',
  'хуя',
  'хуе',
  'хуё',
  'пизд',
  'пезд',
  'мудил',
  'мудак',
  'гандон',
  'гондон',
  'сука',
  'сучк',
  'залуп',
  'дроч',
  'пидор',
  'пидар',
  'педик',
  'чмо',
  'мраз',
  'тварь',
  'падл',
  'шлюх',
  'шлюш',
];

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
    if (!/\.[a-z]{2,}$/i.test(host)) continue;
    if (isAllowedHost(host, allow)) continue;
    return true;
  }

  if (AD_PHRASE_RE.test(raw) && (URL_RE.test(raw) || MESSENGER_RE.test(raw) || /@\w{3,}/.test(raw))) {
    return true;
  }

  return false;
}

function normalizeForProfanity(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/0/g, 'о')
    .replace(/[@а]/g, 'а')
    .replace(/\$/g, 's')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function looksLikeProfanity(text: string): boolean {
  const compact = normalizeForProfanity(text);
  if (compact.length < 3) return false;
  for (const stem of PROFANITY_STEMS) {
    if (compact.includes(stem)) return true;
  }
  return false;
}

/** Flood / “naked” spam without links. */
export function looksLikeSpam(text: string): boolean {
  const raw = String(text || '').trim();
  if (!raw) return false;

  if (/(.)\1{7,}/u.test(raw)) return true;

  const letters = raw.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 12) {
    const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
    if (upper / letters.length >= 0.75) return true;
  }

  const words = raw.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length >= 5) {
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
    for (const [w, n] of counts) {
      if (w.length >= 2 && n >= 4 && n / words.length >= 0.5) return true;
    }
  }

  if (/^[!?.…\s]{6,}$/u.test(raw)) return true;

  return false;
}

/** Priority: advertising → profanity → spam(other). */
export function detectChatViolation(text: string): ViolationType | null {
  if (looksLikeAdvertising(text)) return 'advertising';
  if (looksLikeProfanity(text)) return 'profanity';
  if (looksLikeSpam(text)) return 'other';
  return null;
}

export const AUTO_BLOCK_MESSAGES: Record<ViolationType, string> = {
  advertising: 'Реклама и сторонние ссылки запрещены. Сообщение записано в журнал модерации.',
  profanity: 'Мат запрещён. Сообщение записано в журнал модерации.',
  other: 'Спам запрещён. Сообщение записано в журнал модерации.',
};

/** @deprecated use AUTO_BLOCK_MESSAGES.advertising */
export const ADVERTISING_BLOCK_MESSAGE = AUTO_BLOCK_MESSAGES.advertising;
