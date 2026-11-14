/** Wave 7, package D: the AI features on a real table with real input (the NL box, its states, the AI fill's aria-busy), axe, RTL. */
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeDataTable } from './data-table.js';
import { bodyRows, makeAiProvider, mountTable, q, SAMPLE_COLUMNS, settle, type SampleRow } from './data-table-fixtures.js';
import { emulateTouch, frames, parkMouse, press, touchTap, typeText, withRtl, withTheme } from './data-table-input-fixtures.js';
import type { AiProvider } from '../shared/ai.js';
import type { ColumnDef } from './data-table.types.js';

const NL = '[data-slot="table-nl-filter"]';
const APPLY = '[data-kind="nl-filter-apply"]';
const announcer = (table: Element): string => (q(table, '[data-slot="data-table-announcer"]').textContent ?? '').replace('​', '');
const names = (table: Element): string[] => bodyRows(table).map((r) => r.querySelector('[data-column="name"]')?.textContent?.trim() ?? '');

/** A promise the test resolves by hand. */
function deferred<V>() {
    let resolve!: (v: V) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<V>((res, rej) => ((resolve = res), (reject = rej)));
    return { promise, resolve, reject };
}

/** A table with a provider, once the lazy AI part drew its box. */
async function mountAi(aiProvider: AiProvider, props: Record<string, unknown> = {}, attrs: Record<string, string> = {}): Promise<GeDataTable<SampleRow>> {
    const table = await mountTable({ aiProvider, ...props }, attrs);
    await vi.waitFor(() => expect(table.querySelector(NL)).not.toBeNull());
    await settle(table);
    return table;
}

const input = (table: Element): HTMLElement => q(table, `${NL} > ge-input`);
/** The focused element, through ge-input's shadow root. */
const deepActive = (): Element | null => {
    let at = document.activeElement;
    while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement;
    return at;
};

afterEach(async () => {
    await parkMouse();
});

