import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeSortable, SortableDropRejectedEvent, SortableReorderEvent } from './index.js';

const ROW = 'height:40px;width:200px';
const rows = (names: string[], extra = '') => names.map((n) => `<ge-sortable-item style="${ROW}" data-name="${n}" ${extra}>${n}</ge-sortable-item>`).join('');
const list = (page: HTMLElement, id = 'a') => page.querySelector<GeSortable>(`ge-sortable#${id}`)!;
const names = (el: Element) => [...el.querySelectorAll(':scope > ge-sortable-item:not([ghost])')].map((n) => n.textContent?.trim());
const item = (page: HTMLElement, name: string) => page.querySelector<HTMLElement>(`ge-sortable-item[data-name="${name}"]`)!;
const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = async (page: HTMLElement) => {
    for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
    await wait(20);
};
const mouse = (target: EventTarget, type: string, x: number, y: number, button = 0) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y, button }));
const centre = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
/** A pointer drag from the middle of `from` to the point `y` pixels below/above the middle of `to`. */
const drag = async (page: HTMLElement, from: Element, to: Element, offsetY = 0) => {
    const a = centre(from);
    const b = centre(to);
    mouse(from, 'mousedown', a.x, a.y);
    mouse(window, 'mousemove', a.x, a.y + 2);
    mouse(window, 'mousemove', b.x, b.y + offsetY);
    await settle(page);
    return () => {
        mouse(window, 'mouseup', b.x, b.y + offsetY);
        return settle(page);
    };
};
const key = (target: Element, k: string, init: KeyboardEventInit = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init }));
const live = () => document.querySelector('[data-slot="sortable-aria-live"]')?.textContent ?? '';
const log = <T>(el: Element, name: string) => {
    const seen: T[] = [];
    el.addEventListener(name, (event) => seen.push((event as CustomEvent<T>).detail));
    return seen;
};


