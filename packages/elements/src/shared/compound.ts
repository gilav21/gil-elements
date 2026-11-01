/** What a child sends up the tree to find the parent it belongs to; the parent fills in `parent`. */
export interface ParentRequest<Parent, Child> {
    child: Child;
    parent?: Parent;
}

/**
 * A child asks the nearest ancestor that listens for `eventName` to adopt it. The event is composed, so the
 * parent is found through shadow boundaries too, and children may be written as plain children, rendered from
 * data or wrapped in other elements. Returns the parent, or `undefined` when the child stands alone.
 */
export function findParent<Parent, Child extends HTMLElement>(child: Child, eventName: string): Parent | undefined {
    const request: ParentRequest<Parent, Child> = { child };
    child.dispatchEvent(new CustomEvent(eventName, { detail: request, bubbles: true, composed: true }));
    return request.parent;
}

/** The parent's half: answer requests for `eventName`, stop them reaching an outer parent, and hand the child over. */
export function adoptChildren<Parent, Child extends HTMLElement>(
    parent: Parent & HTMLElement,
    eventName: string,
    adopt: (child: Child) => void,
): void {
    parent.addEventListener(eventName, ((event: CustomEvent<ParentRequest<Parent, Child>>) => {
        event.stopPropagation();
        event.detail.parent = parent;
        adopt(event.detail.child);
    }) as EventListener);
}

/** `a` before `b` in document order, for children registered in whatever order they connected. */
export function byDocumentOrder(a: Node, b: Node): number {
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}
