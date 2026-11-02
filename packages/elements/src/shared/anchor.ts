/**
 * What popovers, tooltips and hover cards share: finding the box a panel must stay inside, and deciding how far
 * to nudge or whether to flip it. The panel itself is positioned by CSS (`position: absolute` against its host);
 * this only measures after render and returns the correction.
 */

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Align = 'start' | 'center' | 'end';

/** The 8px kept between a nudged panel and the edge it was nudged away from. */
export const EDGE_GAP = 8;

/** The parent in the flat (composed) tree: a slotted node's parent is its slot, a shadow root's is its host. */
function flatParent(node: Element): Element | null {
    if (node.assignedSlot) return node.assignedSlot;
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
}

const CLIPS = /^(hidden|auto|scroll|clip)$/;

/** The box that clips `element`: the nearest ancestor with overflow other than visible, else the viewport. */
export function clippingRect(element: Element): DOMRect {
    const view = element.ownerDocument.defaultView;
    for (let parent = flatParent(element); parent && parent !== element.ownerDocument.documentElement; parent = flatParent(parent)) {
        const style = view?.getComputedStyle(parent);
        if (style && (CLIPS.test(style.overflowX) || CLIPS.test(style.overflowY))) return parent.getBoundingClientRect();
    }
    return new DOMRect(0, 0, view?.innerWidth ?? 0, view?.innerHeight ?? 0);
}

/** How far to move a panel along x so it ends up inside `bounds`, with {@link EDGE_GAP} to spare. */
export function horizontalNudge(panel: DOMRect, bounds: DOMRect): number {
    if (panel.right > bounds.right) return bounds.right - panel.right - EDGE_GAP;
    if (panel.left < bounds.left) return bounds.left - panel.left + EDGE_GAP;
    return 0;
}

/**
 * The side a vertical panel should open on: its preferred one unless that overflows and the opposite one has
 * room for the whole panel. `anchor` is the trigger's box.
 */
export function flippedSide(side: 'top' | 'bottom', panel: DOMRect, anchor: DOMRect, bounds: DOMRect): 'top' | 'bottom' {
    if (side === 'bottom' && panel.bottom > bounds.bottom && anchor.top - bounds.top >= panel.height) return 'top';
    if (side === 'top' && panel.top < bounds.top && bounds.bottom - anchor.bottom >= panel.height) return 'bottom';
    return side;
}
