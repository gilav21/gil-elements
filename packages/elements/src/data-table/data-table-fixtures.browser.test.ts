import { afterEach, describe, expect, it } from 'vitest';
import {
    ariaIndexes, axProps, axTree, bodyRows, cellAt, dataIndexes, headCell, makeColumns, makeRows, mountTable, q, qa, roving, settle, trackTable,
} from './data-table-fixtures.js';
import {
    countConstructions, emulateTouch, frames, idle, mouseDblClick, mouseDrag, parkMouse, perf, press, scrollGrid, touchDrag, touchLongPress, touchTap, wheel, withRtl, withTheme,
} from './data-table-input-fixtures.js';

/** A fixed-size box in the page that is removed after the test. */
function box(css: string, inner = ''): HTMLElement {
    const el = trackTable(document.createElement('div'));
    el.style.cssText = css;
    el.innerHTML = inner;
    document.body.append(el);
    return el;
}

afterEach(() => {
    parkMouse();
    document.documentElement.classList.remove('dark');
});

describe('the data fixtures', () => {
    it('makes rows, tree rows, groups and wide rows', () => {
        expect(makeRows(3).map((r) => [r.id, r.name, r.age])).toEqual([['r0', 'n0', 0], ['r1', 'n1', 1], ['r2', 'n2', 2]]);
        expect(makeRows(4, { groups: 2 }).map((r) => r['group'])).toEqual(['g0', 'g1', 'g0', 'g1']);
        const tree = makeRows(2, { children: 2 });
        expect((tree[1]!['children'] as { id: string }[]).map((c) => c.id)).toEqual(['r1-c0', 'r1-c1']);
        expect(makeRows(1, { columns: 3 })[0]).toMatchObject({ c0: '0.0', c2: '0.2' });
    });

    it('makes columns, pinned at either end', () => {
        const columns = makeColumns(4, { width: '90px', pinLeft: 1, pinRight: 1 });
        expect(columns.map((c) => [c.accessorKey, c.width, c.pin ?? null])).toEqual([['c0', '90px', 'left'], ['c1', '90px', null], ['c2', '90px', null], ['c3', '90px', 'right']]);
    });
});

describe('the table fixtures', () => {
    it('mounts a table with the sample data, settled, and reads the rendered grid', async () => {
        const table = await mountTable();

        expect(dataIndexes(table)).toEqual([0, 1, 2, 3]);
        expect(ariaIndexes(table)).toEqual([2, 3, 4, 5]);
        expect(bodyRows(table)).toHaveLength(4);
        expect(cellAt(table, 2, 'name')?.textContent?.trim()).toBe('Bob');
        expect(cellAt(table, 9, 'name')).toBeNull();
        expect(headCell(table, 'age').getAttribute('role')).toBe('columnheader');
        expect(roving(table)).toEqual([q(table, '[data-slot="data-table-viewport"]')]);
    });

    it('mounts inside a sized box when asked, and takes properties and attributes', async () => {
        const table = await mountTable({ data: makeRows(100), columns: makeColumns(3), showPagination: false }, { 'show-toolbar': 'false' }, { width: 400, height: '300px' });
        const frame = table.parentElement!;

        expect(frame.getBoundingClientRect().width).toBe(400);
        expect(frame.getBoundingClientRect().height).toBe(300);
        expect(bodyRows(table)).toHaveLength(100);
        expect(table.getAttribute('show-toolbar')).toBe('false');
    });

    it('settles after a property write, so the next read sees the new rows', async () => {
        const table = await mountTable();
        table.data = makeRows(2);
        await settle(table);

        expect(dataIndexes(table)).toEqual([0, 1]);
        expect(qa(table, '[data-slot="table-row"]').length).toBeGreaterThan(2);
    });

    it('reads the accessibility tree: the grid, a cell and its properties', async () => {
        const table = await mountTable({ enableRowSelection: true, rowSelection: { b: true } });
        const nodes = await axTree();
        const grid = nodes.find((n) => n.role?.value === 'grid');
        const selected = nodes.filter((n) => n.role?.value === 'row' && axProps(n)['selected'] === true);

        expect(grid).toBeDefined();
        expect(axProps(grid)['multiselectable']).toBe(true);
        expect(selected).toHaveLength(1);
        expect(nodes.some((n) => n.role?.value === 'gridcell' && n.name?.value === 'Bob')).toBe(true);
        expect(table.isConnected).toBe(true);
    });
});