describe('ge-sortable pointer drag', () => {
    it('moves the row to the gap under the pointer and reports where it went', async () => {
        const page = await mount(`<ge-sortable id="a">${rows(['A', 'B', 'C'])}</ge-sortable>`);
        const seen = log<SortableReorderEvent>(list(page), 'reorder');
        const drop = await drag(page, item(page, 'A'), item(page, 'C'), 10);
        await drop();
        expect(names(list(page))).toEqual(['B', 'C', 'A']);
        expect(seen).toHaveLength(1);
        expect(seen[0]?.from.index).toBe(0);
        expect(seen[0]?.to.index).toBe(2);
        expect(seen[0]?.item).toBe(item(page, 'A'));
    });

    it('moves a row up as well as down', async () => {
        const page = await mount(`<ge-sortable id="a">${rows(['A', 'B', 'C'])}</ge-sortable>`);
        const seen = log<SortableReorderEvent>(list(page), 'reorder');
        const drop = await drag(page, item(page, 'C'), item(page, 'A'), -10);
        await drop();
        expect(names(list(page))).toEqual(['C', 'A', 'B']);
        expect(seen[0]?.from.index).toBe(2);
        expect(seen[0]?.to.index).toBe(0);
    });

    it('leaves the order and fires nothing when dropped where it started', async () => {
        const page = await mount(`<ge-sortable id="a">${rows(['A', 'B', 'C'])}</ge-sortable>`);
        const seen = log<SortableReorderEvent>(list(page), 'reorder');
        const drop = await drag(page, item(page, 'B'), item(page, 'B'));
        await drop();
        expect(names(list(page))).toEqual(['A', 'B', 'C']);
        expect(seen).toHaveLength(0);
    });

    it('shows a faded copy at the drop gap and a dashed box at the origin while dragging, and cleans both up', async () => {
        const page = await mount(`<ge-sortable id="a">${rows(['A', 'B', 'C'])}</ge-sortable>`);
        const drop = await drag(page, item(page, 'A'), item(page, 'C'), 10);
        const ghost = list(page).querySelector<HTMLElement>('[data-slot="sortable-ghost"]');
        expect(ghost?.textContent?.trim()).toBe('A');
        expect(ghost?.nextElementSibling).toBeNull();
        expect(item(page, 'A').hasAttribute('data-source')).toBe(true);
        expect(list(page).shadowRoot!.querySelector('[data-slot="sortable-placeholder"]')).not.toBeNull();
        await drop();
        expect(list(page).querySelector('[data-slot="sortable-ghost"]')).toBeNull();
        expect(list(page).shadowRoot!.querySelector('[data-slot="sortable-placeholder"]')).toBeNull();
        expect(item(page, 'A').hasAttribute('data-source')).toBe(false);
        expect(item(page, 'A').style.transform).toBe('');
    });

    it('uses the content of a ge-sortable-ghost and a ge-sortable-placeholder when given', async () => {
        const page = await mount(
            `<ge-sortable id="a">${rows(['A', 'B', 'C'])}<ge-sortable-ghost><i id="g">drop here</i></ge-sortable-ghost><ge-sortable-placeholder><i id="p">was here</i></ge-sortable-placeholder></ge-sortable>`,
        );
        const drop = await drag(page, item(page, 'A'), item(page, 'C'), 10);
        expect(list(page).querySelector('[data-slot="sortable-ghost-host"]')?.textContent).toBe('drop here');
        expect(list(page).shadowRoot!.querySelector('[data-slot="sortable-placeholder-host"]')?.textContent).toBe('was here');
        await drop();
        expect(list(page).querySelector('[data-slot="sortable-ghost-host"]')).toBeNull();
    });

    it('lays out and reorders along x when horizontal', async () => {
        const page = await mount(`<ge-sortable id="a" orientation="horizontal">${rows(['A', 'B', 'C']).replaceAll(ROW, 'height:40px;width:80px')}</ge-sortable>`);
        const a = centre(item(page, 'A'));
        const c = centre(item(page, 'C'));
        expect(c.y).toBe(a.y);
        mouse(item(page, 'A'), 'mousedown', a.x, a.y);
        mouse(window, 'mousemove', a.x + 2, a.y);
        mouse(window, 'mousemove', c.x + 10, c.y);
        await settle(page);
        mouse(window, 'mouseup', c.x + 10, c.y);
        await settle(page);
        expect(names(list(page))).toEqual(['B', 'C', 'A']);
    });

    it('ignores the right button and a disabled list', async () => {
        const page = await mount(`<ge-sortable id="a">${rows(['A', 'B', 'C'])}</ge-sortable><ge-sortable id="d" disabled>${rows(['X', 'Y'])}</ge-sortable>`);
        const a = centre(item(page, 'A'));
        mouse(item(page, 'A'), 'mousedown', a.x, a.y, 2);
        mouse(window, 'mousemove', a.x, a.y + 100);
        await settle(page);
        expect(list(page).dragSource).toBeNull();
        const x = centre(item(page, 'X'));
        mouse(item(page, 'X'), 'mousedown', x.x, x.y);
        mouse(window, 'mousemove', x.x, x.y + 100);
        await settle(page);
        expect(list(page, 'd').dragSource).toBeNull();
        expect(item(page, 'X').hasAttribute('tabindex')).toBe(false);
        expect(item(page, 'X').getAttribute('aria-disabled')).toBe('true');
    });

    it('with handle-only, drags from a handle and not from the row body', async () => {
        const page = await mount(
            `<ge-sortable id="a" handle-only>${['A', 'B', 'C'].map((n) => `<ge-sortable-item style="${ROW}" data-name="${n}"><ge-sortable-handle>::</ge-sortable-handle><span>${n}</span></ge-sortable-item>`).join('')}</ge-sortable>`,
        );
        const body = item(page, 'A').querySelector('span')!;
        const b = centre(body);
        mouse(body, 'mousedown', b.x, b.y);
        mouse(window, 'mousemove', b.x, b.y + 100);
        await settle(page);
        expect(list(page).dragSource).toBeNull();
        expect(item(page, 'A').hasAttribute('data-draggable')).toBe(false);
        const handle = item(page, 'A').querySelector('ge-sortable-handle')!;
        const h = centre(handle);
        const c = centre(item(page, 'C'));
        mouse(handle, 'mousedown', h.x, h.y);
        mouse(window, 'mousemove', h.x, h.y + 2);
        mouse(window, 'mousemove', c.x, c.y + 10);
        await settle(page);
        mouse(window, 'mouseup', c.x, c.y + 10);
        await settle(page);
        expect(names(list(page)).map((n) => n?.replace('::', ''))).toEqual(['B', 'C', 'A']);
    });
});

