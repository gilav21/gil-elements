import css from './presets.css?inline';

/** A mounted top-layer overlay: its fixed-position host (for anchoring) and the function that removes it. */
export interface MountedOverlay {
    readonly host: HTMLElement;
    destroy(): void;
}

let sheet: CSSStyleSheet | undefined;

function adoptPresetStyles(doc: Document): void {
    sheet ??= new CSSStyleSheet();
    if (sheet.cssRules.length === 0) sheet.replaceSync(css);
    if (!doc.adoptedStyleSheets.includes(sheet)) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
}

/**
 * Mounts `content` in the native top layer, above any modal the editor lives inside, and returns the
 * fixed-position host to anchor. The preset stylesheet is adopted onto the document once.
 */
export function mountTopLayer(content: HTMLElement): MountedOverlay {
    adoptPresetStyles(document);
    const host = document.createElement('div');
    host.className = 'preset-overlay';
    host.setAttribute('popover', 'manual');
    host.append(content);
    document.body.append(host);
    const popover = host as HTMLElement & { showPopover?: () => void; hidePopover?: () => void };
    popover.showPopover?.();
    return {
        host,
        destroy: () => {
            popover.hidePopover?.();
            host.remove();
        },
    };
}

/** The resolved text direction of an element, so top-layer overlays (detached from its subtree) can mirror the anchored content. */
export function directionOf(el: HTMLElement): 'ltr' | 'rtl' {
    return el.ownerDocument.defaultView?.getComputedStyle(el).direction === 'rtl' ? 'rtl' : 'ltr';
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Positions a mounted overlay near an anchor, kept inside the viewport: clamped horizontally, and
 * flipped above the anchor when there is no room below. The overlay must already be in the DOM so it can be measured.
 */
export function anchorOverlay(overlayHost: HTMLElement, anchor: HTMLElement, gap = 6): void {
    const rect = anchor.getBoundingClientRect();
    const size = overlayHost.getBoundingClientRect();
    const { clientWidth, clientHeight } = overlayHost.ownerDocument.documentElement;
    const margin = 8;

    const left = clamp(rect.left, margin, clientWidth - size.width - margin);
    const below = rect.bottom + gap;
    const noRoomBelow = below + size.height > clientHeight - margin;
    const canFlip = rect.top - gap - size.height >= margin;
    const top = noRoomBelow && canFlip
        ? rect.top - gap - size.height
        : clamp(below, margin, clientHeight - size.height - margin);

    overlayHost.style.left = `${Math.round(left)}px`;
    overlayHost.style.top = `${Math.round(top)}px`;
}