describe('the input fixtures: pointer and wheel', () => {
    it('frames and idle wait for real frames', async () => {
        const start = performance.now();
        await frames(3);
        const target = new EventTarget();
        setTimeout(() => target.dispatchEvent(new Event('scrollend')), 30);
        await idle(target);

        expect(performance.now() - start).toBeGreaterThanOrEqual(30);
    });

    it('scrollGrid scrolls a scroller and a table viewport and resolves once it landed', async () => {
        const scroller = box('width: 200px; height: 100px; overflow: auto;', '<div style="width: 800px; height: 800px"></div>');
        await scrollGrid(scroller, { top: 120, left: 60 });
        expect([scroller.scrollTop, scroller.scrollLeft]).toEqual([120, 60]);

        const table = await mountTable({ data: makeRows(200), showPagination: false }, {}, { width: 500, height: 300 });
        await scrollGrid(table, { top: 400 });
        expect(q(table, '[data-slot="data-table-viewport"]').scrollTop).toBe(400);
        await scrollGrid(table, { top: 400 });
        expect(q(table, '[data-slot="data-table-viewport"]').scrollTop).toBe(400);
    });

    it('wheel scrolls the scroller under the pointer with a real wheel event', async () => {
        const scroller = box('width: 200px; height: 100px; overflow: auto;', '<div style="width: 800px; height: 800px"></div>');
        const seen: number[] = [];
        scroller.addEventListener('wheel', (event) => seen.push(event.deltaY), { passive: true });
        await wheel(scroller, 0, 90);
        await frames(3);

        expect(seen[0]).toBe(90);
        expect(scroller.scrollTop).toBeGreaterThan(0);
    });

    it('mouseDrag drives a pointer-capturing element through real moves, and hit-tests where it ends', async () => {
        const area = box('width: 400px; height: 100px; position: relative;', '<div id="knob" style="position: absolute; left: 20px; top: 20px; width: 40px; height: 40px; touch-action: none;"></div>');
        const knob = area.querySelector<HTMLElement>('#knob')!;
        const log: string[] = [];
        let x = 0;
        knob.addEventListener('pointerdown', (e) => {
            knob.setPointerCapture(e.pointerId);
            x = e.clientX;
            log.push('down');
        });
        knob.addEventListener('pointermove', (e) => {
            if (knob.hasPointerCapture(e.pointerId)) knob.style.left = `${20 + e.clientX - x}px`;
        });
        knob.addEventListener('pointerup', () => log.push(`up:${knob.hasPointerCapture(1) ? 'captured' : 'free'}`));
        const before = knob.getBoundingClientRect().left;

        await mouseDrag(knob, { dx: 150, dy: 0 }, { steps: 5 });

        expect(log[0]).toBe('down');
        expect(log.at(-1)).toMatch(/^up/);
        // The pointer left the knob's box on the first moves: only capture keeps it following.
        expect(knob.getBoundingClientRect().left - before).toBeCloseTo(150, 0);
    });

    it('mouseDblClick delivers click, click and dblclick, and parkMouse takes the pointer away', async () => {
        const button = trackTable(document.createElement('button'));
        button.textContent = 'x';
        document.body.append(button);
        const events: string[] = [];
        for (const type of ['click', 'dblclick']) button.addEventListener(type, () => events.push(type));

        await mouseDblClick(button);
        expect(events).toEqual(['click', 'click', 'dblclick']);
        expect(button.matches(':hover')).toBe(true);

        await parkMouse();
        expect(button.matches(':hover')).toBe(false);
    });

    it('press sends a real key and waits a frame', async () => {
        const button = trackTable(document.createElement('button'));
        document.body.append(button);
        let clicks = 0;
        button.addEventListener('click', () => clicks++);
        button.focus();

        await press('{Enter}');
        expect(clicks).toBe(1);
    });
});

