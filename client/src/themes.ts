export const THEME_IDS = ['midnight', 'emerald', 'crimson', 'aurora', 'sunset', 'ocean'] as const;

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

export const THEMES: ThemeDefinition[] = [
  {
    id: 'midnight',
    name: 'Полночь',
    description: 'Фиолетовые акценты на глубоком тёмном фоне',
    themeColor: '#0a0b10',
    preview: ['#0a0b10', '#7c6cf0', '#151821'],
  },
  {
    id: 'emerald',
    name: 'Изумруд',
    description: 'Спокойные зелёные оттенки',
    themeColor: '#080f0c',
    preview: ['#080f0c', '#2dd4a8', '#101a14'],
  },
  {
    id: 'crimson',
    name: 'Мафия',
    description: 'Тёмно-синий фон и бирюзовое свечение, как на VIZOR',
    themeColor: '#000511',
    preview: ['#000511', '#00c8ff', '#061428'],
  },
  {
    id: 'aurora',
    name: 'Аврора',
    description: 'Холодное северное сияние',
    themeColor: '#080812',
    preview: ['#080812', '#38bdf8', '#12101f'],
  },
  {
    id: 'sunset',
    name: 'Закат',
    description: 'Тёплые оранжевые переливы',
    themeColor: '#120c08',
    preview: ['#120c08', '#fb923c', '#1a120e'],
  },
  {
    id: 'ocean',
    name: 'Океан',
    description: 'Глубокий синий с мягким свечением',
    themeColor: '#080c12',
    preview: ['#080c12', '#60a5fa', '#101620'],
  },
];

export function resolveTheme(userTheme: string | null | undefined, defaultTheme: string): ThemeId {
  if (userTheme && isValidThemeId(userTheme)) return userTheme;
  if (isValidThemeId(defaultTheme)) return defaultTheme;
  return DEFAULT_THEME;
}

export function applyTheme(themeId: ThemeId): void {
  document.documentElement.setAttribute('data-theme', themeId);
  const theme = THEMES.find((t) => t.id === themeId);
  if (theme) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', theme.themeColor);
  }
}
