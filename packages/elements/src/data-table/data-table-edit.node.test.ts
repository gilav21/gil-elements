import { describe, expect, it } from 'vitest';
import {
    coerceDraft,
    commitsOnBlur,
    commitsOnEnter,
    createDoubleTap,
    decideCommit,
    editKindOf,
    historyKey,
    isBuiltInKind,
    moveError,
    optionIndexOf,
    reconcileEditor,
    sameEditValue,
    tabTarget,
    textDraftFor,
    writeBackDate,
} from './data-table-edit.js';
import { validateConfig } from './data-table-config-check.js';
import { composedContains } from './data-table-host.js';
import type { CellEditError, ColumnDef } from './data-table.types.js';

describe('editKindOf (Angular html 207-290 precedence)', () => {
    it('takes a component, then a renderer, then editType, else a text input', () => {
        expect(editKindOf({ editComponent: 'x-ed', editRenderer: () => '', editType: 'number' })).toBe('component');
        expect(editKindOf({ editRenderer: () => '', editType: 'number' })).toBe('renderer');
        expect(editKindOf({ editType: 'checkbox' })).toBe('checkbox');
        expect(editKindOf({ editType: 'date' })).toBe('date');
        expect(editKindOf({ editType: 'number' })).toBe('number');
        expect(editKindOf({ editType: 'select', editOptions: [{ label: 'x', value: 0 }] })).toBe('select');
        expect(editKindOf({ editType: 'text' })).toBe('text');
        expect(editKindOf({})).toBe('text');
    });

    it('draws the text input for a select without options, missing or empty, which is what the config warning says', () => {
        expect(editKindOf({ editType: 'select' })).toBe('text');
        expect(editKindOf({ editType: 'select', editOptions: [] })).toBe('text');
        expect(editKindOf({ editType: 'select', editOptions: [{ label: 'a', value: 1 }] })).toBe('select');
    });

    it('knows which editors the table drives: Enter commits text, number, select and checkbox; leaving commits only text and number (D16)', () => {
        expect(['text', 'number', 'select', 'checkbox', 'date', 'component', 'renderer'].map((k) => commitsOnEnter(k as never))).toEqual([true, true, true, true, false, false, false]);
        expect(['text', 'number', 'select', 'checkbox', 'date'].map((k) => commitsOnBlur(k as never))).toEqual([true, true, true, false, false]);
        expect(isBuiltInKind('date')).toBe(true);
        expect(isBuiltInKind('component')).toBe(false);
        expect(isBuiltInKind('renderer')).toBe(false);
    });
});

describe('coerceDraft (fixes B4: Angular hands strings to the validator and the setter)', () => {
    it('a number editor reports a number, and an empty or unreadable field as null', () => {
        expect(coerceDraft('number', '5')).toBe(5);
        expect(coerceDraft('number', ' -2.5 ')).toBe(-2.5);
        expect(coerceDraft('number', '')).toBeNull();
        expect(coerceDraft('number', 'abc')).toBeNull();
        expect(coerceDraft('number', 7)).toBe(7);
        expect(coerceDraft('number', Number.NaN)).toBeNull();
    });

    it('a select editor reports the VALUE of the picked option, of its own type', () => {
        const options = [
            { label: 'One', value: 1 },
            { label: 'Yes', value: true },
            { label: 'Obj', value: { id: 3 } },
        ];
        expect(coerceDraft('select', '0', options)).toBe(1);
        expect(coerceDraft('select', '1', options)).toBe(true);
        expect(coerceDraft('select', '2', options)).toBe(options[2]!.value);
        expect(coerceDraft('select', '9', options)).toBe('9');
        expect(coerceDraft('select', '', options)).toBe(''); // the placeholder of a value no option holds is never option 0

    });

    it('a checkbox reports a boolean; text passes through', () => {
        expect(coerceDraft('checkbox', 1)).toBe(true);
        expect(coerceDraft('checkbox', undefined)).toBe(false);
        expect(coerceDraft('text', 'a b')).toBe('a b');
    });

    it('finds the option that holds a value, strictly first, then as a native select compares (by string)', () => {
        const options = [{ value: 1 }, { value: '1' }, { value: 2 }];
        expect(optionIndexOf(options, '1')).toBe(1);
        expect(optionIndexOf(options, 2)).toBe(2);
        expect(optionIndexOf([{ value: 2 }], '2')).toBe(0);
        expect(optionIndexOf(options, 'x')).toBe(-1);
    });
});

