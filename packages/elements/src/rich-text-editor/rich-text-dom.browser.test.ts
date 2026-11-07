import { afterEach, describe, expect, it } from 'vitest';
import {
    BLOCK_CONTAINER_TAGS,
    BLOCK_TAGS,
    LINE_OWNING_TAGS,
    clampNodeOffset,
    countZeroWidthBefore,
    emptyBlockCaretTarget,
    ensureZeroWidthTextNode,
    findAncestorByTag,
    getDeepestLastNode,
    getNodePath,
    lastChildTagged,
    lastShownText,
    lastTextNodeIn,
    offsetAfterSweep,
    placeCaretAtEndOf,
    placeCaretAtEndOfBlock,
    placeCaretAtStartOfBlock,
    resolveNodePath,
    setSelectionAtNodeEnd,
    setSelectionRange,
    trailingBreakIn,
} from './rich-text-dom.js';

const ZW = '​';
const roots: HTMLElement[] = [];

function mount(html: string): HTMLElement {
    const root = document.createElement('div');
    root.contentEditable = 'true';
    root.innerHTML = html;
    document.body.append(root);
    roots.push(root);
    return root;
}

function selectionOf(): Selection {
    const selection = document.getSelection();
    if (!selection) throw new Error('no selection');
    return selection;
}

function caret(): { node: Node | null; offset: number } {
    const selection = selectionOf();
    expect(selection.isCollapsed).toBe(true);
    return { node: selection.anchorNode, offset: selection.anchorOffset };
}

afterEach(() => {
    for (const root of roots.splice(0)) root.remove();
    document.getSelection()?.removeAllRanges();
});

describe('tag sets', () => {
    it('keeps blocks and containers disjoint and the union complete', () => {
        for (const tag of BLOCK_CONTAINER_TAGS) expect(BLOCK_TAGS.has(tag)).toBe(false);
        expect(LINE_OWNING_TAGS.size).toBe(BLOCK_TAGS.size + BLOCK_CONTAINER_TAGS.size);
        expect(LINE_OWNING_TAGS.has('BLOCKQUOTE')).toBe(true);
        expect(LINE_OWNING_TAGS.has('P')).toBe(true);
    });
});

describe('selection setters', () => {
    it('setSelectionRange collapses a caret at the offset, replacing prior ranges', () => {
        const root = mount('<p>hello</p>');
        const text = root.querySelector('p')!.firstChild!;
        selectionOf().selectAllChildren(root);
        setSelectionRange(selectionOf(), text, 2);
        expect(caret()).toEqual({ node: text, offset: 2 });
        expect(selectionOf().rangeCount).toBe(1);
    });

    it('setSelectionAtNodeEnd goes to the end of a text node and after an element', () => {
        const root = mount('<p>hello<b>x</b></p>');
        const p = root.querySelector('p')!;
        setSelectionAtNodeEnd(selectionOf(), p.firstChild!);
        expect(caret()).toEqual({ node: p.firstChild, offset: 5 });
        setSelectionAtNodeEnd(selectionOf(), p.querySelector('b')!);
        expect(caret()).toEqual({ node: p, offset: 2 });
    });
});

