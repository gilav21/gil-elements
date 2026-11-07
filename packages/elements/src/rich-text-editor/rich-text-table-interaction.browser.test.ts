import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeRichTextEditor } from './rich-text-editor.js';
import { blockEditor, editableOf, load } from './rich-text-editor.fixture.test.js';

const TABLE = `<table><tbody>
    <tr><td>A1</td><td>A2</td><td>A3</td></tr>
    <tr><td>B1</td><td>B2</td><td>B3</td></tr>
</tbody></table>`;

afterEach(() => {
    vi.restoreAllMocks();
});

async function setup(markup = TABLE) {
    const editor = await blockEditor(markup);
    const editable = editableOf(editor);
    const table = editable.querySelector('table')!;
    return { editor, editable, table, selection: editor.provider('tableSelection')! };
}

const centre = (el: Element) => {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};
const rectWidth = (el: Element) => el.getBoundingClientRect().width;
const laidOutWidth = (el: HTMLElement) => rectWidth(el);

function mouse(target: EventTarget, type: string, init: MouseEventInit = {}): MouseEvent {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, ...init });
    target.dispatchEvent(event);
    return event;
}

function touch(target: EventTarget, type: string, x: number, y: number): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y, target }] });
    target.dispatchEvent(event);
    return event;
}

function dragAcross(from: Element, to: Element): void {
    mouse(from, 'mousedown', { button: 0 });
    mouse(document, 'mousemove', { clientX: centre(to).x, clientY: centre(to).y });
    mouse(document, 'mouseup');
}

const cells = (table: HTMLTableElement) => Array.from(table.querySelectorAll('td'));
const menuOf = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<HTMLElement>('.table-menu');
const rightClick = (cell: Element, x = 50, y = 60) => mouse(cell, 'contextmenu', { clientX: x, clientY: y, button: 2 });

