import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Disposables, TopicBus } from '../shared/registry.js';
import { classifyChange, diffFlashes, flashColumns, sameCellValue, snapshotFlash } from './data-table-flash.js';
import { flashMs, FormattingController } from './data-table-formatting-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';
import type { ColumnDef } from './data-table.types.js';

interface NumRow {
    id: string;
    name: string;
    score: number;
}
// Angular's flash fixture (spec 4643): ids 1..5.
const NUM: NumRow[] = [
    { id: '1', name: 'Alice', score: 30 },
    { id: '2', name: 'Bob', score: 10 },
    { id: '3', name: 'Charlie', score: 20 },
];
const COLS: ColumnDef<NumRow>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'score', header: 'Score' },
];
const getId = (r: NumRow): string => r.id;

/** Angular's flow: diff the new data against the snapshot of the old. */
function flashOf(next: NumRow[], columns: ColumnDef<NumRow>[] = COLS, before: NumRow[] = NUM) {
    const cols = flashColumns(columns);
    return diffFlashes(snapshotFlash(before, cols, getId), next, cols, getId);
}

describe('classifyChange (Angular classifyChange, with blanks fixed in review round 4)', () => {
    it('numbers go up or down, anything else is changed', () => {
        expect(classifyChange(30, 999)).toBe('up');
        expect(classifyChange(10, 1)).toBe('down');
        expect(classifyChange('7', 8)).toBe('up'); // numbers as text are numbers
        expect(classifyChange('Alice', 'Alicia')).toBe('changed');
        expect(classifyChange(true, false)).toBe('down'); // booleans stay numeric, as in Angular
    });

    it('a blank side (null, undefined, "") is no number: changed, not up or down; null and undefined alike', () => {
        expect(classifyChange(null, 5)).toBe('changed');
        expect(classifyChange(undefined, 5)).toBe('changed');
        expect(classifyChange('', 3)).toBe('changed');
        expect(classifyChange(5, null)).toBe('changed');
        expect(classifyChange(5, undefined)).toBe('changed');
        expect(classifyChange(null, 0)).toBe('changed'); // Number(null) is 0, but a blank that became 0 is no "down" nor "up"
        expect(classifyChange('', 0)).toBe('changed');
    });

    it('two values that read as the same number are changed, never up or down', () => {
        expect(classifyChange(5, '5')).toBe('changed');
        expect(classifyChange(1, true)).toBe('changed');
    });
});

describe('flashMs (cell-flash-duration guarded)', () => {
    it('uses the default 500 ms for a duration that is not a finite, non-negative number', () => {
        expect(flashMs(Number('abc'))).toBe(500);
        expect(flashMs('abc')).toBe(500);
        expect(flashMs(-1)).toBe(500);
        expect(flashMs(Number.POSITIVE_INFINITY)).toBe(500);
        expect(flashMs(150)).toBe(150);
        expect(flashMs(0)).toBe(0);
    });
});

