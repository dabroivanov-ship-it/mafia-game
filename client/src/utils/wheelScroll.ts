import type { WheelEvent as ReactWheelEvent } from 'react';

/** Снимает фокус с number/time, чтобы колесо крутило страницу, а не значение. */
export function blurInputOnWheel(e: ReactWheelEvent<HTMLInputElement>) {
  if (document.activeElement === e.currentTarget) {
    e.currentTarget.blur();
  }
}

function canScrollElement(el: HTMLElement, deltaY: number): boolean {
  if (el.scrollHeight <= el.clientHeight + 1) return false;
  if (deltaY < 0) return el.scrollTop > 0;
  return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
}

function isYScrollPort(el: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(el);
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
}

function isHorizontalScrollTrap(el: HTMLElement): boolean {
  const { overflowX } = getComputedStyle(el);
  const xScrollable = overflowX === 'auto' || overflowX === 'scroll';
  if (!xScrollable) return false;
  const yScrollable = isYScrollPort(el) && el.scrollHeight > el.clientHeight + 1;
  return !yScrollable;
}

/** overflow-y порт без реального вертикального скролла (пустой TipTap и т.п.). */
function isEmptyYScrollPort(el: HTMLElement): boolean {
  return isYScrollPort(el) && el.scrollHeight <= el.clientHeight + 1;
}

function normalizeDeltaY(e: WheelEvent): number {
  if (e.deltaMode === 1) return e.deltaY * 16;
  if (e.deltaMode === 2) return e.deltaY * (window.innerHeight || 800);
  return e.deltaY;
}

function resolvePageScroller(preferredRoot?: HTMLElement | null): HTMLElement | null {
  const appBody =
    (preferredRoot?.classList.contains('app-body') ? preferredRoot : null) ||
    (document.querySelector('.app-body') as HTMLElement | null);
  if (appBody && appBody.scrollHeight > appBody.clientHeight + 1) return appBody;

  const doc = document.scrollingElement as HTMLElement | null;
  if (doc && doc.scrollHeight > doc.clientHeight + 1) return doc;

  return appBody ?? doc;
}

/**
 * Прокрутка страницы колесом.
 * Чат и другие живые overflow-y крутятся сами (в т.ч. у края — без перехвата).
 * Вмешиваемся только у горизонтальных ловушек и «пустых» overflow-auto.
 */
export function attachPageWheelScroll(root: HTMLElement): () => void {
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) return;

    const target = e.target;
    if (!(target instanceof Element)) return;

    if (
      target instanceof HTMLInputElement &&
      (target.type === 'number' || target.type === 'time' || target.type === 'datetime-local')
    ) {
      target.blur();
    }

    const deltaY = normalizeDeltaY(e);
    if (deltaY === 0) return;

    const scroller = resolvePageScroller(root);
    if (!scroller || !canScrollElement(scroller, deltaY)) return;

    let el: HTMLElement | null = target instanceof HTMLElement ? target : target.parentElement;
    while (el && el !== root.parentElement) {
      if (el === scroller) break;

      // Живой вертикальный скроллер (чат и т.п.) — не трогаем, даже у края.
      if (isYScrollPort(el) && el.scrollHeight > el.clientHeight + 1) return;

      if (isHorizontalScrollTrap(el) || (el !== root && isEmptyYScrollPort(el))) {
        e.preventDefault();
        scroller.scrollTop += deltaY;
        return;
      }

      if (el === root) break;
      el = el.parentElement;
    }
  };

  root.addEventListener('wheel', onWheel, { passive: false });
  return () => root.removeEventListener('wheel', onWheel);
}

/** @deprecated используйте attachPageWheelScroll */
export const attachAdminWheelScroll = attachPageWheelScroll;
