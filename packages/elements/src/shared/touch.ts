/** True when the primary pointer is coarse (a finger), where hover previews would only leave stale state behind. */
export function isTouchDevice(): boolean {
    return globalThis.window?.matchMedia?.('(pointer: coarse)').matches ?? false;
}
