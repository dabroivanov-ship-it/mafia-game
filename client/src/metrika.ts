const METRIKA_SCRIPT = 'https://mc.yandex.ru/metrika/tag.js';

declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: unknown[]) => void;
  }
}

let activeMetrikaId: number | null = null;
let lastTrackedPath: string | null =
  typeof window !== 'undefined' ? window.location.pathname : null;

function ensureMetrikaLoader() {
  if (typeof window === 'undefined') return;
  const win = window as Window & { ym?: { a?: unknown[]; l?: number } };
  if (typeof win.ym === 'function') return;

  win.ym =
    win.ym ||
    function (...args: unknown[]) {
      (win.ym!.a = win.ym!.a || []).push(args);
    };
  win.ym!.l = Date.now();

  for (let j = 0; j < document.scripts.length; j++) {
    if (document.scripts[j].src.startsWith(METRIKA_SCRIPT)) return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = `${METRIKA_SCRIPT}?id=${activeMetrikaId ?? ''}`;
  document.head.appendChild(script);
}

function updateNoscriptPixel(id: number | null) {
  if (typeof document === 'undefined') return;
  document.getElementById('yandex-metrika-noscript')?.remove();
  if (!id) return;

  const noscript = document.createElement('noscript');
  noscript.id = 'yandex-metrika-noscript';
  noscript.innerHTML = `<div><img src="https://mc.yandex.ru/watch/${id}" style="position:absolute;left:-9999px" alt="" /></div>`;
  document.body.appendChild(noscript);
}

export function initYandexMetrika(id: number | null) {
  if (import.meta.env.DEV || typeof window === 'undefined') return;

  if (!id) {
    activeMetrikaId = null;
    updateNoscriptPixel(null);
    return;
  }

  activeMetrikaId = id;
  ensureMetrikaLoader();

  window.ym?.(id, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });

  updateNoscriptPixel(id);
}

export function trackPageView(path?: string) {
  if (import.meta.env.DEV || !activeMetrikaId || typeof window === 'undefined' || typeof window.ym !== 'function') {
    return;
  }

  const normalized = path
    ? path.startsWith('/')
      ? path
      : `/${path}`
    : `${window.location.pathname}${window.location.search}`;

  if (normalized === lastTrackedPath) return;
  lastTrackedPath = normalized;

  window.ym(activeMetrikaId, 'hit', normalized, { title: document.title });
}
