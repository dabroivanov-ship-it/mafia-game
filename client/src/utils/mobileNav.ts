export type MobileNavPlacement = 'bottom' | 'side';

const STORAGE_KEY = 'mafia_mobile_nav';

export function getMobileNavPlacement(): MobileNavPlacement {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'side' || raw === 'bottom') return raw;
  } catch {
    /* ignore */
  }
  return 'bottom';
}

export function setMobileNavPlacement(value: MobileNavPlacement): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}