describe('diffFlashes (ports of spec 4658-4740)', () => {
    it('flashes "up" when a numeric value increases and "down" when it decreases', () => {
        const next = structuredClone(NUM);
        next[0] = { ...next[0]!, score: 999 };
        next[1] = { ...next[1]!, score: 1 };
        const flashes = flashOf(next);
        expect(flashes.get('1')?.get('score')).toBe('up');
        expect(flashes.get('2')?.get('score')).toBe('down');
    });

    it('flashes "changed" for non-numeric value changes', () => {
        const next = structuredClone(NUM);
        next[0] = { ...next[0]!, name: 'Alicia' };
        expect(flashOf(next).get('1')?.get('name')).toBe('changed');
    });

    it('does not flash the cells that did not change', () => {
        const next = structuredClone(NUM);
        next[0] = { ...next[0]!, score: 999 };
        const flashes = flashOf(next);
        expect(flashes.get('1')?.get('name')).toBeUndefined();
        expect(flashes.get('2')).toBeUndefined();
        expect(flashes.size).toBe(1);
    });

    it('skips columns with enableCellFlash=false and the special columns (selection, expander, actions)', () => {
        const columns = [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name' },
            { accessorKey: 'score', header: 'Score', enableCellFlash: false },
            { accessorKey: '_actions', header: 'Actions', accessorFn: (r: NumRow) => r.score },
            { accessorKey: '_selection', header: '', accessorFn: (r: NumRow) => r.score },
        ] as ColumnDef<NumRow>[];
        const next = structuredClone(NUM);
        next[0] = { ...next[0]!, score: 999 };
        expect(flashOf(next, columns).size).toBe(0);
    });

    it('flashes a data column whose key merely starts with an underscore (only the special columns are skipped)', () => {
        const columns = [{ accessorKey: 'id', header: 'ID' }, { accessorKey: '_score', header: 'Score', accessorFn: (r: NumRow) => r.score }] as ColumnDef<NumRow>[];
        expect(flashColumns(columns).map((c) => c.accessorKey)).toEqual(['id', '_score']);
        const next = structuredClone(NUM);
        next[0] = { ...next[0]!, score: 999 };
        expect([...flashOf(next, columns).values()].flatMap((cells) => [...cells.keys()])).toEqual(['_score']);
    });

    it('does not flash a value that did not change: the same number as text, the same instant, the same object', () => {
        expect(sameCellValue(5, 5)).toBe(true);
        expect(sameCellValue('5', 5)).toBe(true);
        expect(sameCellValue(5, '5.0')).toBe(true);
        expect(sameCellValue(true, 1)).toBe(true);
        expect(sameCellValue(new Date(2024, 0, 1), new Date(2024, 0, 1))).toBe(true);
        expect(sameCellValue(Number.NaN, Number.NaN)).toBe(true);
        const shared = { a: 1 };
        expect(sameCellValue(shared, shared)).toBe(true);
        // changed
        expect(sameCellValue(5, 6)).toBe(false);
        expect(sameCellValue(new Date(2024, 0, 1), new Date(2024, 0, 2))).toBe(false);
        expect(sameCellValue({ a: 1 }, { a: 1 })).toBe(false); // another object: changed
        expect(sameCellValue('a', 'b')).toBe(false);
        // blanks are not 0
        expect(sameCellValue(null, 0)).toBe(false);
        expect(sameCellValue('', 0)).toBe(false);
        expect(sameCellValue(undefined, null)).toBe(false);
    });

    it('a data refresh that re-serialises numbers as text (or re-creates equal dates) flashes nothing', () => {
        const columns: ColumnDef<NumRow>[] = [{ accessorKey: 'id', header: 'ID' }, { accessorKey: 'score', header: 'Score' }];
        const next = NUM.map((r) => ({ ...r, score: String(r.score) as unknown as number }));
        expect(flashOf(next, columns).size).toBe(0);
    });

    it('flashes cells whose value comes from an accessorFn', () => {
        const columns: ColumnDef<NumRow>[] = [{ accessorKey: 'id', header: 'ID' }, { accessorKey: 'score', header: 'Score', accessorFn: (r) => r.score * 2 }];
        const next = structuredClone(NUM);
        next[0] = { ...next[0]!, score: 999 };
        expect(flashOf(next, columns).get('1')?.get('score')).toBe('up');
    });

    it('a row that was not in the snapshot (not drawn, or new) does not flash', () => {
        const next = [...structuredClone(NUM), { id: '9', name: 'New', score: 1 }];
        next[2] = { ...next[2]!, score: 50 };
        expect(flashOf(next, COLS, NUM.slice(0, 2)).size).toBe(0); // row 3 was not drawn before; row 9 is new
    });

    it('reads ids as strings', () => {
        const rows = [{ n: 1, v: 1 }];
        const byNumber = (r: { n: number }): string => r.n as unknown as string;
        const cols: ColumnDef<{ n: number; v: number }>[] = [{ accessorKey: 'v', header: 'V' }];
        expect(diffFlashes(snapshotFlash(rows, cols, byNumber), [{ n: 1, v: 2 }], cols, byNumber).get('1')?.get('v')).toBe('up');
    });
});

