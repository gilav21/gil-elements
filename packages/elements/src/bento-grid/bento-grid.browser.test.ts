import { html } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeBentoGrid } from './bento-grid.js';
import type { DashboardItem } from './bento-grid.layout.js';

afterEach(() => {
    document.documentElement.dir = '';
});

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
const item = (id: string, x: number, y: number, cols: number, rows: number): DashboardItem => ({ id, x, y, cols, rows, content: `Widget ${id}` });
// Four columns of 102.5px with a 10px gap in a 440px host: steps of 112.5px across and 60px down (50px rows).
const LAYOUT = [item('a', 1, 1, 2, 2), item('b', 3, 1, 2, 1), item('c', 3, 2, 1, 1)];
async function board(attrs = '', items: DashboardItem[] = LAYOUT, style = 'width:440px'): Promise<GeBentoGrid> {
    const page = await mount(`<ge-bento-grid ${attrs} cols="4" gap="10" row-height="50" style="${style}"></ge-bento-grid>`);
    const el = page.firstElementChild as GeBentoGrid;
    el.items = items;
    await el.updateComplete;
    await frame();
    return el;
}
const grid = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('.grid')!;
const card = (el: Element, id: string) => el.shadowRoot!.querySelector<HTMLElement>(`.bento-item[data-item-id="${id}"]`)!;
const cardRect = (el: Element, id: string) => {
    const box = card(el, id).getBoundingClientRect();
    const origin = grid(el).getBoundingClientRect();
    return { x: Math.round(box.left - origin.left), y: Math.round(box.top - origin.top), w: Math.round(box.width), h: Math.round(box.height) };
};
/** The viewport point at the middle of a cell (1-based). */
const cellCentre = (el: Element, x: number, y: number) => {
    const origin = grid(el).getBoundingClientRect();
    return { clientX: origin.left + (x - 1) * 112.5 + 51, clientY: origin.top + (y - 1) * 60 + 25 };
};
const changes = (el: Element, name = 'items-change') => {
    const seen: unknown[] = [];
    el.addEventListener(name, (e) => seen.push((e as CustomEvent).detail));
    return seen;
};
const place = (items: unknown) => (items as DashboardItem[]).map((i) => `${i.id}:${i.x},${i.y} ${i.cols}x${i.rows}`).sort();
const menuOpen = (el: Element) => el.shadowRoot!.querySelector<HTMLElement & { open: boolean }>('ge-context-menu')!.open;
const menuRows = (el: Element) => [...el.shadowRoot!.querySelectorAll('ge-context-menu-item')].map((row) => row.textContent!.trim());
const dragStart = (el: Element, id: string, at = { clientX: 0, clientY: 0 }) => {
    const target = card(el, id);
    const box = target.getBoundingClientRect();
    target.dispatchEvent(new DragEvent('dragstart', { bubbles: true, composed: true, dataTransfer: new DataTransfer(), clientX: box.left + (at.clientX || 10), clientY: box.top + (at.clientY || 10) }));
};
const dragOver = (el: Element, x: number, y: number) => grid(el).dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer(), ...cellCentre(el, x, y) }));
const gripOf = (el: Element, id: string, direction: string) => card(el, id).querySelector<HTMLElement>(`.grip[data-direction="${direction}"]`)!;
const inked = (target: Element) => getComputedStyle(target).boxShadow.replaceAll(/(rgba\(0, 0, 0, 0\)|oklab\(0 0 0 \/ 0\)) 0px 0px 0px 0px/g, '').replaceAll(/[ ,]/g, '') !== '';
const mouse = (type: string, clientX: number, clientY: number) => new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true, composed: true });

