/** True where the OS asks for less motion; false where `matchMedia` does not exist (SSR), so callers animate as normal. */
export function prefersReducedMotion(): boolean {
    return globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