describe('ge-sortable keyboard', () => {
    it('lifts with Space, moves with the arrows, and drops with Space, announcing each step', async () => {
        const page = await mount(`<ge-sortable id="a">${rows(['A', 'B', 'C'])}</ge-sortable>`);
        const seen = log<SortableReorderEvent>(list(page), 'reorder');
        const a = item(page, 'A');
        a.focus();
        key(a, ' ');
        await settle(page);
        expect(a.hasAttribute('data-lifted')).toBe(true);
        key(a, 'ArrowDown');
        await settle(page);
        key(a, 'ArrowDown');
        await settle(page);
        expect(names(list(page))).toEqual(['B', 'C', 'A']);
        expect(document.activeElement).toBe(a);
        expect(seen.map((s) => [s.from.index, s.to.index])).toEqual([[0, 1], [1, 2]]);
        key(a, ' ');
        await wait(150);
        expect(live()).toBe('Dropped at position 3.');
        expect(a.hasAttribute('data-lifted')).toBe(false);
    });

    it('sends the row to either end with Home and End and clamps at the edges', async () => {
        const page = await mount(`<ge-sortable id="a">${rows(['A', 'B', 'C'])}</ge-sortable>`);
        const b = item(page, 'B');
        b.focus();
        key(b, 'Enter');
        key(b, 'End');
        await settle(page);
        expect(names(list(page))).toEqual(['A', 'C', 'B']);
        key(b, 'ArrowDown');
        await settle(page);
        expect(names(list(page))).toEqual(['A', 'C', 'B']);
        key(b, 'Home');
        await settle(page);
        expect(names(list(page))).toEqual(['B', 'A', 'C']);
    });

    it('puts the row back on Escape without firing reorder for the revert', async () => {
        const page = await mount(`<ge-sortable id="a">${rows(['A', 'B', 'C'])}</ge-sortable>`);
        const a = item(page, 'A');
        a.focus();
        key(a, ' ');
        key(a, 'End');
        await settle(page);
        expect(names(list(page))).toEqual(['B', 'C', 'A']);
        const seen = log<SortableReorderEvent>(list(page), 'reorder');
        key(a, 'Escape');
        await settle(page);
        expect(names(list(page))).toEqual(['A', 'B', 'C']);
        expect(seen).toHaveLength(0);
    });

    it('ignores the arrows until lifted, and keys typed in a control inside the row', async () => {
        const page = await mount(`<ge-sortable id="a">${rows(['A', 'B'])}<ge-sortable-item style="${ROW}" data-name="F"><input id="in" /></ge-sortable-item></ge-sortable>`);
        const a = item(page, 'A');
        key(a, 'ArrowDown');
        await settle(page);
        expect(names(list(page)).slice(0, 2)).toEqual(['A', 'B']);
        const input = page.querySelector('#in')!;
        key(input, ' ');
        await settle(page);
        expect(item(page, 'F').hasAttribute('data-lifted')).toBe(false);
    });
});