describe('ge-bento-grid layout', () => {
    it('lays widgets out on 1-based grid lines: each spans its cols and rows, in fluid tracks of the given row height and gap', async () => {
        const el = await board();
        const style = getComputedStyle(grid(el));

        expect(style.gridTemplateColumns).toBe('102.5px 102.5px 102.5px 102.5px');
        expect(style.rowGap).toBe('10px');
        expect(cardRect(el, 'a')).toEqual({ x: 0, y: 0, w: 215, h: 110 });
        expect(cardRect(el, 'b')).toEqual({ x: 225, y: 0, w: 215, h: 50 });
        expect(cardRect(el, 'c')).toEqual({ x: 225, y: 60, w: 103, h: 50 });
        expect(card(el, 'a').querySelector('slot')!.assignedElements()[0]!.textContent).toBe('Widget a');
    });

    it('takes bare numbers as pixels for the lengths, and any CSS length as it is', async () => {
        const el = await board('row-height="40" gap="1rem" column-width="80" item-padding="8" border-radius="4"');
        expect(getComputedStyle(grid(el)).gridTemplateColumns).toBe('80px 80px 80px 80px');
        expect(getComputedStyle(grid(el)).gridAutoRows).toBe('40px');
        expect(getComputedStyle(grid(el)).rowGap).toBe('16px');
        expect(getComputedStyle(card(el, 'a')).paddingTop).toBe('8px');
        expect(getComputedStyle(card(el, 'a')).borderTopLeftRadius).toBe('4px');
    });

    it('shows what renderItem returns, in the light DOM so page styles reach it, and falls back to the content as text', async () => {
        const el = await board();
        el.renderItem = (it) => html`<b class="mine">${it.id.toUpperCase()}</b>`;
        await el.updateComplete;
        const mine = el.querySelectorAll('.mine');
        expect([...mine].map((n) => n.textContent)).toEqual(['A', 'B', 'C']);
        expect(mine[0]!.getBoundingClientRect().top).toBeGreaterThan(card(el, 'a').getBoundingClientRect().top);
        expect(card(el, 'a').contains(mine[0]!)).toBe(false);
    });

    it('draws an outline and shadow when asked, outlines editable widgets anyway, and neither when plain and read-only', async () => {
        const bordered = await board('editable="false"');
        expect(getComputedStyle(card(bordered, 'a')).borderTopWidth).toBe('1px');
        expect(inked(card(bordered, 'a'))).toBe(true);

        const plain = await board('editable="false" show-borders="false"');
        expect(getComputedStyle(card(plain, 'a')).borderTopWidth).toBe('0px');
        expect(inked(card(plain, 'a'))).toBe(false);

        const editable = await board('show-borders="false"');
        expect(getComputedStyle(card(editable, 'a')).borderTopWidth).toBe('1px');
    });

    it('shows the dot pattern, the grips and the options button only while editable, and the chosen grips', async () => {
        const el = await board();
        expect(el.shadowRoot!.querySelector('.pattern')).not.toBeNull();
        expect(card(el, 'a').querySelectorAll('.grip')).toHaveLength(8);
        expect(card(el, 'a').querySelector('.options button')!.getAttribute('aria-label')).toBe('Item options');
        expect(card(el, 'a').getAttribute('draggable')).toBe('true');

        el.resizeHandleType = 'edges';
        await el.updateComplete;
        expect([...card(el, 'a').querySelectorAll('.grip')].map((g) => (g as HTMLElement).dataset.direction).sort()).toEqual(['e', 'n', 's', 'w']);
        el.resizeHandleType = 'corners';
        await el.updateComplete;
        expect([...card(el, 'a').querySelectorAll('.grip')].map((g) => (g as HTMLElement).dataset.direction).sort()).toEqual(['ne', 'nw', 'se', 'sw']);

        el.editable = false;
        await el.updateComplete;
        expect(el.shadowRoot!.querySelector('.pattern')).toBeNull();
        expect(card(el, 'a').querySelectorAll('.grip')).toHaveLength(0);
        expect(card(el, 'a').getAttribute('draggable')).toBe('false');
    });

    it('places static cards given as children, spanning columns and rows', async () => {
        const page = await mount('<ge-bento-grid cols="4" gap="10" row-height="50" style="width:440px"><ge-bento-grid-item span="2" row-span="2">One</ge-bento-grid-item><ge-bento-grid-item>Two</ge-bento-grid-item></ge-bento-grid>');
        await frame();
        const [one, two] = [...page.querySelectorAll('ge-bento-grid-item')].map((n) => n.getBoundingClientRect());
        expect(Math.round(one!.width)).toBe(215);
        expect(Math.round(one!.height)).toBe(110);
        expect(Math.round(two!.left - one!.right)).toBe(10);
        expect(Math.round(two!.width)).toBe(103);
    });
});

