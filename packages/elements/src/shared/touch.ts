/** True when the primary pointer is coarse (a finger), where hover previews would only leave stale state behind. */
export function isTouchDevice(): boolean {
    return globalThis.window?.matchMedia?.('(pointer: coarse)').matches ?? false;
}

/**
 * Calls `callback` once the user has held one finger down for `duration` ms without moving more than 10px.
 * More than one finger means pan and zoom, so a second finger cancels a pending press and none starts while it is down.
 *
 * @returns A function that removes every listener.
 */
export function onLongPress(element: HTMLElement, callback: (event: TouchEvent) => void, duration = 500): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    // A copy, not the live `Touch`: only the point the finger started at matters.
    let start: { clientX: number; clientY: number } | null = null;

    const cancel = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        start = null;
    };
    const onStart = (event: TouchEvent) => {
        // Clear first: `touchstart` fires again for every finger that joins, and a fresh timer over a pending one would leak it.
        cancel();
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        if (!touch) return;
        start = { clientX: touch.clientX, clientY: touch.clientY };
        timer = setTimeout(() => {
            timer = null;
            callback(event);
        }, duration);
    };
    const onMove = (event: TouchEvent) => {
        if (!start || !timer) return;
        if (event.touches.length !== 1) {
            cancel();
            return;
        }
        const touch = event.touches[0];
        if (touch && Math.hypot(touch.clientX - start.clientX, touch.clientY - start.clientY) > 10) cancel();
    };

    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchmove', onMove, { passive: true });
    element.addEventListener('touchend', cancel, { passive: true });
    element.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
        cancel();
        element.removeEventListener('touchstart', onStart);
        element.removeEventListener('touchmove', onMove);
        element.removeEventListener('touchend', cancel);
        element.removeEventListener('touchcancel', cancel);
    };
}

/** One context gesture, however it was made. */
export interface ContextGesture {
    readonly target: Element;
    readonly clientX: number;
    readonly clientY: number;
    /** The `contextmenu` event, or the long-press's `touchstart`. */
    readonly source: MouseEvent | TouchEvent;
    /**
     * Whether a finger made it: a long-press, or the `contextmenu` a browser
     * raises for one. A right-click and the keyboard key are not.
     */
    readonly viaTouch: boolean;
}

/**
 * Whether a `contextmenu` event is a finger's. A browser that types it says so.
 * One that does not (a plain `MouseEvent`: Firefox, older Chromium) cannot, and
 * is taken for a finger's only when a finger was on this element a moment ago -
 * a right-click with no touch before it is a mouse's.
 */
function isTouchContextMenu(event: MouseEvent, touchedRecently: boolean): boolean {
    // jsdom before 22 (jest 29's) has no PointerEvent at all.
    const typed = typeof PointerEvent !== 'undefined' && event instanceof PointerEvent;
    return typed ? event.pointerType === 'touch' : touchedRecently;
}

/**
 * Where a mouse event or a touch event happened, in viewport coordinates. For
 * reading the `event` a context-menu directive hands back, which is the
 * `contextmenu` of a right-click or the `touchstart` of a long-press.
 */
export function pointOf(event: MouseEvent | TouchEvent): { readonly x: number; readonly y: number } {
    const source = 'touches' in event ? (event.touches[0] ?? event.changedTouches[0]) : event;
    return { x: source?.clientX ?? 0, y: source?.clientY ?? 0 };
}

/**
 * Calls `handler` once per context gesture on `element`: a right-click, the
 * keyboard context-menu key, or a one-finger long-press. Return `true` when you
 * acted on it — the gesture is then claimed: the native menu is suppressed,
 * ancestor `onContextGesture` handlers for the same gesture are skipped, and the
 * `contextmenu` a platform raises after a long-press (Android) is swallowed.
 * @returns cleanup
 */
