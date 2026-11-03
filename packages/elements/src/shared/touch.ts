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