describe('ge-bento-grid selection and merge', () => {
    it('selects on click, replaces on another click, adds with ctrl or meta, and deselects a selected one, announcing the ids', async () => {
        const el = await board();
        const seen = changes(el, 'selection-change');
        card(el, 'a').click();
        card(el, 'b').click();
        card(el, 'c').dispatchEvent(new MouseEvent('click', { ctrlKey: true, bubbles: true, composed: true }));
        card(el, 'b').click();
        await el.updateComplete;

        expect(seen).toEqual([['a'], ['b'], ['b', 'c'], ['c']]);
        expect(el.isSelected('c')).toBe(true);
        await vi.waitFor(() => expect(getComputedStyle(card(el, 'c')).boxShadow).toContain('0px 0px 0px 2px'));
        expect(getComputedStyle(card(el, 'a')).boxShadow).not.toContain('0px 0px 0px 2px');
    });

    it('toggles with Enter or Space on a focused widget, but not from the controls inside it', async () => {
        const el = await board();
        const seen = changes(el, 'selection-change');
        card(el, 'a').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        card(el, 'a').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        card(el, 'a').querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(seen).toEqual([['a'], []]);
    });

    it('offers to merge a selection that shares edges, and replaces it with its bounding box under the top-left widget', async () => {
        const el = await board();
        const seen = changes(el);
        const merged = changes(el, 'selection-change');
        el.toggleSelection('b');
        el.toggleSelection('c');
        await el.updateComplete;
        const bar = el.shadowRoot!.querySelector<HTMLButtonElement>('.merge')!;
        expect(bar.textContent!.trim()).toBe('Merge 2 Items');

        bar.click();
        await el.updateComplete;
        expect(place(seen[0])).toEqual(['a:1,1 2x2', 'b:3,1 2x2']);
        expect((seen[0] as DashboardItem[]).find((i) => i.id === 'b')!.content).toBe('Widget b');
        expect(merged.at(-1)).toEqual([]);
        expect(el.shadowRoot!.querySelector('.merge')).toBeNull();
    });

    it('does not offer a merge for one widget, widgets that only touch at a corner, or when not editable', async () => {
        const diagonal = await board('', [item('a', 1, 1, 1, 1), item('b', 2, 2, 1, 1), item('c', 4, 1, 1, 1)]);
        diagonal.toggleSelection('a');
        await diagonal.updateComplete;
        expect(diagonal.shadowRoot!.querySelector('.merge')).toBeNull();
        diagonal.toggleSelection('b');
        await diagonal.updateComplete;
        expect(diagonal.shadowRoot!.querySelector('.merge')).toBeNull();

        const above = await board('', [item('a', 2, 2, 1, 1), item('b', 1, 1, 1, 1)]);
        above.toggleSelection('a');
        above.toggleSelection('b');
        await above.updateComplete;
        expect(above.shadowRoot!.querySelector('.merge')).toBeNull();

        const apart = await board('', [item('a', 1, 1, 1, 1), item('b', 2, 1, 1, 1), item('c', 4, 1, 1, 1)]);
        apart.toggleSelection('a');
        apart.toggleSelection('b');
        apart.toggleSelection('c');
        await apart.updateComplete;
        expect(apart.shadowRoot!.querySelector('.merge')).toBeNull();
        apart.mergeSelected();
    });

    it('clears the selection, announcing it, when editing is switched off', async () => {
        const el = await board();
        el.toggleSelection('a');
        const seen = changes(el, 'selection-change');
        el.editable = false;
        await el.updateComplete;
        expect(seen).toEqual([[]]);
        el.toggleSelection('b');
        expect(el.isSelected('b')).toBe(false);
    });
});

