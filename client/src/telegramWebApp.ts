interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: { id: number; username?: string; first_name?: string };
  };
  platform: string;
  ready: () => void;
  expand: () => void;
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  onEvent: (event: string, callback: () => void) => void;
  viewportHeight: number;
  viewportStableHeight: number;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

function applyTelegramViewport(webApp: TelegramWebApp): void {
  document.documentElement.classList.add('telegram-webapp');
  const height = webApp.viewportStableHeight || webApp.viewportHeight;
  if (height > 0) {
    document.documentElement.style.setProperty('--tg-viewport-height', `${height}px`);
  }
}

function maximizeTelegramWebApp(webApp: TelegramWebApp): void {
  webApp.ready();
  webApp.expand();
  webApp.requestFullscreen?.();
  webApp.disableVerticalSwipes?.();
  applyTelegramViewport(webApp);
}

export function isTelegramWebApp(): boolean {
  return Boolean(window.Telegram?.WebApp?.initData);
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function initTelegramWebApp(): boolean {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return false;

  maximizeTelegramWebApp(webApp);
  webApp.onEvent('viewportChanged', () => maximizeTelegramWebApp(webApp));

  return Boolean(webApp.initData);
}
