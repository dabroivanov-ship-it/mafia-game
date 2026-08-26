import type { SiteBranding } from './types';

const BRANDING_CACHE_KEY = 'mafia_site_branding';

export const DEFAULT_SITE_BRANDING: SiteBranding = {
  logoUrl: null,
  logoText: 'Реальная мафия',
  logoMark: '♠',
  footerText: '',
};

export function loadCachedBranding(): SiteBranding {
  if (typeof localStorage === 'undefined') return DEFAULT_SITE_BRANDING;
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY);
    if (!raw) return DEFAULT_SITE_BRANDING;
    const parsed = JSON.parse(raw) as Partial<SiteBranding>;
    return {
      logoUrl: parsed.logoUrl ?? null,
      logoText: typeof parsed.logoText === 'string' && parsed.logoText.trim()
        ? parsed.logoText.trim()
        : DEFAULT_SITE_BRANDING.logoText,
      logoMark:
        typeof parsed.logoMark === 'string' && parsed.logoMark.trim()
          ? parsed.logoMark.trim()
          : DEFAULT_SITE_BRANDING.logoMark,
      footerText: typeof parsed.footerText === 'string' ? parsed.footerText : '',
    };
  } catch {
    return DEFAULT_SITE_BRANDING;
  }
}

export function cacheSiteBranding(branding: SiteBranding): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(branding));
  } catch {
    /* ignore quota */
  }
}