describe('ge-bento-grid menus and edits', () => {
    it('opens the widget menu on right-click, with split and delete rows', async () => {
        const el = await board();
        card(el, 'a').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true, clientX: 50, clientY: 40 }));
        await el.updateComplete;
        expect(menuOpen(el)).toBe(true);
        expect(menuRows(el)).toEqual(['Split Vertical', 'Split Horizontal', 'Delete']);
    });

    it('splits a widget in halves, the second getting a new id and placeholder content, from the menu or the method', async () => {
        const el = await board('', [item('a', 1, 1, 3, 3), item('b', 4, 1, 1, 1)]);
        const seen = changes(el);
        el.splitItem('a', 'vertical');
        el.splitItem('a', 'horizontal');
        const [vertical, horizontal] = seen as DashboardItem[][];
        const halves = (list: DashboardItem[]) => list.filter((i) => i.id !== 'b');

        expect(place(halves(vertical!).map((i) => ({ ...i, id: i.id === 'a' ? 'a' : 'new' })))).toEqual(['a:1,1 1x3', 'new:2,1 2x3']);
        expect(halves(vertical!).find((i) => i.id !== 'a')!.content).toBe('New Item');
        expect(place(halves(horizontal!).map((i) => ({ ...i, id: i.id === 'a' ? 'a' : 'new' })))).toEqual(['a:1,1 3x1', 'new:1,2 3x2']);

        el.splitItem('b', 'vertical');
        el.splitItem('b', 'horizontal');
        el.splitItem('missing', 'vertical');
        expect(seen).toHaveLength(2);

        card(el, 'a').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true, clientX: 50, clientY: 40 }));
        await el.updateComplete;
        el.shadowRoot!.querySelectorAll<HTMLElement>('ge-context-menu-item')[0]!.click();
        expect(seen).toHaveLength(3);
    });

    it('deletes a widget from the menu, leaving the others where they are', async () => {
        const el = await board();
        const seen = changes(el);
        card(el, 'b').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true, clientX: 300, clientY: 20 }));
        await el.updateComplete;
        el.shadowRoot!.querySelectorAll<HTMLElement>('ge-context-menu-item')[2]!.click();
        expect(place(seen[0])).toEqual(['a:1,1 2x2', 'c:3,2 1x1']);
    });

    it('offers to add on an empty cell, at that cell, and leaves an occupied one to the browser', async () => {
        const el = await board();
        const seen = changes(el);
        const empty = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true, ...cellCentre(el, 4, 3) });
        grid(el).dispatchEvent(empty);
        await el.updateComplete;
        expect(empty.defaultPrevented).toBe(true);
        expect(menuOpen(el)).toBe(true);
        expect(menuRows(el)).toEqual(['Add 1x1 Item', 'Add 4x2 Item']);
        el.shadowRoot!.querySelectorAll<HTMLElement>('ge-context-menu-item')[0]!.click();
        const added = (seen[0] as DashboardItem[]).find((i) => !['a', 'b', 'c'].includes(i.id))!;
        expect(`${added.x},${added.y} ${added.cols}x${added.rows} ${added.content}`).toBe('4,3 1x1 New Item');

        const blocked = await board();
        const taken = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true, ...cellCentre(blocked, 3, 2) });
        grid(blocked).dispatchEvent(taken);
        expect(taken.defaultPrevented).toBe(false);
        expect(menuOpen(blocked)).toBe(false);
    });

    it('adds nothing where it would overlap a widget, and nothing happens at all while not editable', async () => {
        const el = await board();
        const seen = changes(el);
        el.addItemAt(2, 1, 1, 1);
        el.addItemAt(1, 3, 4, 2);
        expect(seen).toHaveLength(1);
        el.addItemAt(1, 3, 2, 1);
        expect(seen).toHaveLength(2);
        const side = await board('', [item('a', 1, 1, 2, 2)]);
        const sideSeen = changes(side);
        side.addItemAt(3, 1, 2, 2);
        expect(sideSeen).toHaveLength(1);

        el.editable = false;
        await el.updateComplete;
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true, ...cellCentre(el, 4, 3) });
        grid(el).dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
        expect(menuOpen(el)).toBe(false);
    });
});

