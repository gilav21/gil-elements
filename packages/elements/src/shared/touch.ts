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