describe('decideCommit (Angular spec 1129-1266)', () => {
    const at = { rowIndex: 0, columnKey: 'name' };
    const error = (value: unknown, rowIndex = 0, columnKey = 'name'): CellEditError => ({ rowIndex, columnKey, value, message: 'bad' });

    it('an unchanged value cancels without an event', () => {
        expect(decideCommit('Alice', 'Alice', null, at)).toEqual({ action: 'cancel' });
        expect(decideCommit(Number.NaN, Number.NaN, null, at)).toEqual({ action: 'cancel' });
        expect(decideCommit(new Date(2020, 0, 1), new Date(2020, 0, 1), null, at)).toEqual({ action: 'cancel' });
    });

    it('a changed value writes and reports a rejection', () => {
        expect(decideCommit('Alice Updated', 'Alice', null, at)).toEqual({ action: 'write', report: true });
        expect(decideCommit(5, '5', null, at)).toEqual({ action: 'write', report: true });
    });

    it('a repeated rejection of the same value on the same cell is reported once', () => {
        expect(decideCommit('Bad Value', 'Alice', error('Bad Value'), at)).toEqual({ action: 'write', report: false });
        expect(decideCommit('Other', 'Alice', error('Bad Value'), at)).toEqual({ action: 'write', report: true });
        expect(decideCommit('Bad Value', 'Alice', error('Bad Value', 1), at)).toEqual({ action: 'write', report: true });
        expect(decideCommit('Bad Value', 'Alice', error('Bad Value', 0, 'role'), at)).toEqual({ action: 'write', report: true });
    });

    it('compares dates by instant', () => {
        expect(sameEditValue(new Date(1), new Date(1))).toBe(true);
        expect(sameEditValue(new Date(1), new Date(2))).toBe(false);
        expect(sameEditValue(0, -0)).toBe(false);
    });
});

describe('tabTarget (Angular computeTabTarget, spec 4589-4642)', () => {
    it('moves to the next column, then wraps to the first column of the next row', () => {
        expect(tabTarget(false, 0, 1, 3, 5)).toEqual({ row: 0, col: 2 });
        expect(tabTarget(false, 0, 2, 3, 5)).toEqual({ row: 1, col: 0 });
    });

    it('Shift moves back, wrapping to the last column of the previous row', () => {
        expect(tabTarget(true, 1, 1, 3, 5)).toEqual({ row: 1, col: 0 });
        expect(tabTarget(true, 1, 0, 3, 5)).toEqual({ row: 0, col: 2 });
    });

    it('is null at the edges of the grid, so the browser moves the focus out', () => {
        expect(tabTarget(false, 4, 2, 3, 5)).toBeNull();
        expect(tabTarget(true, 0, 0, 3, 5)).toBeNull();
        expect(tabTarget(false, 0, -1, 3, 5)).toBeNull();
        expect(tabTarget(false, 0, 0, 0, 5)).toBeNull();
    });
});

describe('reconcileEditor: the editor follows its row (Angular spec 3452-3606)', () => {
    type Row = { id: string | number };
    const rows = (...ids: (string | number)[]): Row[] => ids.map((id) => ({ id }));
    const getId = (row: Row): string => row.id as string;
    const at = { rowIndex: 3, columnKey: 'amount' };

    it('keeps an editor whose row is still at its index', () => {
        expect(reconcileEditor(at, 'o5', rows('o1', 'o2', 'o3', 'o5'), getId)).toEqual({ kind: 'keep' });
    });

    it('moves it with its row when a group above collapses or the rows are reordered', () => {
        expect(reconcileEditor(at, 'o5', rows('o2', 'o5'), getId)).toEqual({ kind: 'move', rowIndex: 1 });
        expect(reconcileEditor({ rowIndex: 0, columnKey: 'amount' }, 'o1', rows('o5', 'o4', 'o3', 'o2', 'o1'), getId)).toEqual({ kind: 'move', rowIndex: 4 });
    });

    it('drops it when its row left the drawn rows (another page, filtered out)', () => {
        expect(reconcileEditor(at, 'o5', rows('o1', 'o2'), getId)).toEqual({ kind: 'drop' });
    });

    it('drops it when no row is drawn at all: there is nothing to edit into (round 5)', () => {
        expect(reconcileEditor(at, 'o5', [], getId)).toEqual({ kind: 'drop' });
    });

    it('compares ids as strings: getRowId may answer numbers', () => {
        expect(reconcileEditor({ rowIndex: 0, columnKey: 'a' }, '7', rows(1, 7), (r) => r.id as unknown as string)).toEqual({ kind: 'move', rowIndex: 1 });
    });

    it('moves a validation message along with the editor, and only the edited cell’s', () => {
        const error: CellEditError = { rowIndex: 3, columnKey: 'amount', value: -5, message: 'Must not be negative' };
        expect(moveError(error, at, 1)).toEqual({ ...error, rowIndex: 1 });
        expect(moveError({ ...error, columnKey: 'other' }, at, 1)?.rowIndex).toBe(3);
        expect(moveError(null, at, 1)).toBeNull();
    });
});