describe('traversal helpers', () => {
    it('findAncestorByTag finds the nearest match and honours the stop node', () => {
        const root = mount('<ul><li><p><b id="x">t</b></p></li></ul>');
        const start = root.querySelector('#x')!.firstChild!;
        expect(findAncestorByTag(start, 'LI')).toBe(root.querySelector('li'));
        expect(findAncestorByTag(start, 'B')).toBe(root.querySelector('b'));
        expect(findAncestorByTag(start, 'UL', root)).toBe(root.querySelector('ul'));
        expect(findAncestorByTag(start, 'DIV', root)).toBeNull();
        expect(findAncestorByTag(start, 'LI', root.querySelector('p'))).toBeNull();
    });

    it('lastTextNodeIn returns the final text node or null', () => {
        const root = mount('<p>a<b>b</b>c<i></i></p><hr>');
        expect(lastTextNodeIn(root)?.data).toBe('c');
        expect(lastTextNodeIn(root.querySelector('hr')!)).toBeNull();
    });

    it('trailingBreakIn sees a final <br> past whitespace and nothing else', () => {
        const root = mount('<p>one<br> </p><p>two<br>x</p><p></p>');
        const [a, b, c] = Array.from(root.querySelectorAll('p'));
        expect(trailingBreakIn(a!)).toBe(a!.querySelector('br'));
        expect(trailingBreakIn(b!)).toBeNull();
        expect(trailingBreakIn(c!)).toBeNull();
    });

    it('lastShownText skips padding-only text nodes', () => {
        const root = mount(`<p>real<b>${ZW}</b> </p>`);
        expect(lastShownText(root)?.data).toBe('real');
        expect(lastShownText(mount(`<p>${ZW}</p>`))).toBeNull();
    });

    it('getDeepestLastNode descends the last-child chain', () => {
        const root = mount('<ul><li>a<b>deep</b></li></ul>');
        expect(getDeepestLastNode(root)).toBe(root.querySelector('b')!.firstChild);
        const hr = mount('<hr>').firstChild!;
        expect(getDeepestLastNode(hr)).toBe(hr);
    });

    it('lastChildTagged returns the last matching child element only', () => {
        const root = mount('<ul><li>x<ol id="a"></ol><ol id="b"></ol><ul></ul></li></ul>');
        const li = root.querySelector('li')!;
        expect(lastChildTagged(li, 'OL')?.id).toBe('b');
        expect(lastChildTagged(li, 'TABLE')).toBeNull();
    });
});

describe('zero-width anchors', () => {
    it('ensureZeroWidthTextNode reuses the last anchor or inserts one first', () => {
        const root = mount(`<p>a${ZW}</p>`);
        const p = root.querySelector('p')!;
        expect(ensureZeroWidthTextNode(p)).toBe(p.firstChild);
        expect(p.childNodes).toHaveLength(1);

        const fresh = mount('<p><br></p>').querySelector('p')!;
        const anchor = ensureZeroWidthTextNode(fresh);
        expect(anchor.data).toBe(ZW);
        expect(fresh.firstChild).toBe(anchor);
    });

    it('emptyBlockCaretTarget keeps real text, fills an empty node, or seeds an anchor', () => {
        const withText = mount('<p>text</p>').querySelector('p')!;
        expect(emptyBlockCaretTarget(withText)).toBe(withText.firstChild);

        const emptyText = mount('<p></p>').querySelector('p')!;
        const node = document.createTextNode('');
        emptyText.append(node);
        expect(emptyBlockCaretTarget(emptyText)).toBe(node);
        expect(node.data).toBe(ZW);

        const br = mount('<p><br></p>').querySelector('p')!;
        const seeded = emptyBlockCaretTarget(br);
        expect(seeded.data).toBe(ZW);
        expect(br.querySelector('br')).toBeNull();
    });

    it('emptyBlockCaretTarget never clears a block that holds an image', () => {
        const p = mount('<p><img src="x.png"></p>').querySelector('p')!;
        emptyBlockCaretTarget(p);
        expect(p.querySelector('img')).not.toBeNull();
    });

    it('countZeroWidthBefore and offsetAfterSweep map offsets past removed anchors', () => {
        expect(countZeroWidthBefore(`${ZW}a${ZW}b`, 3)).toBe(2);
        expect(countZeroWidthBefore(`${ZW}a${ZW}b`, 1)).toBe(1);
        const node = document.createTextNode(`${ZW}ab`);
        const before = new Map([[node, `${ZW}ab`]]);
        expect(offsetAfterSweep(node, 3, before)).toBe(2);
        expect(offsetAfterSweep(node, 0, before)).toBe(0);
        expect(offsetAfterSweep(document.createTextNode('z'), 4, before)).toBe(4);
    });
});