describe('ge-bento-grid dragging', () => {
    it('shows where a dragged widget would land, at its size, with the widget itself moved there and dimmed', async () => {
        const el = await board();
        dragStart(el, 'a');
        dragOver(el, 3, 3);
        await el.updateComplete;
        const placeholder = el.shadowRoot!.querySelector<HTMLElement>('.placeholder')!;

        expect(placeholder.style.gridColumnStart).toBe('3');
        expect(placeholder.style.gridRowStart).toBe('3');
        expect(placeholder.textContent!.trim()).toBe('2x2');
        expect(card(el, 'a').classList.contains('dragging')).toBe(true);
        await vi.waitFor(() => expect(getComputedStyle(card(el, 'a')).opacity).toBe('0.5'));
        expect(card(el, 'a').style.gridColumnStart).toBe('3');
        expect(getComputedStyle(card(el, 'a')).zIndex).toBe('50');

        card(el, 'a').dispatchEvent(new DragEvent('dragend', { bubbles: true }));
        await el.updateComplete;
        expect(el.shadowRoot!.querySelector('.placeholder')).toBeNull();
        expect(card(el, 'a').style.gridColumnStart).toBe('1');
    });

    it('drops onto empty canvas, shrinking the neighbours it lands on and dropping the ones with nothing left', async () => {
        const el = await board();
        const seen = changes(el);
        dragStart(el, 'a');
        grid(el).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer(), ...cellCentre(el, 3, 1) }));

        // a (2x2) lands at 3,1 over b (3,1 2x1) and c (3,2 1x1): b is gone, c is gone, nothing is left of either.
        expect(place(seen[0])).toEqual(['a:3,1 2x2']);
    });

    it('keeps the part of a neighbour the dropped widget leaves uncovered', async () => {
        const el = await board('', [item('a', 1, 1, 1, 1), item('b', 2, 1, 3, 1)]);
        const seen = changes(el);
        dragStart(el, 'a');
        dragOver(el, 4, 1);
        el.shadowRoot!.querySelector<HTMLElement>('.bento-item[data-item-id="b"]')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, composed: true, dataTransfer: new DataTransfer() }));
        expect(place(seen[0])).toEqual(['a:4,1 1x1', 'b:2,1 2x1']);
    });

    it('lets a dropped widget sit flush against a neighbour without shrinking it, and keeps the larger side of one it splits', async () => {
        const el = await board('', [item('a', 1, 1, 1, 1), item('b', 2, 1, 1, 1), item('c', 1, 2, 4, 1)]);
        const seen = changes(el);
        dragStart(el, 'a');
        grid(el).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer(), ...cellCentre(el, 3, 1) }));
        expect(place(seen[0])).toEqual(['a:3,1 1x1', 'b:2,1 1x1', 'c:1,2 4x1']);

        const wide = await board('', [item('a', 1, 1, 1, 1), item('b', 1, 2, 4, 1)]);
        const wideSeen = changes(wide);
        dragStart(wide, 'a');
        grid(wide).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer(), ...cellCentre(wide, 2, 2) }));
        expect(place(wideSeen[0])).toEqual(['a:2,2 1x1', 'b:3,2 2x1']);
    });

    it('lands the top-left of the widget under the pointer, not the point it was grabbed at', async () => {
        const el = await board();
        const seen = changes(el);
        // Grabbed 60px right of a's left edge and 10px below its top; dropped with the pointer in cell (3,3): a's corner is at 3 - 0.5 cells.
        const target = card(el, 'a');
        const box = target.getBoundingClientRect();
        target.dispatchEvent(new DragEvent('dragstart', { bubbles: true, composed: true, dataTransfer: new DataTransfer(), clientX: box.left + 60, clientY: box.top + 10 }));
        const origin = grid(el).getBoundingClientRect();
        grid(el).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer(), clientX: origin.left + 2 * 112.5 + 60 + 5, clientY: origin.top + 2 * 60 + 10 + 5 }));
        expect(place(seen[0])).toContain('a:3,3 2x2');
    });

    it('mirrors columns in a right-to-left page: the first column is at the right edge', async () => {
        document.documentElement.dir = 'rtl';
        const el = await board('', [item('a', 1, 1, 1, 1)]);
        const seen = changes(el);
        const origin = grid(el).getBoundingClientRect();
        expect(card(el, 'a').getBoundingClientRect().right).toBeCloseTo(origin.right, 0);
        dragStart(el, 'a');
        grid(el).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer(), clientX: origin.left + 60, clientY: origin.top + 10 }));
        expect(place(seen[0])).toEqual(['a:4,1 1x1']);
    });

    it('does not move anything when dropped outside a drag it started, and announces a widget dragged in from elsewhere', async () => {
        const el = await board();
        const moves = changes(el);
        const drops = changes(el, 'external-drop');
        const payload = (data: string) => {
            const transfer = new DataTransfer();
            transfer.setData('application/json', data);
            return transfer;
        };
        const origin = grid(el).getBoundingClientRect();
        grid(el).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: payload('{"type":"widget","id":"w9"}'), ...cellCentre(el, 4, 3) }));
        card(el, 'a').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, composed: true, dataTransfer: payload('{"type":"widget","id":"w8"}') }));
        grid(el).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: payload('not json'), clientX: origin.left, clientY: origin.top }));
        grid(el).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: payload('{"type":"other","id":"w7"}'), clientX: origin.left, clientY: origin.top }));

        expect(drops).toEqual([{ widgetId: 'w9', targetId: null, x: 4, y: 3 }, { widgetId: 'w8', targetId: 'a' }]);
        expect(moves).toEqual([]);
    });

    it('moves a widget with a finger: a preview under it while it moves, the layout announced when it lifts, and no page scrolling from it', async () => {
        const el = await board();
        const seen = changes(el);
        expect(getComputedStyle(card(el, 'c')).touchAction).toBe('none');
        const from = card(el, 'c').getBoundingClientRect();
        const touch = (x: number, y: number) => new Touch({ identifier: 1, target: card(el, 'c'), clientX: x, clientY: y });
        card(el, 'c').dispatchEvent(new TouchEvent('touchstart', { touches: [touch(from.left + 10, from.top + 10)], bubbles: true, cancelable: true, composed: true }));
        const point = cellCentre(el, 1, 4);
        window.dispatchEvent(new TouchEvent('touchmove', { touches: [touch(point.clientX - 40 + 10, point.clientY - 15 + 10)], bubbles: true, cancelable: true }));
        await el.updateComplete;
        expect(el.shadowRoot!.querySelector<HTMLElement>('.placeholder')!.style.gridRowStart).toBe('4');
        window.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
        await el.updateComplete;

        expect(place(seen[0])).toContain('c:1,4 1x1');
        expect(el.shadowRoot!.querySelector('.placeholder')).toBeNull();
    });
});

