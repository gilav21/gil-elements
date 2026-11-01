/**
 * What every modal overlay shares: a stack so Escape reaches only the innermost layer, a page scroll lock that
 * stays on until the last modal closes, and a Tab trap that works through shadow roots and slots.
 */

export interface OverlayLayer {
    readonly dismiss: () => void;
    readonly modal: boolean;
}

interface Saved {
    readonly overflowX: string;
    readonly overflowY: string;
    readonly paddingRight: string;
}

interface Stack {
    readonly layers: OverlayLayer[];
    saved: Saved | null;
}

// One stack per document even if the library is bundled twice.
const KEY = Symbol.for('@gilav21/elements/overlay-stack@1');
type Holder = Document & { [KEY]?: Stack };

function stackOf(doc: Document): Stack {
    const holder = doc as Holder;
    holder[KEY] ??= { layers: [], saved: null };
    return holder[KEY];
}

function lockPage(doc: Document, stack: Stack): void {
    const style = doc.body.style;
    stack.saved = {
        overflowX: style.getPropertyValue('overflow-x'),
        overflowY: style.getPropertyValue('overflow-y'),
        paddingRight: style.getPropertyValue('padding-right'),
    };
    // Measured before overflow is hidden: hiding the scrollbar changes the width.
    const win = doc.defaultView;
    const scrollbar = win ? Math.max(0, win.innerWidth - doc.documentElement.clientWidth) : 0;
    const padding = scrollbar > 0 && win ? Number.parseFloat(win.getComputedStyle(doc.body).paddingRight) || 0 : 0;
    style.setProperty('overflow', 'hidden');
    if (scrollbar > 0) style.setProperty('padding-right', `${padding + scrollbar}px`);
}

function unlockPage(doc: Document, stack: Stack): void {
    const saved = stack.saved;
    if (!saved) return;
    const style = doc.body.style;
    // Longhands, so a consumer's own overflow-y survives; the shorthand the lock set goes first.
    style.removeProperty('overflow');
    style.setProperty('overflow-x', saved.overflowX);
    style.setProperty('overflow-y', saved.overflowY);
    style.setProperty('padding-right', saved.paddingRight);
    stack.saved = null;
}

function syncLock(doc: Document, stack: Stack): void {
    const shouldLock = stack.layers.some((layer) => layer.modal);
    if (shouldLock && !stack.saved) lockPage(doc, stack);
    else if (!shouldLock) unlockPage(doc, stack);
}

const listeners = new WeakMap<Document, (event: KeyboardEvent) => void>();

function onEscape(doc: Document, event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
    const stack = stackOf(doc);
    const top = stack.layers.at(-1);
    if (!top) return;
    event.preventDefault();
    // Removed before dismiss runs, so a dismiss that opens another overlay starts from a clean stack.
    release(doc, top);
    top.dismiss();
}

function release(doc: Document, layer: OverlayLayer): void {
    const stack = stackOf(doc);
    const index = stack.layers.indexOf(layer);
    if (index !== -1) stack.layers.splice(index, 1);
    const listener = listeners.get(doc);
    if (stack.layers.length === 0 && listener) {
        doc.removeEventListener('keydown', listener);
        listeners.delete(doc);
    }
    syncLock(doc, stack);
}

/** Puts `layer` on top of the stack. Returns the function that takes it off again. */
export function registerLayer(layer: OverlayLayer, doc: Document = document): () => void {
    const stack = stackOf(doc);
    const index = stack.layers.indexOf(layer);
    if (index !== -1) stack.layers.splice(index, 1);
    stack.layers.push(layer);
    if (!listeners.has(doc)) {
        const listener = (event: KeyboardEvent) => onEscape(doc, event);
        listeners.set(doc, listener);
        doc.addEventListener('keydown', listener);
    }
    syncLock(doc, stack);
    return () => release(doc, layer);
}

const CANDIDATES = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex],[contenteditable]:not([contenteditable="false"]),audio[controls],video[controls]';

function isTabStop(el: HTMLElement): boolean {
    if (el.matches(':disabled') || el.closest('[inert]')) return false;
    const explicit = el.getAttribute('tabindex');
    return explicit === null || Number.parseInt(explicit, 10) >= 0;
}

/** Walks the flat tree: into shadow roots, and through slots to what is assigned to them. */
function collect(node: ParentNode, out: HTMLElement[]): void {
    for (const child of node.children) {
        if (child instanceof HTMLSlotElement) {
            const assigned = child.assignedElements({ flatten: true });
            if (assigned.length === 0) collect(child, out);
            for (const el of assigned) visit(el as HTMLElement, out);
            continue;
        }
        visit(child as HTMLElement, out);
    }
}

function visit(el: HTMLElement, out: HTMLElement[]): void {
    // A host that delegates focus is not a stop itself: the control inside its shadow root is.
    if (el.shadowRoot) collect(el.shadowRoot, out);
    else if (el.matches(CANDIDATES) && isTabStop(el)) out.push(el);
    if (!el.shadowRoot) collect(el, out);
}

/** The elements Tab can land on inside `container`, in tab order, looking through shadow roots and slots. */
export function tabStops(container: ParentNode): HTMLElement[] {
    const out: HTMLElement[] = [];
    collect(container, out);
    return out;
}

/** The focused element, looking through shadow roots. */
export function deepActive(doc: Document = document): Element | null {
    let active = doc.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
}

/** Moves focus to the first tab stop in `container`, or to `fallback` when there is none. */
export function focusFirst(container: ParentNode, fallback: HTMLElement): void {
    (tabStops(container)[0] ?? fallback).focus();
}

/** Keeps Tab and Shift+Tab inside `container`, wrapping at both ends. `panel` holds focus when nothing inside is tabbable. */
export function trapTab(event: KeyboardEvent, container: ParentNode, panel: HTMLElement): void {
    if (event.key !== 'Tab') return;
    const stops = tabStops(container);
    if (stops.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
    }
    const first = stops[0]!;
    const last = stops.at(-1) ?? first;
    const active = deepActive();
    const inside = active !== null && stops.includes(active as HTMLElement);
    if (!inside || (!event.shiftKey && active === last)) {
        // Focus that is on the panel itself (before any stop) goes forward to the first stop; past the end wraps.
        if (event.shiftKey && active === panel) {
            event.preventDefault();
            last.focus();
            return;
        }
        event.preventDefault();
        first.focus();
    } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
    }
}

/**
 * Focus handling every modal shares: remember where focus was, move it into the panel on open, hold it there
 * (Tab wraps), and give it back on close.
 */
export class ModalFocus {
    private returnTo?: HTMLElement;

    async enter(panel: HTMLElement): Promise<void> {
        const previous = deepActive();
        this.returnTo = previous instanceof HTMLElement ? previous : undefined;
        // Elements the panel generated have not rendered their controls yet; there is nothing to focus until they have.
        const pending = [...panel.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')].map((el) => el.updateComplete);
        await Promise.all(pending);
        if (panel.isConnected) focusFirst(panel, panel);
    }

    leave(): void {
        this.returnTo?.focus();
        this.returnTo = undefined;
    }

    readonly trap = (event: KeyboardEvent): void => {
        const panel = event.currentTarget as HTMLElement;
        trapTab(event, panel, panel);
    };
}
