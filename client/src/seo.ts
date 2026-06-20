import { trackPageView } from './metrika';

export interface PageMeta {
  title: string;
  description: string;
  path?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
}

const SITE_NAME = 'Мафия онлайн';
export const SITE_TAB_TITLE = 'Мафия онлайн — Браузерная игра';

export function getSiteOrigin(): string {
  if (import.meta.env.VITE_SITE_URL) {
    return import.meta.env.VITE_SITE_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'https://24vpsbro.ru';
}

function upsertMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function updatePageMeta(meta: PageMeta) {
  if (typeof document === 'undefined') return;

  const origin = getSiteOrigin();
  const path = meta.path ?? '/';
  const url = `${origin}${path.startsWith('/') ? path : `/${path}`}`;
  const fullTitle =
    meta.path === '/' && !meta.title.includes('|')
      ? meta.title
      : meta.title.includes(SITE_NAME)
        ? meta.title
        : `${meta.title} | ${SITE_NAME}`;

  document.title = fullTitle;
  upsertMeta('description', meta.description);
  upsertMeta('robots', meta.noindex ? 'noindex, nofollow' : 'index, follow');
  upsertMeta('og:title', fullTitle, 'property');
  upsertMeta('og:description', meta.description, 'property');
  upsertMeta('og:type', meta.type ?? 'website', 'property');
  upsertMeta('og:url', url, 'property');
  upsertMeta('og:site_name', SITE_NAME, 'property');
  upsertMeta('og:locale', 'ru_RU', 'property');
  upsertMeta('twitter:card', 'summary_large_image');
  upsertMeta('twitter:title', fullTitle);
  upsertMeta('twitter:description', meta.description);
  upsertLink('canonical', url);
  trackPageView(path);
}

export const DEFAULT_PAGE_META: PageMeta = {
  title: SITE_TAB_TITLE,
  description:
    'Браузерная онлайн-игра «Мафия» с чатом, ролями и комнатами. Играйте в браузере или через Telegram: мафия, комиссар, доктор, маньяк и другие роли.',
  path: '/',
};

export const INFO_PAGE_META: Record<string, PageMeta> = {
  hub: {
    title: 'Информация об игре',
    description:
      'Правила игры «Мафия онлайн», описание ролей, правила чата и команда проекта. Всё для новичков и опытных игроков.',
    path: '/info',
  },
  rules: {
    title: 'Правила игры',
    description:
      'Как играть в мафию онлайн: регистрация в комнате, фазы дня и ночи, голосование, победа мирных и мафии, начисление очков.',
    path: '/info/rules',
  },
  roles: {
    title: 'Игровые роли',
    description:
      'Описание ролей в онлайн-игре Мафия: мафия, адвокат, Катани, доктор, путана, бомж, маньяк, клоун, горец и другие. Состав зависит от числа игроков.',
    path: '/info/roles',
  },
  chatRules: {
    title: 'Правила чата',
    description: 'Правила общения в чате игры «Мафия онлайн»: что можно и нельзя, модерация и наказания.',
    path: '/info/chat',
  },
  team: {
    title: 'Команда проекта',
    description: 'Администраторы и модераторы онлайн-игры «Мафия».',
    path: '/info/team',
  },
  rating: {
    title: 'Рейтинг игроков',
    description:
      'Топ игроков онлайн-игры «Мафия»: очки за партии, число игр и репутация.',
    path: '/info/rating',
  },
};
