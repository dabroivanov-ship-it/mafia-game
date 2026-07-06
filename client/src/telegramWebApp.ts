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

export interface TelegramOidcAuthResult {
  id_token?: string;
  error?: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
      Login?: {
        auth: (
          options: { client_id: number; request_access?: Array<'phone' | 'write'>; lang?: string },
          callback: (data: TelegramOidcAuthResult) => void
        ) => void;
      };
    };
  }
}

function applyTelegramViewport(webApp: TelegramWebApp): void {
  const height = webApp.viewportStableHeight || webApp.viewportHeight;
  if (height <= 0) return;

  document.documentElement.classList.add('telegram-webapp');
  document.documentElement.style.setProperty('--tg-viewport-height', `${height}px`);
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
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.initData) return null;
  return webApp;
}

export function waitForTelegramWebApp(timeoutMs = 5000, intervalMs = 150): Promise<TelegramWebApp | null> {
  const existing = getTelegramWebApp();
  if (existing) return Promise.resolve(existing);
  if (!window.Telegram?.WebApp) return Promise.resolve(null);

  return new Promise((resolve) => {
    const intervalId = window.setInterval(() => {
      const webApp = getTelegramWebApp();
      if (webApp) {
        window.clearInterval(intervalId);
        window.clearTimeout(timeoutId);
        resolve(webApp);
      }
    }, intervalMs);

    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
      resolve(getTelegramWebApp());
    }, timeoutMs);
  });
}

export function initTelegramWebApp(): boolean {
  const webApp = getTelegramWebApp();
  if (!webApp) return false;

  try {
    maximizeTelegramWebApp(webApp);
    webApp.onEvent('viewportChanged', () => maximizeTelegramWebApp(webApp));
  } catch (err) {
    console.warn('Telegram WebApp init failed:', err);
  }

  return true;
}