describe('the input fixtures: touch', () => {
    it('touchLongPress flips (pointer: coarse), holds, and lifts', async () => {
        const area = box('width: 200px; height: 100px;');
        const events: string[] = [];
        for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend']) area.addEventListener(type, (e) => events.push(`${type}:${(e as PointerEvent).pointerType ?? 'touch'}`));
        expect(matchMedia('(pointer: coarse)').matches).toBe(false);

        const start = performance.now();
        await touchLongPress(area, 300);

        expect(performance.now() - start).toBeGreaterThanOrEqual(300);
        expect(matchMedia('(pointer: coarse)').matches).toBe(true);
        expect(events).toEqual(['pointerdown:touch', 'touchstart:touch', 'pointerup:touch', 'touchend:touch']);
    });

    it('touch emulation is off again for the next test', async () => {
        expect(matchMedia('(pointer: coarse)').matches).toBe(false);
        await emulateTouch(true);
        expect(matchMedia('(pointer: coarse)').matches).toBe(true);
    });

    it('touchTap clicks and touchDrag moves a finger over a touch-action: none element', async () => {
        const area = box('width: 300px; height: 100px; touch-action: none;');
        const log: string[] = [];
        area.addEventListener('click', () => log.push('click'));
        const moves: number[] = [];
        area.addEventListener('pointermove', (e) => moves.push(e.clientX));

        await touchTap(area);
        expect(log).toEqual(['click']);

        await touchDrag(area, { dx: 100, dy: 0 }, { steps: 4 });
        expect(moves.length).toBeGreaterThan(1);
        expect(moves.at(-1)! - moves[0]!).toBeGreaterThan(50);
    });
});

describe('the input fixtures: measuring and environment', () => {
    it('perf returns plain numbers for script, layout, style, nodes, long tasks and frames', async () => {
        const area = box('width: 200px;');
        const result = await perf(async () => {
            for (let i = 0; i < 20; i++) {
                area.insertAdjacentHTML('beforeend', '<p>row</p>');
                void area.offsetHeight;
                await frames(1);
            }
            const end = performance.now() + 70;
            while (performance.now() < end);
        });

        expect(result.elapsedMs).toBeGreaterThan(0);
        expect(result.layoutCount).toBeGreaterThan(0);
        expect(result.scriptMs).toBeGreaterThan(0);
        expect(result.nodes).toBeGreaterThan(20);
        expect(result.frameDeltas.length).toBeGreaterThan(10);
        expect(result.p95FrameMs).toBeGreaterThan(0);
        expect(result.longTasks).toBeGreaterThanOrEqual(1);
        expect(result.maxLongTaskMs).toBeGreaterThan(50);
        for (const value of [result.layoutMs, result.styleMs]) expect(Number.isFinite(value)).toBe(true);
    });

    it('countConstructions counts the elements the table builds for a component column', async () => {
        const made = countConstructions('dt-fixture-badge');
        expect(countConstructions('dt-fixture-badge').count).toBe(0);
        await mountTable({ columns: [{ accessorKey: 'name', header: 'Name', component: 'dt-fixture-badge' }] });

        expect(made.count).toBe(4);
        made.reset();
        expect(made.count).toBe(0);
    });

    it('withRtl flips the table to right-to-left, and withTheme switches the page theme', async () => {
        const table = await mountTable();
        expect(getComputedStyle(table).direction).toBe('ltr');
        await withRtl(table);
        expect(getComputedStyle(table).direction).toBe('rtl');

        withTheme('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
});