/** The smallest host the formatting controller needs: data in a model, rows drawn as given, a duration. */
function fakeHost(config: Record<string, unknown>) {
    let data: NumRow[] = structuredClone(NUM);
    const providers: Record<string, unknown> = {};
    const renders = { count: 0 };
    const host = {
        config: { columns: COLS, getRowId: getId, enableCellFlash: true, cellFlashDuration: 100, ...config },
        model: { get: () => data },
        root: { style: { setProperty: vi.fn(), removeProperty: vi.fn() } },
        disposables: new Disposables(),
        topics: new TopicBus(),
        provide: (key: string, value: unknown) => {
            providers[key] = value;
            return () => delete providers[key];
        },
        provider: (key: string) => providers[key],
        requestRender: () => renders.count++,
    };
    providers['query'] = { renderedRows: () => data };
    return {
        host: host as unknown as DataTableCoreHost<NumRow>,
        setData: (next: NumRow[]) => (data = next),
        renders,
        formatting: () => providers['formatting'] as { flash(id: string, key: string): string | undefined; anyFlashing(): boolean },
    };
}

describe('FormattingController flash: per-cell expiry (AB4)', () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] }));
    afterEach(() => vi.useRealTimers());

    it('a second update before the first expires keeps the first cell flashing to its own deadline, and clears each on time', () => {
        const t = fakeHost({});
        const controller = new FormattingController(t.host);
        controller.attach();
        controller.hostUpdate(); // the first snapshot: nothing flashes
        expect(t.formatting().anyFlashing()).toBe(false);
        const first = structuredClone(NUM);
        first[0]!.score = 99;
        t.setData(first);
        controller.hostUpdate();
        expect(t.formatting().flash('1', 'score')).toBe('up');
        vi.advanceTimersByTime(60);
        const second = structuredClone(first);
        second[1]!.score = 0;
        t.setData(second);
        controller.hostUpdate();
        expect(t.formatting().flash('2', 'score')).toBe('down');
        vi.advanceTimersByTime(45); // 105 ms: the first expired on its own deadline, the second still runs (Angular's single timer would have cut it or kept the first)
        expect(t.formatting().flash('1', 'score')).toBeUndefined();
        expect(t.formatting().flash('2', 'score')).toBe('down');
        expect(t.renders.count).toBe(1);
        vi.advanceTimersByTime(60);
        expect(t.formatting().anyFlashing()).toBe(false);
        expect(t.renders.count).toBe(2);
        controller.detach();
    });

    it('flash off forgets the snapshot and the flashes; detach cancels the timer', () => {
        const t = fakeHost({});
        const controller = new FormattingController(t.host);
        controller.attach();
        controller.hostUpdate();
        const next = structuredClone(NUM);
        next[0]!.name = 'X';
        t.setData(next);
        controller.hostUpdate();
        expect(t.formatting().anyFlashing()).toBe(true);
        (t.host.config as { enableCellFlash: boolean }).enableCellFlash = false;
        controller.hostUpdate();
        expect(t.formatting().anyFlashing()).toBe(false);
        expect(t.host.root.style.removeProperty).toHaveBeenCalledWith('--ge-dt-flash-ms');
        controller.detach();
        vi.advanceTimersByTime(1000);
        expect(t.renders.count).toBe(0);
    });

    it('writes the duration to --ge-dt-flash-ms', () => {
        const t = fakeHost({ cellFlashDuration: 250 });
        const controller = new FormattingController(t.host);
        controller.attach();
        controller.hostUpdate();
        expect(t.host.root.style.setProperty).toHaveBeenCalledWith('--ge-dt-flash-ms', '250ms');
        controller.detach();
    });
});