describe('ge-bento-grid resizing', () => {
    const drag = async (el: GeBentoGrid, id: string, direction: string, dx: number, dy: number) => {
        const grip = gripOf(el, id, direction).getBoundingClientRect();
        const startX = grip.left + grip.width / 2;
        const startY = grip.top + grip.height / 2;
        gripOf(el, id, direction).dispatchEvent(mouse('mousedown', startX, startY));
        window.dispatchEvent(mouse('mousemove', startX + dx, startY + dy));
        await el.updateComplete;
        return { startX, startY };
    };

    it('shows the new size while dragging a corner, snapping to whole cells, and announces it once on release', async () => {
        const el = await board('', [item('a', 1, 1, 1, 1)]);
        const seen = changes(el);
        await drag(el, 'a', 'se', 112.5 * 2 + 20, 60 + 10);
        expect(cardRect(el, 'a')).toEqual({ x: 0, y: 0, w: 328, h: 110 });
        expect(card(el, 'a').classList.contains('ringed')).toBe(true);
        expect(seen).toEqual([]);

        window.dispatchEvent(mouse('mouseup', 0, 0));
        await el.updateComplete;
        expect(place(seen[0])).toEqual(['a:1,1 3x2']);
        expect(card(el, 'a').classList.contains('ringed')).toBe(false);
    });

    it('resizes from the logical side in a right-to-left page', async () => {
        document.documentElement.dir = 'rtl';
        const el = await board('', [item('a', 2, 1, 2, 1)]);
        const seen = changes(el);
        await drag(el, 'a', 'sw', -112.5, 60);
        window.dispatchEvent(mouse('mouseup', 0, 0));
        expect(place(seen[0])).toEqual(['a:2,1 3x2']);
    });

    it('moves the origin when a west or north edge is dragged, and never goes below one cell', async () => {
        const west = await board('', [item('a', 2, 2, 2, 2)]);
        const seen = changes(west);
        await drag(west, 'a', 'w', -112.5, 0);
        window.dispatchEvent(mouse('mouseup', 0, 0));
        expect(place(seen[0])).toEqual(['a:1,2 3x2']);

        const north = await board('', [item('a', 2, 2, 2, 2)]);
        const northSeen = changes(north);
        await drag(north, 'a', 'n', 0, 60 * 5);
        window.dispatchEvent(mouse('mouseup', 0, 0));
        expect(place(northSeen[0])).toEqual(['a:2,3 2x1']);

        const nw = await board('', [item('a', 2, 2, 2, 2)]);
        const nwSeen = changes(nw);
        await drag(nw, 'a', 'nw', 112.5 * 4, -60);
        window.dispatchEvent(mouse('mouseup', 0, 0));
        expect(place(nwSeen[0])).toEqual(['a:3,1 1x3']);
    });

    it('shrinks the neighbours the new size covers', async () => {
        const el = await board('', [item('a', 1, 1, 1, 1), item('b', 2, 1, 2, 1), item('c', 4, 1, 1, 1)]);
        const seen = changes(el);
        await drag(el, 'a', 'e', 112.5 * 2, 0);
        window.dispatchEvent(mouse('mouseup', 0, 0));
        expect(place(seen[0])).toEqual(['a:1,1 3x1', 'c:4,1 1x1']);
    });

    it('mirrors the direction in a right-to-left page, so an east grip (on the right) still grows to the right', async () => {
        document.documentElement.dir = 'rtl';
        const el = await board('', [item('a', 2, 1, 1, 1)]);
        const seen = changes(el);
        const grip = gripOf(el, 'a', 'w').getBoundingClientRect();
        gripOf(el, 'a', 'w').dispatchEvent(mouse('mousedown', grip.left + 2, grip.top + 10));
        window.dispatchEvent(mouse('mousemove', grip.left + 2 - 112.5, grip.top + 10));
        window.dispatchEvent(mouse('mouseup', 0, 0));
        expect(place(seen[0])).toEqual(['a:2,1 2x1']);
    });

    it('follows a finger on a grip', async () => {
        const el = await board('', [item('a', 1, 1, 1, 1)]);
        const seen = changes(el);
        const grip = gripOf(el, 'a', 's');
        const box = grip.getBoundingClientRect();
        const at = (y: number) => new Touch({ identifier: 2, target: grip, clientX: box.left + 5, clientY: y });
        const start = new TouchEvent('touchstart', { touches: [at(box.top + 2)], bubbles: true, cancelable: true, composed: true });
        grip.dispatchEvent(start);
        expect(start.defaultPrevented).toBe(true);
        window.dispatchEvent(new TouchEvent('touchmove', { touches: [at(box.top + 2 + 120)], bubbles: true, cancelable: true }));
        window.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
        expect(place(seen[0])).toEqual(['a:1,1 1x3']);
    });

    it('does nothing while not editable', async () => {
        const el = await board('editable="false"');
        expect(card(el, 'a').querySelectorAll('.grip')).toHaveLength(0);
    });
});
