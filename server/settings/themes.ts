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

export const THEME_LABELS: Record<ThemeId, string> = {
  midnight: 'Полночь',
  emerald: 'Изумруд',
  crimson: 'Мафия',
  day: 'Светлая',
  aurora: 'Аврора',
  sunset: 'Закат',
  ocean: 'Океан',
};

const PUBLIC_THEME_IDS: ThemeId[] = ['midnight', 'emerald', 'crimson', 'day'];

export function listThemesPublic() {
  return PUBLIC_THEME_IDS.map((id) => ({ id, name: THEME_LABELS[id] }));
}