export function onContextGesture(
    element: HTMLElement,
    handler: (gesture: ContextGesture) => boolean,
    duration = 500,
): () => void {
    const touch = trackContextTouch();

    const onPress = (event: TouchEvent): void => {
        if (touch.dragged || claimedGestures.has(event)) return;
        const finger = event.touches[0] ?? event.changedTouches[0];
        if (!finger) return;
        const target = (event.target as Element | null) ?? element;
        // The browser's own hold timer can beat ours: its contextmenu already answered this press.
        if (isRecentSameGesture(lastClaimedContext, target)) return;
        if (!handler({ target, clientX: finger.clientX, clientY: finger.clientY, source: event, viaTouch: true })) return;
        claimedGestures.add(event);
        lastClaimedPress = { at: Date.now(), target };
        swallowReleaseClick(target);
    };

    const onContextMenu = (event: MouseEvent): void => {
        if (claimedGestures.has(event)) return;
        const viaTouch = isTouchContextMenu(event, touch.touchedRecently);
        // A mouse right-click is never the echo of a finger, whatever the finger did a moment ago.
        if (viaTouch && (touch.panGuess || isRecentSameGesture(lastClaimedPress, event.target as Node | null))) {
            claim(event);
            return;
        }
        const target = event.target as Element;
        if (!handler({ target, clientX: event.clientX, clientY: event.clientY, source: event, viaTouch })) return;
        claim(event);
        if (viaTouch) lastClaimedContext = { at: Date.now(), target };
    };

    const stopLongPress = onLongPress(element, onPress, duration);
    element.addEventListener('touchstart', touch.onStart, { passive: true });
    element.addEventListener('touchmove', touch.onMove, { passive: true });
    element.addEventListener('dragstart', touch.onDragStart);
    element.addEventListener('contextmenu', onContextMenu);

    return () => {
        stopLongPress();
        element.removeEventListener('touchstart', touch.onStart);
        element.removeEventListener('touchmove', touch.onMove);
        element.removeEventListener('dragstart', touch.onDragStart);
        element.removeEventListener('contextmenu', onContextMenu);
    };
}

/**
 * What `onContextGesture` needs to know about the finger beyond the hold itself:
 * whether this touch has become a pan (so a browser `contextmenu` that follows is
 * its own long-press guess, not a menu request) and whether the browser took the
 * target for a drag.
 */
function trackContextTouch(): {
    readonly onStart: (event: TouchEvent) => void;
    readonly onMove: (event: TouchEvent) => void;
    readonly onDragStart: () => void;
    readonly panGuess: boolean;
    readonly touchedRecently: boolean;
    readonly dragged: boolean;
} {
    let origin: { readonly x: number; readonly y: number } | null = null;
    let travelled = false;
    let lastTouchAt = 0;
    let dragged = false;

    return {
        onStart: (event: TouchEvent): void => {
            lastTouchAt = Date.now();
            const finger = event.touches[0];
            if (event.touches.length !== 1 || !finger) {
                // A second finger is pan and zoom: the gesture is spent until every finger is up.
                travelled = true;
                origin = null;
                return;
            }
            origin = { x: finger.clientX, y: finger.clientY };
            travelled = false;
            dragged = false;
        },
        onMove: (event: TouchEvent): void => {
            lastTouchAt = Date.now();
            const finger = event.touches[0];
            const multiTouch = event.touches.length !== 1 || !finger;
            const strayed = !!finger && !!origin && Math.hypot(finger.clientX - origin.x, finger.clientY - origin.y) > CONTEXT_SLOP_PX;
            if (multiTouch || strayed) travelled = true;
        },
        // A draggable target may be picked up by the browser instead; that hold is a drag, not a press.
        onDragStart: (): void => {
            dragged = true;
        },
        get panGuess() {
            return travelled && Date.now() - lastTouchAt < SAME_GESTURE_MS;
        },
        get touchedRecently() {
            return lastTouchAt > 0 && Date.now() - lastTouchAt < SAME_GESTURE_MS;
        },
        get dragged() {
            return dragged;
        },
    };
}

/**
 * How long after a claimed long-press a `contextmenu` is taken to be the same
 * gesture, and how long after a pan a browser `contextmenu` is taken to be its
 * own long-press guess.
 *
 * Android raises `contextmenu` for a held finger as well; iOS does not. Without
 * a window the menu opens twice on one platform and not at all on the other.
 */
const SAME_GESTURE_MS = 700;

/** How far a finger may travel and still count as held: the 10px `onLongPress` allows. */
const CONTEXT_SLOP_PX = 10;

