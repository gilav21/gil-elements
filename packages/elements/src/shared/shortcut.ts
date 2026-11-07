/** Whether `event` is the key combination `shortcut` names, such as `Mod+K`; `Mod` is Command on a Mac and Control elsewhere. */
export function matchesShortcut(event: KeyboardEvent, shortcut: string, mac: boolean): boolean {
    const parts = shortcut.toLowerCase().split('+').map((part) => part.trim());
    const key = parts.pop();
    const wants = (name: string) => parts.includes(name);
    const mod = wants('mod');
    const meta = wants('meta') || (mod && mac);
    const ctrl = wants('ctrl') || wants('control') || (mod && !mac);
    return event.key.toLowerCase() === key && event.metaKey === meta && event.ctrlKey === ctrl && event.altKey === wants('alt') && event.shiftKey === wants('shift');
}

/** Whether this machine is a Mac, which is what `Mod` means. */
export function isMacPlatform(): boolean {
    return /mac|iphone|ipad/i.test(globalThis.navigator?.platform ?? '');
}

/** Whether a key event came from somewhere text is typed. */
export function isEditable(target: EventTarget | null): boolean {
    const el = (target as HTMLElement | null)?.closest?.('input,textarea,select,[contenteditable]');
    return !!el || (target as HTMLElement | null)?.isContentEditable === true;
}
