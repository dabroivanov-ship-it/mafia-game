export function isStandalonePwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isIosSafari(): boolean {
  if (!isIos()) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
}

const DISMISS_KEY = 'mafia_install_banner_dismissed';

export function isInstallBannerDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissInstallBanner(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function shouldShowInstallBanner(): boolean {
  return isIosSafari() && !isStandalonePwa() && !isInstallBannerDismissed();
}