/** Gestures an inner target already answered; ancestors skip them. */
const claimedGestures = new WeakSet<Event>();

interface ClaimedAt {
    readonly at: number;
    readonly target: Node;
}

/** The last long-press a handler claimed, so the platform's echo of it can be recognised. */
let lastClaimedPress: ClaimedAt | null = null;

/** The last native contextmenu a handler claimed, so a long-press timer that fires after it is not a second gesture. */
let lastClaimedContext: ClaimedAt | null = null;

/** Whether something landing on `hit` just now is the gesture `claimed` already answered. */
function isRecentSameGesture(claimed: ClaimedAt | null, hit: Node | null): boolean {
    if (!claimed || Date.now() - claimed.at >= SAME_GESTURE_MS) return false;
    return isRelated(claimed.target, hit);
}

/** Whether `hit` is `held`, inside it, or around it: the hit test of one finger lands on any of them. */
function isRelated(held: Node, hit: Node | null): boolean {
    return !hit || held.contains(hit) || hit.contains(held);
}

/** How long after the finger lifts the click of a claimed long-press can still arrive. */
const RELEASE_CLICK_WINDOW_MS = 400;

/** Undoes the release-click guard of the previous claimed long-press, if it is still waiting. */
let cancelReleaseClickGuard: (() => void) | null = null;

/**
 * Keeps the click that follows the release of a claimed long-press from reaching
 * anything: it would close the menu the hold just opened (every outside-click
 * dismissal sees it) or activate the element that was held. iOS raises it, and so
 * does Chromium's touch emulation; Android Chrome does not, and then the listener
 * simply expires.
 *
 * Armed by the release, not by the hold, so a hold that never reports its end
 * cannot leave a listener behind that eats an unrelated click; a newer hold
 * replaces an older guard, so at most one is ever waiting; and it takes only a
 * click that lands on the held element (or inside it, or around it), so a quick
 * tap on a menu item - where no release click follows, as on Android - is never
 * mistaken for it. It sits on `window` in the capture phase, ahead of the
 * document-level listeners the menus use, and takes exactly one click.
 */
function swallowReleaseClick(held: Node): void {
    const win = globalThis.window;
    if (!win) return;
    cancelReleaseClickGuard?.();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const swallow = (event: Event): void => {
        if (!isRelated(held, event.target as Node | null)) return;
        event.stopImmediatePropagation();
        event.preventDefault();
        cancel();
    };
    const onRelease = (): void => {
        win.removeEventListener('touchend', onRelease, true);
        win.removeEventListener('touchcancel', onRelease, true);
        win.addEventListener('click', swallow, true);
        timer = setTimeout(cancel, RELEASE_CLICK_WINDOW_MS);
    };
    function cancel(): void {
        clearTimeout(timer);
        win.removeEventListener('touchend', onRelease, true);
        win.removeEventListener('touchcancel', onRelease, true);
        win.removeEventListener('click', swallow, true);
        if (cancelReleaseClickGuard === cancel) cancelReleaseClickGuard = null;
    }
    cancelReleaseClickGuard = cancel;
    win.addEventListener('touchend', onRelease, true);
    win.addEventListener('touchcancel', onRelease, true);
}

/** Takes the event from the browser and from every other `onContextGesture` handler. */
function claim(event: Event): void {
    claimedGestures.add(event);
    event.preventDefault();
    event.stopPropagation();
}

/**
 * Follows a drag that started elsewhere: calls `onMove` with the pointer position until the button or finger is
 * released, then once `onEnd`. Like shadcn-angular's helper it keeps following the first touch through a pinch.
 *
 * @returns A function that removes every listener.
 */
export function onPointerDrag(
    onMove: (clientX: number, clientY: number, event: MouseEvent | TouchEvent) => void,
    onEnd: (event: MouseEvent | TouchEvent) => void,
): () => void {
    const handleMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY, e);
    const handleTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        if (touch) onMove(touch.clientX, touch.clientY, e);
    };
    const handleEnd = (e: MouseEvent | TouchEvent) => {
        cleanup();
        onEnd(e);
    };
    const cleanup = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleEnd);
        window.removeEventListener('touchcancel', handleEnd);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
    return cleanup;
}
