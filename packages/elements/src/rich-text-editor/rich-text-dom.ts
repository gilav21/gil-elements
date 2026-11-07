import { holdsNothing, lastOwnInlineNode } from './rich-text-lines.js';

const ZERO_WIDTH = '​';
const NBSP = ' ';
const PLACEHOLDER_ONLY = /^[ ​]*$/;

/** Elements that legitimately contain block children, so a paste inside one needs no split. */
export const BLOCK_CONTAINER_TAGS: ReadonlySet<string> = new Set(['TD', 'TH', 'LI', 'BLOCKQUOTE', 'DETAILS', 'FIGURE']);

/**
 * Blocks a paste of block content must escape by splitting. Disjoint from
 * BLOCK_CONTAINER_TAGS: the container set is tested first and wins.
 */
export const BLOCK_TAGS: ReadonlySet<string> = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'PRE', 'TABLE', 'HR',
]);

/**
 * Everything that owns a line, containers included. Where a bare run of inline
 * content ENDS, a blockquote is a boundary, so the narrower BLOCK_TAGS will not do.
 */
export const LINE_OWNING_TAGS: ReadonlySet<string> = new Set([...BLOCK_TAGS, ...BLOCK_CONTAINER_TAGS]);

function select(selection: Selection, range: Range): void {
    selection.removeAllRanges();
    selection.addRange(range);
}

export function setSelectionRange(selection: Selection, node: Node, offset: number): void {
    const range = new Range();
    range.setStart(node, offset);
    range.collapse(true);
    select(selection, range);
}

/** Collapses the caret to the end of a text node, or just after any other node. */
export function setSelectionAtNodeEnd(selection: Selection, target: Node): void {
    const range = new Range();
    if (target.nodeType === Node.TEXT_NODE) {
        range.setStart(target, (target as Text).length);
    } else {
        range.setStartAfter(target);
    }
    range.collapse(true);
    select(selection, range);
}

/** Nearest inclusive ancestor of `start` with the tag, stopping before `stopAt`. */
export function findAncestorByTag(start: Node, tagName: string, stopAt: Node | null = null): HTMLElement | null {
    for (let node: Node | null = start; node && node !== stopAt; node = node.parentNode) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === tagName) return node as HTMLElement;
    }
    return null;
}

export function lastTextNodeIn(root: Element): Text | null {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let last: Text | null = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) last = node as Text;
    return last;
}

/**
 * The `<br>` that ends the block, when it is the last meaningful child. Shift+Enter
 * inserts a `<br>`, not a newline, so a block's exit check cannot look in textContent.
 */
export function trailingBreakIn(root: Node): HTMLBRElement | null {
    for (let node = root.lastChild; node; node = node.previousSibling) {
        if (node.nodeType === Node.TEXT_NODE && !(node as Text).data.trim()) continue;
        return node.nodeName === 'BR' ? (node as HTMLBRElement) : null;
    }
    return null;
}

/** The last text node in `element` showing a character other than caret padding. */
export function lastShownText(element: Element): Text | null {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let found: Text | null = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!PLACEHOLDER_ONLY.test((node as Text).data)) found = node as Text;
    }
    return found;
}

export function getDeepestLastNode(block: Node): Node {
    let target = block;
    while (target.lastChild) target = target.lastChild;
    return target;
}

/** The block's last zero-width anchor, creating one at its start when it has none. */
export function ensureZeroWidthTextNode(block: HTMLElement): Text {
    const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let anchor: Text | null = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if ((node as Text).data.includes(ZERO_WIDTH)) anchor = node as Text;
    }
    if (anchor) return anchor;
    const created = block.ownerDocument.createTextNode(ZERO_WIDTH);
    block.insertBefore(created, block.firstChild);
    return created;
}

/**
 * The text node a caret at the start of a block sits in: its first one when it
 * has any, otherwise a zero-width anchor, since browsers will not put a caret in
 * a zero-length text node or a block holding only a `<br>`.
 */
export function emptyBlockCaretTarget(block: HTMLElement): Text {
    const existing = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT).nextNode() as Text | null;
    if (existing?.data) return existing;
    if (existing) {
        existing.data = ZERO_WIDTH;
        return existing;
    }
    // A block holding only an image or rule has no text node; clearing it would delete the image.
    if (holdsNothing(block)) block.replaceChildren();
    return block.insertBefore(block.ownerDocument.createTextNode(ZERO_WIDTH), block.firstChild);
}

/** Caret at the end of what the line shows, not after its first text node. */
export function placeCaretAtEndOf(selection: Selection, element: Element): void {
    const range = new Range();
    const last = lastShownText(element);
    if (last) {
        range.setStart(last, last.data.length);
    } else if (holdsNothing(element)) {
        const target = emptyBlockCaretTarget(element as HTMLElement);
        range.setStart(target, target.data.length);
    } else {
        range.setStart(element, element.childNodes.length);
    }
    range.collapse(true);
    select(selection, range);
}

export function placeCaretAtEndOfBlock(selection: Selection, block: HTMLElement): void {
    if (holdsNothing(block)) {
        setSelectionAtNodeEnd(selection, ensureZeroWidthTextNode(block));
        return;
    }
    // The block's own line, not a sub-list, table or code block nested at its end.
    setSelectionAtNodeEnd(selection, lastOwnInlineNode(block) ?? getDeepestLastNode(block));
}

/**
 * Caret where the author continues typing in a block a rule just built: before
 * its own text, or after the zero-width anchor when it has none.
 */
export function placeCaretAtStartOfBlock(selection: Selection, block: HTMLElement): void {
    const target = emptyBlockCaretTarget(block);
    const afterAnchor = holdsNothing(block) && !target.data.includes(NBSP);
    setSelectionRange(selection, target, afterAnchor ? target.data.length : 0);
}

/** Child indices leading from `root` to `node`; empty when `node` is `root` or outside it. */
export function getNodePath(root: Node, node: Node): number[] {
    const path: number[] = [];
    for (let current: Node = node; current !== root; ) {
        const parent: Node | null = current.parentNode;
        if (!parent) return [];
        path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
        current = parent;
    }
    return path;
}

export function resolveNodePath(root: Node, path: readonly number[]): Node | null {
    let current: Node | null = root;
    for (const index of path) {
        current = current?.childNodes.item(index) ?? null;
        if (!current) return null;
    }
    return current;
}

export function clampNodeOffset(node: Node, offset: number): number {
    const max = node.nodeType === Node.TEXT_NODE ? (node.textContent?.length ?? 0) : node.childNodes.length;
    return Math.max(0, Math.min(offset, max));
}

/** The last child element of `parent` with the tag, or null. */
export function lastChildTagged(parent: Element, tagName: string): Element | null {
    for (let child = parent.lastElementChild; child; child = child.previousElementSibling) {
        if (child.nodeName === tagName) return child;
    }
    return null;
}

/** How many zero-width anchors sit before `offset` in `text`. */
export function countZeroWidthBefore(text: string, offset: number): number {
    return Array.from(text.slice(0, offset)).filter((ch) => ch === ZERO_WIDTH).length;
}

/** Where `offset` in `node` lands once the node's zero-width anchors are swept; `before` maps text nodes to their pre-sweep data. */
export function offsetAfterSweep(node: Node, offset: number, before: ReadonlyMap<Text, string>): number {
    const original = before.get(node as Text);
    if (original === undefined) return offset;
    return Math.max(0, offset - countZeroWidthBefore(original, offset));
}