describe('the NL filter box', () => {
    it('is drawn only with a provider and a toolbar, not with enable-nl-filter="false", and adds no tab stop without a provider', async () => {
        const plain = await mountTable();
        await frames(2);
        expect(plain.querySelector(NL)).toBeNull();
        const tabbable = (table: Element) => [...table.querySelectorAll('[data-slot="data-table-toolbar"] :is(button, ge-input, input)')].length;
        const before = tabbable(plain);
        const ai = await mountAi(() => '{}');
        expect(tabbable(ai)).toBe(before + 2); // the box and its submit button
        expect(input(ai).getAttribute('aria-label')).toBe('Filter with a question');
        expect(input(ai).getAttribute('placeholder')).toBe('Ask in plain English…');
        expect(q(ai, APPLY).getAttribute('aria-label')).toBe('Apply');
        expect(q(ai, NL).getAttribute('role')).toBe('search');
        const off = await mountTable({ aiProvider: () => '{}' }, { 'enable-nl-filter': 'false' });
        await frames(3);
        expect(off.querySelector(NL)).toBeNull();
        const hidden = await mountTable({ aiProvider: () => '{}', showToolbar: false });
        await frames(3);
        expect(hidden.querySelector(NL)).toBeNull();
    });

    it('a table inside an outer <form>: submitting the NL box (Enter, button) reaches no outer listener and never submits the outer form (final review)', async () => {
        // Chromium does not deliver a nested form's submit to the outer FORM element itself, so the page-side listener sits on a wrapper inside it (where
        // a consumer's delegated submit handler would see the box's submit without the fix).
        const outer = document.createElement('form');
        const wrapper = document.createElement('div');
        const submitted = vi.fn((event: Event) => event.preventDefault());
        outer.addEventListener('submit', submitted);
        wrapper.addEventListener('submit', submitted);
        outer.append(wrapper);
        document.body.append(outer);
        try {
            const table = document.createElement('ge-data-table') as GeDataTable<SampleRow>;
            Object.assign(table, { columns: SAMPLE_COLUMNS, data: [], aiProvider: () => '{"globalFilter":"x"}' });
            wrapper.append(table);
            await vi.waitFor(() => expect(table.querySelector(NL)).not.toBeNull());
            await settle(table);
            const own = vi.fn();
            q(table, NL).addEventListener('submit', own);
            await typeText(input(table), 'q');
            await press('{Enter}');
            q(table, APPLY).click();
            await frames(2);
            expect(own).toHaveBeenCalledTimes(1); // the button submitted the box's own form (Enter is handled without a submit)
            expect(submitted).not.toHaveBeenCalled();
        } finally {
            outer.remove();
        }
    });

    it('sits after the global filter and before the advanced-filter trigger (Angular order)', async () => {
        const table = await mountAi(() => '{}', { enableAdvancedFilter: true });
        const start = [...q(table, '[data-slot="data-table-toolbar-start"]').children].map((el) => el.getAttribute('data-slot') ?? el.tagName.toLowerCase());
        expect(start.indexOf('data-table-filter')).toBe(0);
        expect(start.indexOf('table-nl-filter')).toBe(1);
        expect(start.indexOf('ge-popover')).toBe(2); // the advanced-filter trigger's popover
    });

    it('typing a question and pressing Enter filters the rows, returns to page 0 and announces the count', async () => {
        const ai = makeAiProvider(JSON.stringify({ globalFilter: 'Alice' }));
        const table = await mountAi(ai.provider, { paginationState: { pageIndex: 1, pageSize: 2 } });
        await typeText(input(table), 'who is alice');
        await press('{Enter}');
        await vi.waitFor(() => expect(names(table)).toEqual(['Alice']));
        expect(table.paginationState.pageIndex).toBe(0);
        expect(ai.requests[0]).toMatchObject({ task: 'nl-filter', input: 'who is alice' });
        await vi.waitFor(() => expect(announcer(table)).toBe('1 result found for "Alice"'));
    });

    it('the submit button applies the question by click and by touch tap', async () => {
        const ai = makeAiProvider('{"globalFilter":"Bob"}', '{"globalFilter":"Dave"}');
        const table = await mountAi(ai.provider);
        await typeText(input(table), 'bob');
        q(table, APPLY).click();
        await vi.waitFor(() => expect(names(table)).toEqual(['Bob']));
        await typeText(input(table), ' or dave');
        await emulateTouch(true);
        await touchTap(q(table, APPLY));
        await vi.waitFor(() => expect(names(table)).toEqual(['Dave']));
        expect(ai.requests.map((r) => r.input)).toEqual(['bob', 'bob or dave']);
    });

    it('while a question runs the form is aria-busy, the box stays enabled and focused, and IME composition Enter is ignored', async () => {
        const gate = deferred<string>();
        const ai = makeAiProvider(() => gate.promise);
        const table = await mountAi(ai.provider);
        await typeText(input(table), 'older than 30');
        input(table).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, composed: true }));
        await frames(1);
        expect(ai.requests).toHaveLength(0);
        await press('{Enter}');
        await settle(table);
        expect(q(table, NL).getAttribute('aria-busy')).toBe('true');
        expect(input(table).hasAttribute('disabled')).toBe(false);
        expect(deepActive()?.getAttribute('data-slot')).toBe('input');
        await press('{Enter}'); // the same question again while it runs: nothing
        expect(ai.requests).toHaveLength(1);
        gate.resolve('{"columnFilters":{}}');
        await vi.waitFor(() => expect(q(table, NL).getAttribute('aria-busy')).toBe('false'));
    });

    it('a failing provider is announced, the box is usable again', async () => {
        const table = await mountAi(() => Promise.reject(new Error('down')));
        await typeText(input(table), 'anything');
        await press('{Enter}');
        await vi.waitFor(() => expect(announcer(table)).toBe('Could not apply the filter'));
        expect(q(table, NL).getAttribute('aria-busy')).toBe('false');
        expect(names(table)).toHaveLength(4);
    });

    it('in RTL the submit button sits on the inline end (left) of the box and its chevron is mirrored', async () => {
        const table = await mountAi(() => '{}');
        await withRtl(table);
        expect(q(table, APPLY).getBoundingClientRect().right).toBeLessThanOrEqual(input(table).shadowRoot!.querySelector('input')!.getBoundingClientRect().left + 1);
        expect(getComputedStyle(q(table, `${APPLY} svg`)).scale).toBe('-1 1');
    });

    it.each(['light', 'dark'])('passes axe with the box focused and busy (%s)', async (mode) => {
        withTheme(mode);
        const gate = deferred<string>();
        const table = await mountAi(() => gate.promise);
        await typeText(input(table), 'q');
        await press('{Enter}');
        await settle(table);
        const result = await axe.run(table);
        expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
        gate.resolve('{}');
    });
});

describe('AI fill on a real table', () => {
    it('draws aria-busy on the table while a fill runs and fills the filtered rows of every page', async () => {
        const columns: ColumnDef<SampleRow>[] = [...SAMPLE_COLUMNS, { accessorKey: 'note', header: 'Note', valueSetter: (r, v) => ({ ...r, note: String(v) }) }];
        const gate = deferred<void>();
        const provider: AiProvider = async (request) => {
            await gate.promise;
            return `hi ${(JSON.parse(request.input) as SampleRow).name}`;
        };
        const table = await mountTable({ aiProvider: provider, columns, paginationState: { pageIndex: 0, pageSize: 2 } }, { 'enable-nl-filter': 'false' });
        const done: unknown[] = [];
        table.addEventListener('ai-fill-complete', (e) => done.push((e as CustomEvent).detail));
        const run = table.aiFillColumn('note', 'greet');
        await settle(table);
        expect(table.getAttribute('aria-busy')).toBe('true');
        gate.resolve();
        await run;
        await settle(table);
        expect(table.hasAttribute('aria-busy')).toBe(false);
        expect(table.data.map((r) => r['note'])).toEqual(['hi Carol', 'hi Alice', 'hi Bob', 'hi Dave']);
        expect(done).toEqual([{ columnKey: 'note', count: 4, rejected: 0, skipped: 0 }]);
        expect(announcer(table)).toBe('4 cells filled');
    });

    it('a table with a provider set after the first render loads the AI part and its methods work at once', async () => {
        const table = await mountTable();
        table.aiProvider = () => '{"globalFilter":"Carol"}';
        await table.applyNaturalLanguageFilter('carol');
        expect(table.globalFilter).toBe('Carol');
    });
});