describe('cell selection by mouse', () => {
    it('drag-selecting from one cell to another marks the rectangle between them', async () => {
        const { table, selection } = await setup();
        const [a1, , , , b2] = cells(table);

        dragAcross(a1!, b2!);

        expect(selection.selectedCells()).toHaveLength(4);
        expect(selection.selectedCells().every((c) => c.classList.contains('rte-cell-selected'))).toBe(true);
    });

    it('a drag that strays onto nothing, off any cell or onto another table selects nothing', async () => {
        const { editor, table, selection } = await setup();
        const other = document.createElement('table');
        other.innerHTML = '<tbody><tr><td>other</td></tr></tbody>';
        editor.before(other);
        const [, , , , b2, b3] = cells(table);
        mouse(b2!, 'mousedown', { button: 0 });
        try {
            for (const point of [{ x: -5, y: -5 }, centre(other.querySelector('td')!)]) {
                mouse(document, 'mousemove', { clientX: point.x, clientY: point.y });
                expect(selection.selectedCells()).toEqual([]);
            }
            mouse(document, 'mousemove', { clientX: centre(b3!).x, clientY: centre(b3!).y });
            expect(selection.selectedCells()).toEqual([b2, b3]);
        } finally {
            mouse(document, 'mouseup');
            other.remove();
        }
    });

    it('stops tracking once the button is released', async () => {
        const { table, selection } = await setup();
        const [a1, a2, a3] = cells(table);
        mouse(a1!, 'mousedown', { button: 0 });
        mouse(document, 'mousemove', { clientX: centre(a2!).x, clientY: centre(a2!).y });
        mouse(document, 'mouseup');
        mouse(document, 'mousemove', { clientX: centre(a3!).x, clientY: centre(a3!).y });

        expect(selection.selectedCells()).toEqual([a1, a2]);
    });

    it('releases the document listeners when the controller detaches mid-drag', async () => {
        const { editor, table, selection } = await setup();
        const [a1, a2] = cells(table);
        mouse(a1!, 'mousedown', { button: 0 });
        editor.remove();

        mouse(document, 'mousemove', { clientX: centre(a2!).x, clientY: centre(a2!).y });
        expect(selection.selectedCells()).toEqual([]);
    });

    it('a rowspan cell reaching into the next row pulls the selection out to include it', async () => {
        const { table, selection } = await setup(
            '<table><tbody><tr><td>P</td><td rowspan="2">Q</td><td>R</td></tr><tr><td>S</td><td>T</td></tr></tbody></table>',
        );
        const [p, , r] = cells(table);

        dragAcross(p!, r!);

        expect(selection.selectedCells().length).toBeGreaterThanOrEqual(5);
    });

    it('drag-selecting from a rowspan cell to a cell it pushed right selects the block between them', async () => {
        const { table, selection } = await setup(
            '<table><tbody><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        );
        const [a, , , d] = cells(table);

        dragAcross(a!, d!);

        expect(selection.selectedCells().map((c) => c.textContent)).toEqual(['A', 'B', 'C', 'D']);
    });

    it('selecting and merging cells leaves a table nested in one of them alone', async () => {
        const { table, selection, editor } = await setup(`<table><tbody>
            <tr><td>A<table><tbody><tr><td>x</td></tr><tr><td>y</td></tr></tbody></table></td><td>B</td></tr>
            <tr><td>C</td><td>D</td></tr>
        </tbody></table>`);
        const [a, b] = Array.from(table.rows[0]!.cells);
        const [c, d] = Array.from(table.rows[1]!.cells);

        mouse(a!, 'mousedown', { button: 0 });
        mouse(document, 'mouseup');
        mouse(d!, 'mousedown', { button: 0, shiftKey: true });
        expect(selection.selectedCells()).toEqual([a, b, c, d]);

        editor.provider('tableCommands')!.mergeCells();
        expect([a!.rowSpan, a!.colSpan]).toEqual([2, 2]);
        expect(Array.from(a!.querySelectorAll('td'), (td) => td.textContent)).toEqual(['x', 'y']);
    });

    it('Ctrl+click toggles single cells and Shift+click takes the rectangle, both dropping the text selection', async () => {
        const { table, selection } = await setup();
        const [a1, a2, , , b2] = cells(table);
        document.getSelection()!.setBaseAndExtent(a1!.firstChild!, 0, a1!.firstChild!, 1);

        const ctrl = mouse(a1!, 'mousedown', { button: 0, ctrlKey: true });
        expect(ctrl.defaultPrevented).toBe(true);
        mouse(a2!, 'mousedown', { button: 0, metaKey: true });
        expect(selection.selectedCells()).toEqual([a1, a2]);
        expect(document.getSelection()!.rangeCount).toBe(0);
        mouse(a2!, 'mousedown', { button: 0, ctrlKey: true });
        expect(selection.selectedCells()).toEqual([a1]);

        mouse(b2!, 'mousedown', { button: 0, shiftKey: true });
        expect(new Set(selection.selectedCells())).toEqual(new Set([a2, b2]));
    });

    it('right-click keeps a selection it lands in and clears one it lands outside', async () => {
        const { table, selection } = await setup();
        const [a1, a2, a3] = cells(table);
        selection.select([a1!, a2!]);

        mouse(a1!, 'mousedown', { button: 2 });
        expect(selection.selectedCells()).toEqual([a1, a2]);
        mouse(a3!, 'mousedown', { button: 2 });
        expect(selection.selectedCells()).toEqual([]);
        selection.select([a1!]);
        mouse(a1!, 'mousedown', { button: 0 });
        expect(selection.selectedCells()).toEqual([]);
    });

    it.each(['disabled', 'readonly'] as const)('neither drag-selects nor arms a resize while %s', async (state) => {
        const { editor, editable, table, selection } = await setup();
        editor[state] = true;
        await editor.updateComplete;
        const [a1, , , , b2] = cells(table);

        dragAcross(a1!, b2!);
        expect(selection.selectedCells()).toEqual([]);

        const rect = a1!.getBoundingClientRect();
        mouse(a1!, 'mousemove', { clientX: rect.right - 1, clientY: rect.top + 5 });
        expect(editable.style.cursor).toBe('');
    });

    it('selection is reset when the content is replaced', async () => {
        const { editor, table, selection } = await setup();
        const [a1, a2] = cells(table);
        selection.select([a1!, a2!]);
        selection.setTarget(a1!);

        await load(editor, '<p>replaced</p>');

        expect(selection.selectedCells()).toEqual([]);
        expect(selection.target()).toBeNull();
        expect(() => editor.format('bold')).not.toThrow();
    });
});

describe('column resize', () => {
    it('shows the col-resize cursor near a cell border and clears it away from the border or off the table', async () => {
        const { editable, table } = await setup();
        const [a1] = cells(table);
        const rect = a1!.getBoundingClientRect();

        mouse(a1!, 'mousemove', { clientX: rect.right - 1, clientY: rect.top + 5 });
        expect(editable.style.cursor).toBe('col-resize');
        mouse(a1!, 'mousemove', { clientX: centre(a1!).x, clientY: rect.top + 5 });
        expect(editable.style.cursor).toBe('');

        mouse(a1!, 'mousemove', { clientX: rect.right - 1, clientY: rect.top + 5 });
        const p = document.createElement('p');
        editable.append(p);
        mouse(p, 'mousemove');
        expect(editable.style.cursor).toBe('');
    });

    it('dragging a border moves width from the next column into this one', async () => {
        const { table } = await setup();
        const [a1, a2, a3] = Array.from(table.rows[0]!.cells);
        const [w1, w2, w3] = [a1!, a2!, a3!].map(rectWidth);
        const tableWidth = rectWidth(table);
        const x = a1!.getBoundingClientRect().right - 1;
        const y = a1!.getBoundingClientRect().top + 5;

        mouse(a1!, 'mousemove', { clientX: x, clientY: y });
        const down = mouse(a1!, 'mousedown', { button: 0, clientX: x, clientY: y });
        mouse(document, 'mousemove', { clientX: x + 40, clientY: y });
        mouse(document, 'mouseup');

        expect(down.defaultPrevented).toBe(true);
        expect(table.style.tableLayout).toBe('fixed');
        expect(laidOutWidth(a1!)).toBeCloseTo(w1 + 40);
        expect(laidOutWidth(a2!)).toBeCloseTo(w2 - 40);
        expect(laidOutWidth(a3!)).toBeCloseTo(w3);
        expect(laidOutWidth(table)).toBeCloseTo(tableWidth);
    });

    it('resizing the last column grows the table instead of a sibling column', async () => {
        const { table } = await setup();
        const [, a2, a3] = Array.from(table.rows[0]!.cells);
        const [w2, w3] = [a2!, a3!].map(rectWidth);
        const tableWidth = rectWidth(table);
        const x = a3!.getBoundingClientRect().right - 1;
        const y = a3!.getBoundingClientRect().top + 5;

        mouse(a3!, 'mousemove', { clientX: x, clientY: y });
        mouse(a3!, 'mousedown', { button: 0, clientX: x, clientY: y });
        mouse(document, 'mousemove', { clientX: x + 40, clientY: y });
        mouse(document, 'mouseup');

        expect(laidOutWidth(a3!)).toBeCloseTo(w3 + 40);
        expect(laidOutWidth(a2!)).toBeCloseTo(w2);
        expect(laidOutWidth(table)).toBeCloseTo(tableWidth + 40);
    });

    it('keeps each column at least 60px wide', async () => {
        const { table } = await setup();
        const [a1, a2] = Array.from(table.rows[0]!.cells);
        const x = a1!.getBoundingClientRect().right - 1;
        const y = a1!.getBoundingClientRect().top + 5;

        mouse(a1!, 'mousemove', { clientX: x, clientY: y });
        mouse(a1!, 'mousedown', { button: 0, clientX: x, clientY: y });
        mouse(document, 'mousemove', { clientX: x - 10_000, clientY: y });
        mouse(document, 'mouseup');

        expect(laidOutWidth(a1!)).toBeCloseTo(60);
        expect(laidOutWidth(a2!)).toBeGreaterThan(60);
    });

    it('mirrors the drag in RTL, where the column before the border is on the right', async () => {
        const { editor, table } = await setup();
        editor.dir = 'rtl';
        await editor.updateComplete;
        const [a1, a2] = Array.from(table.rows[0]!.cells);
        const [w1, w2] = [a1!, a2!].map(rectWidth);
        const x = a1!.getBoundingClientRect().left + 1;
        const y = a1!.getBoundingClientRect().top + 5;

        mouse(a1!, 'mousemove', { clientX: x, clientY: y });
        mouse(a1!, 'mousedown', { button: 0, clientX: x, clientY: y });
        mouse(document, 'mousemove', { clientX: x - 30, clientY: y });
        mouse(document, 'mouseup');

        expect(laidOutWidth(a1!)).toBeCloseTo(w1 + 30);
        expect(laidOutWidth(a2!)).toBeCloseTo(w2 - 30);
    });

    it('does not start on a column whose first-row cell spans several columns', async () => {
        const { table } = await setup('<table><tbody><tr><td colspan="2">wide</td><td>c</td></tr><tr><td>a</td><td>b</td><td>c</td></tr></tbody></table>');
        const wide = table.rows[0]!.cells[0]!;
        const [, b] = Array.from(table.rows[1]!.cells);
        const x = b!.getBoundingClientRect().left + 1;
        const y = b!.getBoundingClientRect().top + 5;

        mouse(b!, 'mousemove', { clientX: x, clientY: y });
        mouse(b!, 'mousedown', { button: 0, clientX: x, clientY: y });
        mouse(document, 'mouseup');

        expect(table.style.tableLayout).toBe('');
        expect(wide.style.width).toBe('');
    });

    it('one drag commits the new widths as a history entry', async () => {
        const { editor, table } = await setup();
        const a1 = table.rows[0]!.cells[0]!;
        const x = a1.getBoundingClientRect().right - 1;
        const y = a1.getBoundingClientRect().top + 5;
        const before = editor.historyEntries().length;

        mouse(a1, 'mousemove', { clientX: x, clientY: y });
        mouse(a1, 'mousedown', { button: 0, clientX: x, clientY: y });
        mouse(document, 'mousemove', { clientX: x + 20, clientY: y });
        mouse(document, 'mouseup');

        expect(editor.historyEntries().length).toBe(before + 1);
        expect(editor.htmlOutput).toContain('table-layout');
    });
});

describe('touch', () => {
    it('a drag across cells selects them and keeps the page from scrolling', async () => {
        const { table, selection } = await setup();
        const [a1, a2] = cells(table);

        touch(a1!, 'touchstart', 0, 0);
        const move = touch(document, 'touchmove', centre(a2!).x, centre(a2!).y);
        touch(document, 'touchend', 0, 0);

        expect(move.defaultPrevented).toBe(true);
        expect(selection.selectedCells()).toEqual([a1, a2]);
    });

    it('a touch drag that strays off any cell or onto another table selects nothing and lets the page scroll', async () => {
        const { editor, table, selection } = await setup();
        const other = document.createElement('table');
        other.innerHTML = '<tbody><tr><td>other</td></tr></tbody>';
        editor.before(other);
        const [, , , , b2, b3] = cells(table);
        touch(b2!, 'touchstart', centre(b2!).x, centre(b2!).y);
        try {
            const otherCell = centre(other.querySelector('td')!);
            const strays = [touch(document, 'touchmove', -5, -5), touch(document, 'touchmove', otherCell.x, otherCell.y)];
            expect(strays.map((e) => e.defaultPrevented)).toEqual([false, false]);
            expect(selection.selectedCells()).toEqual([]);

            const onTable = touch(document, 'touchmove', centre(b3!).x, centre(b3!).y);
            expect(onTable.defaultPrevented).toBe(true);
            expect(selection.selectedCells()).toEqual([b2, b3]);
        } finally {
            touch(document, 'touchend', 0, 0);
            other.remove();
        }
    });

    it('a touch on a border resizes the column and keeps the page from scrolling', async () => {
        const { table } = await setup();
        const [a1, a2] = Array.from(table.rows[0]!.cells);
        const [w1, w2] = [a1!, a2!].map(rectWidth);
        const x = a1!.getBoundingClientRect().right - 1;
        const y = a1!.getBoundingClientRect().top + 5;

        const start = touch(a1!, 'touchstart', x, y);
        const move = touch(document, 'touchmove', x + 40, y);
        touch(document, 'touchend', 0, 0);

        expect(start.defaultPrevented).toBe(true);
        expect(move.defaultPrevented).toBe(true);
        expect(laidOutWidth(a1!)).toBeCloseTo(w1 + 40);
        expect(laidOutWidth(a2!)).toBeCloseTo(w2 - 40);
    });

    it.each(['disabled', 'readonly'] as const)('neither resizes a column nor drag-selects cells while %s', async (state) => {
        const { editor, table, selection } = await setup();
        editor[state] = true;
        await editor.updateComplete;
        const [a1, a2] = Array.from(table.rows[0]!.cells);
        const rect = a1!.getBoundingClientRect();

        touch(a1!, 'touchstart', rect.right - 1, rect.top + 5);
        expect(table.style.tableLayout).toBe('');

        touch(a1!, 'touchstart', centre(a1!).x, centre(a1!).y);
        touch(document, 'touchmove', centre(a2!).x, centre(a2!).y);
        touch(document, 'touchend', 0, 0);
        expect(selection.selectedCells()).toEqual([]);
    });

    it('selection by touch stops working once the control is disabled', async () => {
        const { editor, table, selection } = await setup('<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>');
        const [a, b] = cells(table);
        const drag = () => {
            touch(a!, 'touchstart', centre(a!).x, centre(a!).y);
            touch(document, 'touchmove', centre(b!).x, centre(b!).y);
            touch(document, 'touchend', 0, 0);
        };

        drag();
        expect(selection.selectedCells()).toEqual([a, b]);
        touch(a!, 'touchstart', centre(a!).x, centre(a!).y);
        touch(document, 'touchend', 0, 0);
        expect(selection.selectedCells()).toEqual([]);

        editor.disabled = true;
        await editor.updateComplete;
        drag();
        expect(selection.selectedCells()).toEqual([]);
    });
});

describe('context menu', () => {
    it('opens at the pointer over a cell, with the browser menu suppressed', async () => {
        const { editor, table, selection } = await setup();
        const cell = cells(table)[0]!;

        const event = rightClick(cell, 50, 60);
        await editor.updateComplete;

        expect(event.defaultPrevented).toBe(true);
        expect(selection.target()).toBe(cell);
        expect(menuOf(editor)).not.toBeNull();
        expect(menuOf(editor)!.style.left).toBe('50px');
        expect(menuOf(editor)!.style.top).toBe('60px');
    });

    it('leaves the native menu alone outside a table, and closes an open one', async () => {
        const { editor, editable, table } = await setup();
        editable.insertAdjacentHTML('beforeend', '<p>not a table</p>');
        rightClick(cells(table)[0]!);
        await editor.updateComplete;
        expect(menuOf(editor)).not.toBeNull();

        const event = rightClick(editable.querySelector('p')!, 5, 5);
        await editor.updateComplete;

        expect(event.defaultPrevented).toBe(false);
        expect(menuOf(editor)).toBeNull();
    });

    it('moves into the viewport when opened at its far corner', async () => {
        const { editor, table } = await setup();

        rightClick(cells(table)[0]!, innerWidth - 2, innerHeight - 2);

        await vi.waitFor(() => {
            const rect = menuOf(editor)!.getBoundingClientRect();
            expect(rect.right).toBeLessThanOrEqual(innerWidth);
            expect(rect.bottom).toBeLessThanOrEqual(innerHeight);
        });
    });

    it('closes on the next click anywhere in the document', async () => {
        const { editor, table } = await setup();
        rightClick(cells(table)[0]!);
        await editor.updateComplete;
        await new Promise((resolve) => setTimeout(resolve));

        document.body.click();
        await editor.updateComplete;

        expect(menuOf(editor)).toBeNull();
    });

    it('a right-click on the open menu re-targets to the cell beneath it', async () => {
        const { editor, table, selection } = await setup();
        const [a1, a2] = cells(table);
        rightClick(a1!, centre(a1!).x, centre(a1!).y);
        await editor.updateComplete;
        const menu = menuOf(editor)!;
        vi.spyOn(document, 'elementFromPoint').mockReturnValue(a2!);

        const event = mouse(menu, 'contextmenu', { clientX: 70, clientY: 80 });
        await editor.updateComplete;

        expect(event.defaultPrevented).toBe(true);
        expect(selection.target()).toBe(a2);
        expect(menuOf(editor)).not.toBeNull();
        expect(menuOf(editor)!.style.left).toBe('70px');
    });

    it('a right-click on the open menu over no cell closes it', async () => {
        const { editor, table } = await setup();
        rightClick(cells(table)[0]!);
        await editor.updateComplete;
        vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.body);

        mouse(menuOf(editor)!, 'contextmenu', { clientX: 1, clientY: 1 });
        await editor.updateComplete;

        expect(menuOf(editor)).toBeNull();
    });

    it('offers merge only with two cells picked and split only on a spanning cell', async () => {
        const { editor, table, selection } = await setup();
        const [a1, a2] = cells(table);
        const labels = () => Array.from(menuOf(editor)!.querySelectorAll('.item'), (b) => b.textContent!.trim());

        rightClick(a1!);
        await editor.updateComplete;
        expect(labels()).not.toContain('Merge Cells');
        expect(labels()).not.toContain('Split Cell');

        selection.select([a1!, a2!]);
        a1!.colSpan = 2;
        editor.invalidate();
        await editor.updateComplete;
        expect(labels()).toContain('Merge Cells');
        expect(labels()).toContain('Split Cell');
    });

    it('a menu item runs its command on the targeted cell and closes the menu', async () => {
        const { editor, table } = await setup();
        const a1 = cells(table)[0]!;
        rightClick(a1);
        await editor.updateComplete;

        const item = Array.from(menuOf(editor)!.querySelectorAll<HTMLButtonElement>('.item')).find((b) => b.textContent!.trim() === 'Insert Row Above')!;
        item.click();
        await editor.updateComplete;

        expect(table.rows).toHaveLength(3);
        expect(table.rows[1]!.cells[0]!.textContent).toBe('A1');
        expect(menuOf(editor)).toBeNull();
    });

    it('mergeCells and splitCell from the menu close it (Angular spec 1790, 1803)', async () => {
        const { editor, table, selection } = await setup();
        const [a1, a2] = cells(table);
        const choose = async (label: string) => {
            rightClick(a1!);
            await editor.updateComplete;
            Array.from(menuOf(editor)!.querySelectorAll<HTMLButtonElement>('.item')).find((b) => b.textContent!.trim() === label)!.click();
            await editor.updateComplete;
        };
        selection.select([a1!, a2!]);

        await choose('Merge Cells');
        expect(a1!.colSpan).toBe(2);
        expect(menuOf(editor)).toBeNull();

        await choose('Split Cell');
        expect(a1!.colSpan).toBe(1);
        expect(menuOf(editor)).toBeNull();
    });

    it('swatches and the alignment buttons act on the target', async () => {
        const { editor, table } = await setup();
        const a1 = cells(table)[0]!;
        rightClick(a1);
        await editor.updateComplete;

        menuOf(editor)!.querySelector<HTMLButtonElement>('.swatch[aria-label="#fef3c7"]')!.click();
        expect(a1.style.backgroundColor).toBe('rgb(254, 243, 199)');

        rightClick(a1);
        await editor.updateComplete;
        menuOf(editor)!.querySelectorAll<HTMLButtonElement>('.tool')[5]!.click();
        expect(a1.style.textAlign).toBe('center');
    });

    it('ignores a menu action whose target was detached by an undo', async () => {
        const { editor, editable, table, selection } = await setup();
        const merged = cells(table)[0]!;
        merged.colSpan = 2;
        editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        selection.setTarget(merged);

        editable.innerHTML = '<p>replaced</p>';
        editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));

        const commands = editor.provider('tableCommands')!;
        expect(merged.isConnected).toBe(false);
        expect(commands.canSplitCell()).toBe(false);
        commands.splitCell();
        expect(merged.getAttribute('colspan')).toBe('2');
    });
});