describe('createDoubleTap (Angular onCellTouchEnd, spec 4274-4291; D23)', () => {
    it('a second tap on the same cell within 300 ms is a double tap; a single tap is not', () => {
        const tap = createDoubleTap();
        expect(tap.tap('0:name', 10, 10, 1000)).toBe(false);
        expect(tap.tap('0:name', 12, 11, 1200)).toBe(true);
        // The state restarts after a double tap: a third tap is a first tap again.
        expect(tap.tap('0:name', 12, 11, 1300)).toBe(false);
    });

    it('a tap on another cell, a late tap or a far one restarts the sequence', () => {
        const tap = createDoubleTap();
        tap.tap('0:name', 10, 10, 0);
        expect(tap.tap('1:name', 10, 10, 100)).toBe(false);
        expect(tap.tap('1:name', 10, 10, 450)).toBe(false); // 350 ms after the previous one
        expect(tap.tap('1:name', 30, 10, 500)).toBe(false); // 20 px away
        expect(tap.tap('1:name', 32, 12, 600)).toBe(true);
    });

    it('reset forgets the first tap', () => {
        const tap = createDoubleTap();
        tap.tap('k', 0, 0, 0);
        tap.reset();
        expect(tap.tap('k', 0, 0, 10)).toBe(false);
    });
});

describe('the editing config check (wave 5 B block of validateConfig)', () => {
    const check = (columns: ColumnDef<unknown>[]): string[] =>
        validateConfig({ columns, localPagination: true, showPagination: false, enableVirtualScroll: false, virtualActive: false, total: undefined }).filter((m) => m.includes("editType 'select'"));

    it("warns about an editable select column without options, naming it", () => {
        const setter = (row: unknown) => row;
        expect(check([{ accessorKey: 'a', header: 'A', editable: true, editType: 'select', valueSetter: setter }])).toEqual([
            "[ge-data-table] Columns [a] have editType 'select' but no editOptions. The editor falls back to a text input; give the options to pick from.",
        ]);
        expect(check([{ accessorKey: 'a', header: 'A', editable: true, editType: 'select', editOptions: [], valueSetter: setter }])).toHaveLength(1);
    });

    it('stays quiet with options, a custom editor, or a column that is not editable', () => {
        const setter = (row: unknown) => row;
        expect(check([{ accessorKey: 'a', header: 'A', editable: true, editType: 'select', editOptions: [{ label: 'x', value: 1 }], valueSetter: setter }])).toEqual([]);
        expect(check([{ accessorKey: 'a', header: 'A', editable: true, editType: 'select', editComponent: 'x-ed', valueSetter: setter }])).toEqual([]);
        expect(check([{ accessorKey: 'a', header: 'A', editType: 'select' }])).toEqual([]);
    });
});

describe('textDraftFor: a text editor on a number cell (round 4)', () => {
    it('gives a number for text that reads as a finite number, trimmed', () => {
        expect(textDraftFor('42', 7)).toBe(42);
        expect(textDraftFor(' -3.5 ', 7)).toBe(-3.5);
        expect(textDraftFor('+5', 7)).toBe(5);
    });

    it('keeps any other text a string', () => {
        expect(textDraftFor('', 7)).toBe('');
        expect(textDraftFor('  ', 7)).toBe('  ');
        expect(textDraftFor('12abc', 7)).toBe('12abc');
        expect(textDraftFor('Infinity', 7)).toBe('Infinity');
        // Plain decimal text only (round 5): no hex, no exponent, no locale separators, no bare dot forms.
        expect(textDraftFor('0x1A', 7)).toBe('0x1A');
        expect(textDraftFor('1e3', 7)).toBe('1e3');
        expect(textDraftFor('1,5', 7)).toBe('1,5');
        expect(textDraftFor('.5', 7)).toBe('.5');
    });

    it('leaves the text alone for a cell that did not hold a number', () => {
        expect(textDraftFor('42', '41')).toBe('42');
        expect(textDraftFor('42', null)).toBe('42');
    });

    it('retyping the same number is unchanged', () => {
        expect(decideCommit(textDraftFor('7', 7), 7, null, { rowIndex: 0, columnKey: 'n' })).toEqual({ action: 'cancel' });
    });
});

