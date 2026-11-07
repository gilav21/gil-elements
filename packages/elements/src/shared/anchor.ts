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

function intersect(a: DOMRect, b: DOMRect): DOMRect {
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    return new DOMRect(left, top, Math.max(0, Math.min(a.right, b.right) - left), Math.max(0, Math.min(a.bottom, b.bottom) - top));
}

/**
 * The part of the screen where `element` can actually be seen: the viewport narrowed by every ancestor that clips
 * its overflow. The viewport is always part of it, because a clipping ancestor can be far larger than the screen
 * (a page whose `body` has `overflow-x: clip` is as tall as the whole page).
 */
export function clippingRect(element: Element): DOMRect {
    const view = element.ownerDocument.defaultView;
    let visible = new DOMRect(0, 0, view?.innerWidth ?? 0, view?.innerHeight ?? 0);
    for (let parent = flatParent(element); parent && parent !== element.ownerDocument.documentElement; parent = flatParent(parent)) {
        const style = view?.getComputedStyle(parent);
        if (style && (CLIPS.test(style.overflowX) || CLIPS.test(style.overflowY))) visible = intersect(visible, parent.getBoundingClientRect());
    }
    return visible;
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

/** How far to move an overflowing panel along y to leave {@link EDGE_GAP} to the edge; the top edge wins when it cannot fit. A panel that fits is left alone. */
export function verticalNudge(panel: DOMRect, bounds: DOMRect): number {
    const down = bounds.top + EDGE_GAP - panel.top;
    if (panel.top < bounds.top) return down;
    // Moving up never goes past the point where the top edge meets the gap: a panel taller than the screen keeps its start.
    return panel.bottom > bounds.bottom ? Math.max(bounds.bottom - EDGE_GAP - panel.bottom, down) : 0;
}

/**
 * {@link flippedSide} for a panel hung from a point in the viewport. When it overflows it also flips if neither side
 * fits but the opposite one is roomier, because the clamp that follows would otherwise pin it over its trigger.
 * `offset` is the gap between the trigger and the panel.
 */
export function flippedSideByRoom(side: 'top' | 'bottom', panel: DOMRect, anchor: DOMRect, bounds: DOMRect, offset: number): 'top' | 'bottom' {
    const overflows = side === 'bottom' ? panel.bottom > bounds.bottom : panel.top < bounds.top;
    if (!overflows) return side;
    const below = bounds.bottom - anchor.bottom;
    const above = anchor.top - bounds.top;
    const [here, there] = side === 'bottom' ? [below, above] : [above, below];
    return there >= panel.height + offset || there > here ? (side === 'bottom' ? 'top' : 'bottom') : side;
}
