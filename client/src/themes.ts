export const THEME_IDS = [
  'midnight',
  'emerald',
  'crimson',
  'day',
  'aurora',
  'sunset',
  'ocean',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'midnight';

export function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  themeColor: string;
  preview: [string, string, string];
}

/** Themes shown in the picker. Legacy ids stay valid for saved accounts. */
export const THEMES: ThemeDefinition[] = [
  {
    id: 'midnight',
    name: 'Полночь',
    description: 'Фиолетовые акценты на глубоком тёмном фоне',
    themeColor: '#0b0b10',
    preview: ['#0b0b10', '#8b85e8', '#14141c'],
  },
  {
    id: 'emerald',
    name: 'Изумруд',
    description: 'Спокойные зелёные оттенки',
    themeColor: '#0a0f0c',
    preview: ['#0a0f0c', '#3dcf9a', '#121a15'],
  },
  {
    id: 'crimson',
    name: 'Мафия',
    description: 'Тёмно-синий фон и бирюзовый акцент',
    themeColor: '#071018',
    preview: ['#071018', '#3ec8e0', '#0c1824'],
  },
  {
    id: 'day',
    name: 'Светлая',
    description: 'Светлые карточки и тёмный текст',
    themeColor: '#f3f2ee',
    preview: ['#f3f2ee', '#5c56c8', '#faf9f6'],
  },
];

const THEME_LABELS: Record<ThemeId, string> = {
  midnight: 'Полночь',
  emerald: 'Изумруд',
  crimson: 'Мафия',
  day: 'Светлая',
  aurora: 'Аврора',
  sunset: 'Закат',
  ocean: 'Океан',
};

export function themeDisplayName(id: ThemeId): string {
  return THEMES.find((t) => t.id === id)?.name ?? THEME_LABELS[id];
}

const THEME_COLOR_FALLBACK: Record<ThemeId, string> = {
  midnight: '#0b0b10',
  emerald: '#0a0f0c',
  crimson: '#071018',
  day: '#f3f2ee',
  aurora: '#080812',
  sunset: '#120c08',
  ocean: '#080c12',
};

export function resolveTheme(userTheme: string | null | undefined, defaultTheme: string): ThemeId {
  if (userTheme && isValidThemeId(userTheme)) return userTheme;
  if (isValidThemeId(defaultTheme)) return defaultTheme;
  return DEFAULT_THEME;
}

export function applyTheme(themeId: ThemeId): void {
  document.documentElement.setAttribute('data-theme', themeId);
  const theme = THEMES.find((t) => t.id === themeId);
  const themeColor = theme?.themeColor ?? THEME_COLOR_FALLBACK[themeId];
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', themeColor);
}
