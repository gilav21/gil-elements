import { afterEach, describe, expect, it, vi } from 'vitest';
import { Disposables } from '../shared/registry.js';
import { ClipboardController, neutralClipboard, READ_TIMEOUT_MS } from './data-table-clipboard-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';
import { DATA_TABLE_LOCALES } from './data-table.locales.js';
import type { ClipboardService } from './data-table-providers.js';

interface Row {
    id: string;
    n: number;
}

const ROWS: Row[] = [
    { id: '1', n: 1 },
    { id: '2', n: 2 },
];
const COLUMNS = [{ accessorKey: 'id', header: 'ID' }, { accessorKey: 'n', header: 'N', valueSetter: (row: Row, v: unknown) => ({ ...row, n: v as number }) }];

/** A fake host with the providers a clipboard reads; `keys` is the clipboard's key handler once attached. */
function fakeHost(config: Partial<{ enableCopy: boolean; enableClipboardPaste: boolean; loading: boolean }> = {}) {
    let focused: { rowIndex: number; columnKey: string } | null = { rowIndex: 0, columnKey: 'n' };
    let editing: { rowIndex: number; columnKey: string } | null = null;
    let keys: ((event: KeyboardEvent) => boolean) | undefined;
    const provided = new Map<string, unknown>();
    const providers: Record<string, unknown> = {
        interaction: { focusedCell: () => focused, editingCell: () => editing },
        query: {
            renderedRowAt: (i: number) => ROWS[i],
            renderedRows: () => ROWS,
            sortedData: () => ROWS,
            groupRows: () => [],
            cellValue: (row: Row, key: string) => row[key as keyof Row],
            exportData: () => [['ID', 'N'], ...ROWS.map((r) => [r.id, String(r.n)])],
        },
        columns: { enhancedColumns: () => COLUMNS, navigableKeys: () => ['id', 'n'] },
    };
    // A root the grid-key rule (`onGrid`) recognises as the table itself (a key typed on the grid with the roving focus), with a document to listen on.
    const root: EventTarget & Record<string, unknown> = Object.assign(new EventTarget(), {
        ownerDocument: new EventTarget(),
        closest: (selector: string) => (selector === 'ge-data-table' ? root : null),
        matches: () => false,
        contains: () => false,
        querySelectorAll: () => [],
    });
    const host = {
        config: { enableCopy: true, enableClipboardPaste: true, loading: false, getRowId: (row: Row) => row.id, enableCellRangeSelection: false, enableFillHandle: false, ...config },
        root,
        cellAt: () => null,
        disposables: new Disposables(),
        model: { get: () => ({}) },
        resolvedLocale: DATA_TABLE_LOCALES.en,
        announce: vi.fn(),
        emit: vi.fn(),
        requestRender: vi.fn(),
        runAsCommand: <R>(fn: () => R): R => fn(),
        writeCells: vi.fn((requests: readonly unknown[]) => requests.map(() => ({ status: 'written' }))),
        provide: (key: string, value: unknown) => {
            provided.set(key, value);
            return () => provided.delete(key);
        },
        provider: (key: string) => provided.get(key) ?? providers[key],
        addKeyHandler: (_priority: number, fn: (event: KeyboardEvent) => boolean) => {
            keys = fn;
            return () => (keys = undefined);
        },
    };
    return {
        host: host as unknown as DataTableCoreHost<Row>,
        raw: host,
        key: (init: Partial<KeyboardEvent>) => {
            const event = { key: 'c', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, isComposing: false, defaultPrevented: false, target: root, composedPath: () => [], preventDefault: vi.fn(), ...init };
            return { consumed: keys?.(event as unknown as KeyboardEvent) ?? false, event };
        },
        service: () => provided.get('clipboard') as ClipboardService<Row>,
        focus: (cell: typeof focused) => (focused = cell),
        edit: (cell: typeof editing) => (editing = cell),
    };
}

/** The paste part loads through a dynamic import: wait for it. */
const loaded = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

