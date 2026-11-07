/**
 * What every menu shares (dropdown menu now; context menu and menubar later): the focus ring over a panel's own
 * items, arrow-key movement inside it, and the rule that a key activation is a click.
 *
 * A panel is any element with `role="menu"`. Its items are the `role="menuitem"` elements that are not disabled and
 * whose closest `role="menu"` is that panel, so the items of an open submenu stay out of the parent's ring.
 */

export const MENU = '[role="menu"]';

/** The enabled items that belong to `menu` itself. */
export function ownItems(menu: HTMLElement): HTMLElement[] {
    return [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])')].filter((item) => item.closest(MENU) === menu);
}

/** Whether `element` lays out right to left, inherited `dir` included. */
export function isRtl(element: Element): boolean {
    return getComputedStyle(element).direction === 'rtl';
}

/** Focuses the item after (`1`) or before (`-1`) `from`, wrapping. Something that is not in the ring lands on the first or last item. */
export function focusStep(menu: HTMLElement, from: EventTarget | null, step: 1 | -1): void {
    const items = ownItems(menu);
    if (items.length === 0) return;
    const index = items.indexOf(from as HTMLElement);
    const wrapStart = step === 1 ? 0 : items.length - 1;
    const next = index === -1 ? wrapStart : (index + step + items.length) % items.length;
    items[next]?.focus();
}

export interface NavigationOptions {
    /** Tab and Shift+Tab move through the ring too, so the menu cannot be tabbed out of. */
    trapTab?: boolean;
    /** Home and End jump to the first and last item. */
    edges?: boolean;
}

/** Up and Down move through the ring, wrapping. Returns whether the key was handled. */
export function arrowNavigation(event: KeyboardEvent, menu: HTMLElement, { trapTab = false, edges = false }: NavigationOptions = {}): boolean {
    const items = ownItems(menu);
    const step = stepFor(event, trapTab);
    if (step) {
        event.preventDefault();
        focusStep(menu, event.target, step);
        return true;
    }
    if (edges && (event.key === 'Home' || event.key === 'End')) {
        event.preventDefault();
        (event.key === 'Home' ? items[0] : items.at(-1))?.focus();
        return true;
    }
    return false;
}

function stepFor(event: KeyboardEvent, trapTab: boolean): 1 | -1 | 0 {
    if (event.key === 'ArrowDown' || (trapTab && event.key === 'Tab' && !event.shiftKey)) return 1;
    if (event.key === 'ArrowUp' || (trapTab && event.key === 'Tab' && event.shiftKey)) return -1;
    return 0;
}

/**
 * Stops every click on `host` from reaching a listener while `isDisabled()` is true, the consumer's included.
 * `pointer-events: none` only keeps a mouse out; assistive technology and `.click()` ignore it. Capture phase,
 * so it runs before a listener bound on the same element.
 */
export function blockDisabledActivation(host: HTMLElement, isDisabled: () => boolean): () => void {
    const guard = (event: Event) => {
        if (!isDisabled()) return;
        event.stopImmediatePropagation();
        event.preventDefault();
    };
    host.addEventListener('click', guard, { capture: true });
    return () => host.removeEventListener('click', guard, { capture: true });
}

/**
 * Enter or Space on an item is one native click, so a listener bound once runs for pointer and keyboard alike.
 * The default is cancelled (Space would scroll the page). A key that bubbles from a control nested in the item
 * belongs to that control.
 */
export function activateAsClick(event: Event, target: HTMLElement, disabled: boolean): void {
    if (event.target !== target) return;
    event.preventDefault();
    if (!disabled) target.click();
}