describe('ge-sortable data mode', () => {
    it('renders items through renderItem and writes a reorder back as a new array without touching yours', async () => {
        const page = await mount('<ge-sortable id="a"></ge-sortable>');
        const el = list(page);
        const source = [{ id: 1, n: 'A' }, { id: 2, n: 'B' }, { id: 3, n: 'C' }];
        el.renderItem = (item) => (item as { n: string }).n;
        el.trackBy = (item) => (item as { id: number }).id;
        el.items = source;
        const changes = log<{ id: number }[]>(el, 'items-change');
        const seen = log<SortableReorderEvent>(el, 'reorder');
        await settle(page);
        for (const row of el.querySelectorAll<HTMLElement>('ge-sortable-item')) row.style.cssText = ROW;
        await settle(page);
        expect(names(el)).toEqual(['A', 'B', 'C']);
        const rowsNow = [...el.querySelectorAll('ge-sortable-item')];
        const drop = await drag(page, rowsNow[0]!, rowsNow[2]!, 10);
        await drop();
        await settle(page);
        expect(changes.at(-1)?.map((i) => i.id)).toEqual([2, 3, 1]);
        expect(source.map((i) => i.id)).toEqual([1, 2, 3]);
        expect((seen[0]?.item as { n: string }).n).toBe('A');
        expect(names(el)).toEqual(['B', 'C', 'A']);
        // The nodes were kept (trackBy), not recreated.
        expect([...el.querySelectorAll('ge-sortable-item')].includes(rowsNow[0]!)).toBe(true);
    });

    it('shows the empty slot only while there are no items', async () => {
        const page = await mount('<ge-sortable id="a"><span slot="empty" id="e">nothing</span></ge-sortable>');
        const el = list(page);
        const slot = () => el.shadowRoot!.querySelector('slot[name="empty"]');
        expect(slot()).not.toBeNull();
        el.renderItem = (item) => String(item);
        el.items = ['x'];
        await settle(page);
        expect(slot()).toBeNull();
    });
});

describe('ge-sortable between lists', () => {
    const two = (aAccepts = '') =>
        `<ge-sortable id="a" group="g" list-id="todo" style="display:block;width:200px">${rows(['A', 'B'])}</ge-sortable>
         <ge-sortable id="b" group="g" list-id="done" style="display:block;width:200px;min-height:120px">${rows(['C'])}</ge-sortable>${aAccepts}`;

    it('moves a row into the other list at the pointer and reports both lists', async () => {
        const page = await mount(two());
        const seen = log<SortableReorderEvent>(list(page), 'reorder');
        const drop = await drag(page, item(page, 'A'), item(page, 'C'), 10);
        await drop();
        expect(names(list(page))).toEqual(['B']);
        expect(names(list(page, 'b'))).toEqual(['C', 'A']);
        expect(seen[0]?.from.listId).toBe('todo');
        expect(seen[0]?.to).toMatchObject({ listId: 'done', index: 1 });
    });

    it('refuses a drop the receiving list does not accept and says why', async () => {
        const page = await mount(two());
        list(page, 'b').accepts = () => ({ ok: false, reason: 'full' });
        const rejected = log<SortableDropRejectedEvent>(list(page), 'drop-rejected');
        const drop = await drag(page, item(page, 'A'), item(page, 'C'), 10);
        expect(list(page, 'b').getAttribute('data-reject')).toBe('full');
        await drop();
        expect(names(list(page))).toEqual(['A', 'B']);
        expect(names(list(page, 'b'))).toEqual(['C']);
        expect(rejected[0]).toMatchObject({ fromListId: 'todo', toListId: 'done', reason: 'full' });
    });

    it('hands a lifted row to the next list with Tab', async () => {
        const page = await mount(two());
        const a = item(page, 'A');
        a.focus();
        key(a, ' ');
        key(a, 'Tab');
        await settle(page);
        expect(names(list(page))).toEqual(['B']);
        expect(names(list(page, 'b'))).toEqual(['C', 'A']);
    });

    it('does not mix lists that are in different groups', async () => {
        const page = await mount(two());
        list(page, 'b').group = 'other';
        await settle(page);
        const drop = await drag(page, item(page, 'A'), item(page, 'C'), 10);
        await drop();
        expect(names(list(page, 'b'))).toEqual(['C']);
    });
});