function stubClipboard(clipboard: Partial<Clipboard> | undefined): void {
    vi.stubGlobal('navigator', clipboard === undefined ? {} : { clipboard });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('ClipboardController', () => {
    it('asks for no render when its paste part attaches: nothing is drawn from it', async () => {
        const t = fakeHost();
        const controller = new ClipboardController(t.host);
        controller.attach();
        controller.hostUpdate();
        await loaded();
        expect(t.raw.requestRender).not.toHaveBeenCalled();
        controller.detach();
    });

    it('Ctrl+C copies the focused cell and announces it; consumed only with a writable clipboard', async () => {
        const writeText = vi.fn(() => Promise.resolve());
        stubClipboard({ writeText });
        const t = fakeHost();
        const controller = new ClipboardController(t.host);
        controller.attach();
        const { consumed, event } = t.key({});
        expect(consumed).toBe(true);
        expect(event.preventDefault).toHaveBeenCalled();
        await loaded();
        expect(writeText).toHaveBeenCalledWith('1');
        expect(t.raw.announce).toHaveBeenCalledWith('1 cell copied');

        stubClipboard(undefined); // no API: the browser's own copy event follows
        expect(t.key({}).consumed).toBe(false);
        controller.detach();
    });

    it('leaves Ctrl+C alone with enable-copy off, from a text field, with Shift or Alt, and with nothing to copy', () => {
        stubClipboard({ writeText: vi.fn(() => Promise.resolve()) });
        const off = fakeHost({ enableCopy: false });
        new ClipboardController(off.host).attach();
        expect(off.key({}).consumed).toBe(false);

        const t = fakeHost();
        new ClipboardController(t.host).attach();
        const input = { matches: (selector: string) => selector.includes('input'), closest: () => null };
        expect(t.key({ composedPath: () => [input as unknown as EventTarget] }).consumed).toBe(false);
        expect(t.key({ shiftKey: true }).consumed).toBe(false);
        expect(t.key({ altKey: true }).consumed).toBe(false);
        expect(t.key({ ctrlKey: false }).consumed).toBe(false);
        t.focus(null);
        expect(t.key({}).consumed).toBe(false); // nothing focused, ranged or selected
    });

    it('catches a refused write: denied, announced, no rejection', async () => {
        stubClipboard({ writeText: () => Promise.reject(new DOMException('no', 'NotAllowedError')) });
        const t = fakeHost();
        new ClipboardController(t.host).attach();
        await expect(t.service().copy('cell')).resolves.toEqual({ status: 'denied' });
        expect(t.raw.announce).toHaveBeenCalledWith('Could not copy to the clipboard');
    });

    it('answers the copy scopes: ignored while off (the range copy is not gated, as in Angular), unavailable without the API, empty with nothing', async () => {
        const off = fakeHost({ enableCopy: false });
        new ClipboardController(off.host).attach();
        await expect(off.service().copy('all')).resolves.toEqual({ status: 'ignored' });
        stubClipboard(undefined);
        await expect(off.service().copy('range')).resolves.toEqual({ status: 'unavailable' });
        const writeText = vi.fn(() => Promise.resolve());
        stubClipboard({ writeText });
        await expect(off.service().copy('range')).resolves.toEqual({ status: 'empty' }); // no range
        const t = fakeHost();
        new ClipboardController(t.host).attach();
        await expect(t.service().copy('all')).resolves.toEqual({ status: 'done', cells: 6 });
        expect(writeText).toHaveBeenLastCalledWith('ID\tN\n1\t1\n2\t2');
        await expect(t.service().copy('selected')).resolves.toEqual({ status: 'empty' });
    });

    it('leaves Ctrl+V to the browser (its native paste carries the text, no prompt); paste() reads once, at the target taken at call time', async () => {
        let release: (text: string) => void = () => undefined;
        const readText = vi.fn(() => new Promise<string>((resolve) => (release = resolve)));
        stubClipboard({ readText });
        const t = fakeHost();
        const controller = new ClipboardController(t.host);
        controller.attach();
        controller.hostUpdate();
        await loaded();
        expect(t.key({ key: 'v' }).consumed).toBe(false); // not consumed, nothing read: the browser's paste event follows
        expect(readText).not.toHaveBeenCalled();
        void t.service().paste();
        t.focus({ rowIndex: 1, columnKey: 'n' }); // the focus moves during the await
        await expect(t.service().paste()).resolves.toEqual({ status: 'ignored' }); // one read at a time
        expect(readText).toHaveBeenCalledTimes(1);
        release('9');
        await loaded();
        expect(t.raw.writeCells).toHaveBeenCalledTimes(1);
        expect(t.raw.writeCells.mock.calls[0]?.[0]).toEqual([{ target: { rowIndex: 0, columnKey: 'n' }, value: 9 }]);
        expect(t.raw.emit).toHaveBeenCalledWith('cells-paste', { startRow: 0, startColumn: 'n', rowsAffected: 1, cellsApplied: 1, cellsRejected: 0 });
        expect(t.raw.announce).toHaveBeenCalledWith('1 cell pasted');
        controller.detach();
    });

    it('leaves Ctrl+V alone with paste off, while editing, with no focused cell, and without readText', async () => {
        stubClipboard({ readText: vi.fn(() => Promise.resolve('1')) });
        const off = fakeHost({ enableClipboardPaste: false });
        new ClipboardController(off.host).attach();
        expect(off.key({ key: 'v' }).consumed).toBe(false);

        const t = fakeHost();
        const controller = new ClipboardController(t.host);
        controller.attach();
        controller.hostUpdate();
        await loaded();
        t.edit({ rowIndex: 0, columnKey: 'n' });
        expect(t.key({ key: 'v' }).consumed).toBe(false);
        t.edit(null);
        t.focus(null);
        expect(t.key({ key: 'v' }).consumed).toBe(false);
        t.focus({ rowIndex: 0, columnKey: 'n' });
        stubClipboard({});
        expect(t.key({ key: 'v' }).consumed).toBe(false);
        controller.detach();
    });

    it('Ctrl+V falls back to the clipboard read once when the browser fired no native paste for it (WebKit), and not when it did', async () => {
        const readText = vi.fn(() => Promise.resolve('9'));
        stubClipboard({ readText });
        const t = fakeHost();
        const controller = new ClipboardController(t.host);
        controller.attach();
        controller.hostUpdate();
        await loaded();
        // no native paste follows the keystroke: the read runs once
        expect(t.key({ key: 'v' }).consumed).toBe(false);
        await loaded();
        expect(readText).toHaveBeenCalledTimes(1);
        expect(t.raw.writeCells).toHaveBeenCalledTimes(1);
        // the browser fires its paste for the keystroke: no read
        expect(t.key({ key: 'v' }).consumed).toBe(false);
        (t.raw.root.ownerDocument as EventTarget).dispatchEvent(new Event('paste'));
        await loaded();
        expect(readText).toHaveBeenCalledTimes(1);
        controller.detach();
    });

    it('refuses pasteText while an editor is open (the editor owns its input)', async () => {
        const t = fakeHost();
        const controller = new ClipboardController(t.host);
        controller.attach();
        controller.hostUpdate();
        await loaded();
        t.edit({ rowIndex: 1, columnKey: 'n' });
        expect(t.service().pasteText('9', { rowIndex: 0, columnKey: 'n' })).toEqual({ status: 'ignored' });
        expect(t.raw.writeCells).not.toHaveBeenCalled();
        t.edit(null);
        expect(t.service().pasteText('9', { rowIndex: 0, columnKey: 'n' }).status).toBe('done');
        controller.detach();
    });

    it('gives up a read that never settles (an unanswered prompt) after 10 s, announced, so a later paste works', async () => {
        const t = fakeHost();
        const controller = new ClipboardController(t.host);
        controller.attach();
        controller.hostUpdate();
        await loaded();
        vi.useFakeTimers();
        try {
            stubClipboard({ readText: () => new Promise<string>(() => undefined) }); // never settles
            const stuck = t.service().paste();
            await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
            await expect(stuck).resolves.toEqual({ status: 'denied' });
            expect(t.raw.announce).toHaveBeenCalledWith('Could not read the clipboard');
            stubClipboard({ readText: () => Promise.resolve('9') });
            await expect(t.service().paste()).resolves.toMatchObject({ status: 'done', cells: 1 });
        } finally {
            vi.useRealTimers();
            controller.detach();
        }
    });

    it('catches a refused read: denied, announced, nothing written', async () => {
        stubClipboard({ readText: () => Promise.reject(new DOMException('no', 'NotAllowedError')) });
        const t = fakeHost();
        const controller = new ClipboardController(t.host);
        controller.attach();
        controller.hostUpdate();
        await loaded();
        await expect(t.service().paste()).resolves.toEqual({ status: 'denied' });
        expect(t.raw.announce).toHaveBeenCalledWith('Could not read the clipboard');
        expect(t.raw.writeCells).not.toHaveBeenCalled();
        controller.detach();
    });

    it('pastes nothing into a table that detached while the read was pending', async () => {
        let release: (text: string) => void = () => undefined;
        stubClipboard({ readText: () => new Promise<string>((resolve) => (release = resolve)) });
        const t = fakeHost();
        const controller = new ClipboardController(t.host);
        controller.attach();
        controller.hostUpdate();
        await loaded();
        const result = t.service().paste();
        controller.detach();
        release('5');
        await expect(result).resolves.toEqual({ status: 'ignored' });
        expect(t.raw.writeCells).not.toHaveBeenCalled();
    });

    it('pasteText is ignored while loading or before the part is loaded', async () => {
        const t = fakeHost({ loading: true });
        const controller = new ClipboardController(t.host);
        controller.attach();
        expect(t.service().pasteText('1')).toEqual({ status: 'ignored' }); // the part is not loaded yet
        controller.hostUpdate();
        await loaded();
        expect(t.service().pasteText('1')).toEqual({ status: 'ignored' }); // loading
        controller.detach();
    });
});

describe('neutralClipboard', () => {
    it('answers ignored while the feature is off and unavailable otherwise; the range copy is not gated by enable-copy', async () => {
        const off = neutralClipboard(() => ({ enableCopy: false, enableClipboardPaste: false }));
        await expect(off.copy('cell')).resolves.toEqual({ status: 'ignored' });
        await expect(off.copy('range')).resolves.toEqual({ status: 'unavailable' });
        await expect(off.paste()).resolves.toEqual({ status: 'ignored' });
        expect(off.pasteText('x')).toEqual({ status: 'ignored' });
        const on = neutralClipboard(() => ({ enableCopy: true, enableClipboardPaste: true }));
        await expect(on.copy('all')).resolves.toEqual({ status: 'unavailable' });
        expect(on.pasteText('x')).toEqual({ status: 'unavailable' });
    });
});