describe('writeBackDate: the picked day in the type the cell held', () => {
    const picked = new Date(2024, 4, 20); // local midnight, as the calendar hands it

    it('a timestamp stays a timestamp, at the time of day the cell had', () => {
        const before = new Date(2024, 0, 3, 14, 30).getTime();
        expect(writeBackDate(picked, before)).toBe(new Date(2024, 4, 20, 14, 30).getTime());
    });

    it('a Date stays a Date, at the time of day the cell had', () => {
        const out = writeBackDate(picked, new Date(2024, 0, 3, 9, 15, 7));
        expect(out).toBeInstanceOf(Date);
        expect((out as Date).getTime()).toBe(new Date(2024, 4, 20, 9, 15, 7).getTime());
    });

    it('a date-only string stays a date-only string', () => {
        expect(writeBackDate(picked, '2024-01-03')).toBe('2024-05-20');
    });

    it('an ISO date-time string keeps its time and offset as written, its date moved by the days picked', () => {
        const before = '2024-01-03T10:20:30+05:00';
        const shownDay = new Date(before);
        const target = new Date(shownDay.getFullYear(), shownDay.getMonth(), shownDay.getDate() + 2);
        const out = writeBackDate(target, before) as string;
        expect(out).toMatch(/T10:20:30\+05:00$/);
        expect(out.slice(0, 10)).toBe('2024-01-05');
        expect(writeBackDate(new Date(shownDay.getFullYear(), shownDay.getMonth(), shownDay.getDate()), '2024-01-03T23:59:00Z')).toMatch(/^2024-01-0\dT23:59:00Z$/);
    });

    it('an empty cell gives a Date, an unreadable string a date-only string, and a cleared pick null', () => {
        expect(writeBackDate(picked, null)).toEqual(picked);
        expect(writeBackDate(picked, 'soon')).toBe('2024-05-20');
        expect(writeBackDate(null, '2024-01-03')).toBeNull();
    });
});

describe('composedContains (data-table-host, shared by the edit session and the interaction controller)', () => {
    it('walks parents and from a shadow root to its host', () => {
        const cell = { parentNode: null } as unknown as Node;
        const host = { parentNode: cell } as unknown as Node;
        const shadow = { parentNode: null, host } as unknown as Node;
        const input = { parentNode: shadow } as unknown as Node;
        expect(composedContains(cell, input)).toBe(true);
        expect(composedContains(cell, cell)).toBe(true);
        expect(composedContains(input, cell)).toBe(false);
        expect(composedContains(null, input)).toBe(false);
        expect(composedContains(cell, null)).toBe(false);
    });
});

describe('historyKey (Angular spec 6974-7010)', () => {
    const key = (k: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {}) =>
        historyKey({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });

    it('Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z redo', () => {
        expect(key('z', { ctrlKey: true })).toBe('undo');
        expect(key('z', { metaKey: true })).toBe('undo');
        expect(key('y', { ctrlKey: true })).toBe('redo');
        expect(key('Z', { ctrlKey: true, shiftKey: true })).toBe('redo');
        expect(key('z', { metaKey: true, shiftKey: true })).toBe('redo');
    });

    it('a plain z, Alt, Ctrl+Shift+Y and other Ctrl keys are not history keys', () => {
        expect(key('z')).toBeNull();
        expect(key('z', { ctrlKey: true, altKey: true })).toBeNull();
        expect(key('y', { ctrlKey: true, shiftKey: true })).toBeNull();
        expect(key('End', { ctrlKey: true })).toBeNull();
    });

    it('on a non-Latin layout the physical key decides: KeyZ undoes, KeyY redoes (round 5)', () => {
        const base = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };
        expect(historyKey({ ...base, key: 'ז', code: 'KeyZ' })).toBe('undo');
        expect(historyKey({ ...base, key: 'ז', code: 'KeyZ', shiftKey: true })).toBe('redo');
        expect(historyKey({ ...base, key: 'ט', code: 'KeyY' })).toBe('redo');
        expect(historyKey({ ...base, key: 'ש', code: 'KeyA' })).toBeNull();
        // A Latin key wins over its position (an AZERTY or Dvorak layout puts z elsewhere), and so does ASCII punctuation (round 6).
        expect(historyKey({ ...base, key: 'w', code: 'KeyZ' })).toBeNull();
        expect(historyKey({ ...base, key: ';', code: 'KeyZ' })).toBeNull();
        expect(historyKey({ ...base, key: 'Dead', code: 'KeyZ' })).toBeNull();
    });
});