describe('ge-sortable guards', () => {
    it('only moves the row that is lifted, not another one that takes the arrow key', async () => {
        const page = await mount(`<ge-sortable id="a">${rows(['A', 'B', 'C'])}</ge-sortable>`);
        key(item(page, 'A'), ' ');
        key(item(page, 'B'), 'ArrowDown');
        await settle(page);
        expect(names(list(page))).toEqual(['A', 'B', 'C']);
    });

    it('rejects a drop into a disabled list with the reason disabled', async () => {
        const page = await mount(`<ge-sortable id="a" group="g" list-id="x" style="display:block;width:200px">${rows(['A'])}</ge-sortable><ge-sortable id="b" group="g" list-id="y" disabled style="display:block;width:200px;min-height:80px">${rows(['C'])}</ge-sortable>`);
        const rejected = log<SortableDropRejectedEvent>(list(page), 'drop-rejected');
        const drop = await drag(page, item(page, 'A'), item(page, 'C'), 5);
        await drop();
        expect(rejected[0]?.reason).toBe('disabled');
        expect(names(list(page, 'b'))).toEqual(['C']);
    });

    it('abandons a drag when the list changes length under it', async () => {
        const page = await mount(`<ge-sortable id="a">${rows(['A', 'B', 'C'])}</ge-sortable>`);
        const rejected = log<SortableDropRejectedEvent>(list(page), 'drop-rejected');
        await drag(page, item(page, 'A'), item(page, 'C'), 10);
        item(page, 'B').remove();
        await settle(page);
        expect(list(page).dragSource).toBeNull();
        expect(rejected[0]?.reason).toBe('list-changed');
    });

    it('does not drop a row into the list inside itself', async () => {
        const page = await mount(`<ge-sortable id="a" group="g" list-id="outer"><ge-sortable-item style="${ROW}" data-name="P">P<ge-sortable id="n" group="g" list-id="inner" style="display:block;width:180px;height:60px"><ge-sortable-item style="height:30px" data-name="c1">c1</ge-sortable-item></ge-sortable></ge-sortable-item><ge-sortable-item style="${ROW}" data-name="Q">Q</ge-sortable-item></ge-sortable>`);
        const drop = await drag(page, item(page, 'P'), item(page, 'c1'), 0);
        await drop();
        expect(names(list(page, 'n'))).toEqual(['c1']);
        expect(item(page, 'P').parentElement).toBe(list(page));
    });

    it('turns auto-scroll off with auto-scroll="false"', async () => {
        const page = await mount(`<ge-sortable id="a" auto-scroll="false">${rows(['A'])}</ge-sortable><ge-sortable id="b">${rows(['B'])}</ge-sortable>`);
        expect(list(page).autoScroll).toBe(false);
        expect(list(page, 'b').autoScroll).toBe(true);
    });

    it('keeps the arrays it was given when a row crosses between data lists', async () => {
        const page = await mount('<ge-sortable id="a" group="g" style="display:block;width:200px"></ge-sortable><ge-sortable id="b" group="g" style="display:block;width:200px;min-height:80px"></ge-sortable>');
        const left = ['A', 'B'];
        const right = ['C'];
        for (const [id, items] of [['a', left], ['b', right]] as const) {
            list(page, id).renderItem = (item) => String(item);
            list(page, id).items = items;
        }
        await settle(page);
        for (const row of page.querySelectorAll<HTMLElement>('ge-sortable-item')) row.style.cssText = ROW;
        await settle(page);
        const rowsOf = (id: string) => [...list(page, id).querySelectorAll('ge-sortable-item')];
        const drop = await drag(page, rowsOf('a')[0]!, rowsOf('b')[0]!, 10);
        await drop();
        expect(list(page).items).toEqual(['B']);
        expect(list(page, 'b').items).toEqual(['C', 'A']);
        expect(left).toEqual(['A', 'B']);
        expect(right).toEqual(['C']);
    });
});

