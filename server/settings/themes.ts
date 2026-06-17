export const THEME_IDS = ['midnight', 'emerald', 'crimson', 'aurora', 'sunset', 'ocean'] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'midnight';

export function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

export const THEME_LABELS: Record<ThemeId, string> = {
  midnight: 'Полночь',
  emerald: 'Изумруд',
  crimson: 'Мафия',
  aurora: 'Аврора',
  sunset: 'Закат',
  ocean: 'Океан',
};

export function listThemesPublic() {
  return THEME_IDS.map((id) => ({ id, name: THEME_LABELS[id] }));
}