describe('caret placement', () => {
    it('placeCaretAtEndOf lands after the last shown text, not the first node', () => {
        const root = mount('<p>hello <b>world</b></p>');
        const p = root.querySelector('p')!;
        const world = p.querySelector('b')!.firstChild!;
        placeCaretAtEndOf(selectionOf(), p);
        expect(caret()).toEqual({ node: world, offset: 5 });
    });

    it('placeCaretAtEndOf anchors an empty block and handles shown non-text content', () => {
        const empty = mount('<p><br></p>').querySelector('p')!;
        placeCaretAtEndOf(selectionOf(), empty);
        const { node, offset } = caret();
        expect(node?.nodeValue).toBe(ZW);
        expect(offset).toBe(1);

        const image = mount('<p><img src="x.png"></p>').querySelector('p')!;
        placeCaretAtEndOf(selectionOf(), image);
        expect(caret()).toEqual({ node: image, offset: 1 });
    });

    it('placeCaretAtEndOfBlock goes to the end of the block own line', () => {
        const li = mount('<ul><li>item<ul><li>nested</li></ul></li></ul>').querySelector('li')!;
        placeCaretAtEndOfBlock(selectionOf(), li);
        expect(caret()).toEqual({ node: li.firstChild, offset: 4 });
    });

    it('placeCaretAtEndOfBlock anchors an empty block', () => {
        const p = mount('<p></p>').querySelector('p')!;
        placeCaretAtEndOfBlock(selectionOf(), p);
        expect(caret()).toEqual({ node: p.firstChild, offset: 1 });
        expect(p.textContent).toBe(ZW);
    });

    it('placeCaretAtStartOfBlock sits before text, and after an invisible anchor', () => {
        const filled = mount('<p>text</p>').querySelector('p')!;
        placeCaretAtStartOfBlock(selectionOf(), filled);
        expect(caret()).toEqual({ node: filled.firstChild, offset: 0 });

        const empty = mount('<p><br></p>').querySelector('p')!;
        placeCaretAtStartOfBlock(selectionOf(), empty);
        expect(caret()).toEqual({ node: empty.firstChild, offset: 1 });

        const seeded = mount('<p> </p>').querySelector('p')!;
        placeCaretAtStartOfBlock(selectionOf(), seeded);
        expect(caret()).toEqual({ node: seeded.firstChild, offset: 0 });
    });
});

describe('node paths', () => {
    it('round-trips every node of a tree', () => {
        const root = mount('<p>a<b>b</b></p><ul><li>x</li><li><i>y</i>z</li></ul>');
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
        let count = 0;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            expect(resolveNodePath(root, getNodePath(root, node))).toBe(node);
            count++;
        }
        expect(count).toBeGreaterThan(8);
    });

    it('returns an empty path for the root and for a node outside it', () => {
        const root = mount('<p>a</p>');
        expect(getNodePath(root, root)).toEqual([]);
        expect(getNodePath(root, document.createElement('p'))).toEqual([]);
        expect(resolveNodePath(root, [])).toBe(root);
    });

    it('resolveNodePath returns null when the path leaves the tree', () => {
        const root = mount('<p>a</p>');
        expect(resolveNodePath(root, [0, 0, 3])).toBeNull();
        expect(resolveNodePath(root, [5])).toBeNull();
    });

    it('clampNodeOffset bounds text by length and elements by child count', () => {
        const root = mount('<p>abc<b></b></p>');
        const p = root.querySelector('p')!;
        expect(clampNodeOffset(p.firstChild!, 9)).toBe(3);
        expect(clampNodeOffset(p.firstChild!, -2)).toBe(0);
        expect(clampNodeOffset(p, 9)).toBe(2);
        expect(clampNodeOffset(p, 1)).toBe(1);
    });
});