describe('ge-sortable nesting', () => {
    const NESTED = `<ge-sortable id="a" group="g" list-id="outer"><ge-sortable-item style="${ROW}" data-name="P" tabindex="0">P<ge-sortable id="n" group="g" list-id="inner" style="display:block;width:180px"><ge-sortable-item style="height:30px" data-name="c1">c1</ge-sortable-item><ge-sortable-item style="height:30px" data-name="c2">c2</ge-sortable-item></ge-sortable></ge-sortable-item><ge-sortable-item style="${ROW}" data-name="Q">Q</ge-sortable-item></ge-sortable>`;

    it('keeps each row to its own list: a nested row drags and lifts alone', async () => {
        const page = await mount(NESTED);
        const c1 = item(page, 'c1');
        const c = centre(c1);
        mouse(c1, 'mousedown', c.x, c.y);
        mouse(window, 'mousemove', c.x, c.y + 3);
        await settle(page);
        expect(list(page, 'n').dragSource).toBe(0);
        expect(list(page).dragSource).toBeNull();
        mouse(window, 'mouseup', c.x, c.y + 3);
        await settle(page);
        key(c1, ' ');
        await settle(page);
        expect(list(page, 'n').liftedIndex).toBe(0);
        expect(list(page).liftedIndex).toBeNull();
    });
});

describe('ge-sortable nested reorder', () => {
    it('reorders inside the nested list when the pointer stays over it, and reports its path', async () => {
        const page = await mount(`<ge-sortable id="a" group="g" list-id="outer"><ge-sortable-item style="${ROW}" data-name="P">P<ge-sortable id="n" group="g" list-id="inner" style="display:block;width:180px"><ge-sortable-item style="height:30px" data-name="c1">c1</ge-sortable-item><ge-sortable-item style="height:30px" data-name="c2">c2</ge-sortable-item></ge-sortable></ge-sortable-item><ge-sortable-item style="${ROW}" data-name="Q">Q</ge-sortable-item></ge-sortable>`);
        const seen = log<SortableReorderEvent>(list(page, 'n'), 'reorder');
        const drop = await drag(page, item(page, 'c1'), item(page, 'c2'), 8);
        await drop();
        expect(names(list(page, 'n'))).toEqual(['c2', 'c1']);
        expect(seen[0]?.to.path).toEqual(['outer', 'inner']);
    });

    it('moves a nested row out to the outer list when the pointer leaves the nested list', async () => {
        const page = await mount(`<ge-sortable id="a" group="g" list-id="outer"><ge-sortable-item style="${ROW}" data-name="P">P<ge-sortable id="n" group="g" list-id="inner" style="display:block;width:180px"><ge-sortable-item style="height:30px" data-name="c1">c1</ge-sortable-item></ge-sortable></ge-sortable-item><ge-sortable-item style="${ROW}" data-name="Q">Q</ge-sortable-item></ge-sortable>`);
        const drop = await drag(page, item(page, 'c1'), item(page, 'Q'), 5);
        await drop();
        expect(names(list(page, 'n'))).toEqual([]);
        expect(names(list(page))).toContain('c1');
    });
});

describe('ge-sortable land effect', () => {
    it('puts the effect class on the moved row and takes it off again', async () => {
        const page = await mount(`<ge-sortable id="a">${rows(['A', 'B', 'C'])}</ge-sortable>`);
        list(page).landEffect = () => 'landed';
        const a = item(page, 'A');
        a.focus();
        key(a, ' ');
        key(a, 'ArrowDown');
        await wait(30);
        expect(a.classList.contains('landed')).toBe(true);
        await wait(800);
        expect(a.classList.contains('landed')).toBe(false);
    });
});

describe('ge-sortable position class', () => {
    it('gives each row the classes for its place', async () => {
        const page = await mount(`<ge-sortable id="a">${rows(['A', 'B', 'C'])}</ge-sortable>`);
        list(page).positionClass = (_item, index, total) => (index === 0 ? 'first' : index === total - 1 ? 'last' : '');
        await settle(page);
        for (const e of page.querySelectorAll<HTMLElement & { requestUpdate(): void }>('ge-sortable-item')) e.requestUpdate();
        await settle(page);
        expect(item(page, 'A').classList.contains('first')).toBe(true);
        expect(item(page, 'C').classList.contains('last')).toBe(true);
        expect(item(page, 'B').classList.contains('first')).toBe(false);
    });
});
