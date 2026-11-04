import { isTouchDevice } from './touch.js';

export type HintSide = 'top' | 'bottom' | 'left' | 'right';

const HOVER_DELAY_MS = 200;
const TOUCH_DISMISS_MS = 2500;
const EDGE = 8;

/** The bubble of a hint: a plain element in `document.body`, so it escapes every `overflow: hidden` ancestor and shadow tree. */
const BUBBLE_STYLE = [
    'position:fixed',
    'z-index:50',
    'width:max-content',
    'max-width:calc(100vw - 2rem)',
    'overflow-wrap:break-word',
    'border-radius:calc(var(--radius) - 2px)',
    'background-color:var(--primary)',
    'color:var(--primary-foreground)',
    'padding:0.375rem 0.75rem',
    'font-family:var(--font-sans, inherit)',
    'font-size:0.75rem',
    'line-height:calc(1 / 0.75)',
    'pointer-events:none',
].join(';');

interface Options {
    /** The text, read each time the hint opens. */
    text: () => string;
    side: () => HintSide;
    /** Suppresses opening; an open hint is not closed by it. */
    disabled: () => boolean;
}

/**
 * A plain-text tooltip for one element that, unlike `ge-tooltip`, escapes clipping ancestors: the bubble lives in
 * `document.body` and is placed with fixed coordinates. It opens after a 200ms hover dwell (a tap toggles it on a
 * touch screen, then it dismisses itself), flips to the opposite side when it would overflow and is kept 8px inside
 * the viewport. Returns a function that removes the listeners and any open bubble.
 */
export function attachHint(target: HTMLElement, options: Options): () => void {
    let bubble: HTMLElement | null = null;
    let hoverTimer: ReturnType<typeof setTimeout> | undefined;
    let dismissTimer: ReturnType<typeof setTimeout> | undefined;

    const hide = () => {
        clearTimeout(hoverTimer);
        clearTimeout(dismissTimer);
        document.removeEventListener('touchstart', onOutsideTouch, true);
        bubble?.remove();
        bubble = null;
    };
    const show = () => {
        if (bubble) return;
        bubble = document.createElement('div');
        bubble.setAttribute('style', BUBBLE_STYLE);
        bubble.textContent = options.text();
        document.body.append(bubble);
        const position = place(target.getBoundingClientRect(), bubble.getBoundingClientRect(), options.side());
        bubble.style.top = `${position.top}px`;
        bubble.style.left = `${position.left}px`;
    };
    const onOutsideTouch = (event: Event) => {
        if (!event.composedPath().includes(target)) hide();
    };
    const onEnter = () => {
        if (options.disabled() || isTouchDevice()) return;
        hoverTimer = setTimeout(show, HOVER_DELAY_MS);
    };
    const onLeave = () => {
        if (!isTouchDevice()) hide();
    };
    const onTouch = () => {
        if (options.disabled() || !isTouchDevice()) return;
        if (bubble) {
            hide();
            return;
        }
        show();
        dismissTimer = setTimeout(hide, TOUCH_DISMISS_MS);
        document.addEventListener('touchstart', onOutsideTouch, true);
    };

    target.addEventListener('mouseenter', onEnter);
    target.addEventListener('mouseleave', onLeave);
    target.addEventListener('touchstart', onTouch, { passive: true });
    return () => {
        hide();
        target.removeEventListener('mouseenter', onEnter);
        target.removeEventListener('mouseleave', onLeave);
        target.removeEventListener('touchstart', onTouch);
    };
}

function around(side: HintSide, host: DOMRect, bubble: DOMRect): { top: number; left: number } {
    const centeredLeft = host.left + (host.width - bubble.width) / 2;
    const centeredTop = host.top + (host.height - bubble.height) / 2;
    if (side === 'top') return { top: host.top - bubble.height - EDGE, left: centeredLeft };
    if (side === 'bottom') return { top: host.bottom + EDGE, left: centeredLeft };
    if (side === 'left') return { top: centeredTop, left: host.left - bubble.width - EDGE };
    return { top: centeredTop, left: host.right + EDGE };
}

/** Preferred side first; the opposite side when that one overflows; then clamped into the viewport. */
function place(host: DOMRect, bubble: DOMRect, preferred: HintSide): { top: number; left: number } {
    const { innerWidth, innerHeight } = globalThis;
    let side = preferred;
    let position = around(side, host, bubble);
    if (side === 'top' && position.top < 0) side = 'bottom';
    else if (side === 'bottom' && position.top + bubble.height > innerHeight) side = 'top';
    else if (side === 'left' && position.left < 0) side = 'right';
    else if (side === 'right' && position.left + bubble.width > innerWidth) side = 'left';
    position = around(side, host, bubble);
    return {
        top: Math.max(EDGE, Math.min(innerHeight - bubble.height - EDGE, position.top)),
        left: Math.max(EDGE, Math.min(innerWidth - bubble.width - EDGE, position.left)),
    };
}
