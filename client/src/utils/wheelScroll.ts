import type { WheelEvent as ReactWheelEvent } from 'react';

/** Снимает фокус с number/time, чтобы колесо крутило страницу, а не значение. */
export function blurInputOnWheel(e: ReactWheelEvent<HTMLInputElement>) {
  if (document.activeElement === e.currentTarget) {
    e.currentTarget.blur();
  }
}

function canScrollY(el: HTMLElement, deltaY: number): boolean {
  const { overflowY } = getComputedStyle(el);
  if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') return false;
  if (el.scrollHeight <= el.clientHeight + 1) return false;
  if (deltaY < 0) return el.scrollTop > 0;
  return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
}

function isYScrollPort(el: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(el);
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
}

function isHorizontalScrollTrap(el: HTMLElement): boolean {
  const { overflowX, overflowY } = getComputedStyle(el);
  const xScrollable = overflowX === 'auto' || overflowX === 'scroll';
  if (!xScrollable) return false;
  const yScrollable = isYScrollPort(el) && el.scrollHeight > el.clientHeight + 1;
  return !yScrollable;
}

/**
 * Прокрутка страницы колесом: горизонтальные обёртки, «пустые» overflow-auto
 * (TipTap и т.п.) и поля number/time не перехватывают скролл `.app-body`.
 */
export function attachPageWheelScroll(root: HTMLElement): () => void {
  const onWheel = (e: WheelEvent) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    if (
      target instanceof HTMLInputElement &&
      (target.type === 'number' || target.type === 'time' || target.type === 'datetime-local')
    ) {
      target.blur();
    }

    const scroller =
      (document.querySelector('.app-body') as HTMLElement | null) ??
      (document.scrollingElement as HTMLElement | null);
    if (!scroller || !canScrollY(scroller, e.deltaY)) return;

    let el: HTMLElement | null = target instanceof HTMLElement ? target : target.parentElement;
    while (el && el !== root.parentElement) {
      if (el === scroller) break;

      if (canScrollY(el, e.deltaY)) return;

      if (isHorizontalScrollTrap(el) || (el !== root && isYScrollPort(el))) {
        // Горизонтальная ловушка, редактор без переполнения или уже у края
        e.preventDefault();
        scroller.scrollTop += e.deltaY;
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
