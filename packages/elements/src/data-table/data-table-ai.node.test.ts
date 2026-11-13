/**
 * Wave 7, package D: the AI features without a DOM. The pure helpers (`data-table-ai.ts`) and the AI part (`lazy/ai.ts`) on a fake host with the REAL
 * query controller and cell writer, so the filter models, the page reset, the announcements and the writes are the table's own. Angular sources:
 * data-table-ai.spec.ts (its cases are marked "Angular").
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiProvider, AiRequest } from '../shared/ai.js';
import { AiPart } from './lazy/ai.js';
import { askAi, fitsFilter, hardenSpec, nlColumns, parseNlFilterSpec, projectRow, runFill } from './data-table-ai.js';
import { makeAiProvider } from './data-table-addon-fixtures.js';
import { createCellWriter } from './data-table-cell-write.js';
import type { DataTableCoreHost } from './data-table-host.js';
import { DATA_TABLE_LOCALES } from './data-table.locales.js';
import { ModelStore } from './data-table-model.js';
import type { AiService, DataTableConfig } from './data-table-providers.js';
import { QueryController } from './data-table-query-controller.js';
import type { ColumnDef } from './data-table.types.js';

interface Row {
    id: string;
    name: string;
    status: string;
    note: string;
}

const t = DATA_TABLE_LOCALES.en;
const noteSetter = (r: Row, v: unknown): Row => ({ ...r, note: String(v) });
const COLUMNS: ColumnDef<Row>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'status', header: 'Status', enableFiltering: true },
    { accessorKey: 'note', header: 'Note', valueSetter: noteSetter },
];
const DATA: Row[] = [
    { id: '1', name: 'Alice', status: 'active', note: '' },
    { id: '2', name: 'Bob', status: 'paused', note: '' },
    { id: '3', name: 'Cyd', status: 'active', note: '' },
];

function setup({ provider, columns = COLUMNS, data = DATA, pageSize = 10, extra = {} }: { provider?: AiProvider; columns?: ColumnDef<Row>[]; data?: Row[]; pageSize?: number; extra?: Record<string, unknown> } = {}) {
    const events: [string, unknown][] = [];
    const announced: string[] = [];
    const model = new ModelStore<Row>((name, detail) => events.push([name, detail]), { data, paginationState: { pageIndex: 0, pageSize } });
    const providers = new Map<string, unknown>();
    const config = {
        columns,
        filterDebounce: 0,
        getRowId: (r: Row) => r.id,
        localSorting: true,
        localPagination: true,
        localFiltering: true,
        showPagination: true,
        enableNlFilter: true,
        aiProvider: provider,
        ...extra,
    } as unknown as DataTableConfig<Row>;
    providers.set('columns', { enhancedColumns: () => columns });
    const writer = createCellWriter<Row>({
        getData: () => model.get('data'),
        setData: (next) => model.set('data', next),
        batch: (fn) => model.batch(fn),
        getRowId: (r) => r.id,
        columnByKey: (key) => columns.find((c) => String(c.accessorKey) === key),
        rowAt: (i) => (providers.get('query') as { renderedRowAt(i: number): Row | undefined }).renderedRowAt(i),
        cellValue: (row, column) => row[column.accessorKey as keyof Row],
        historyEnabled: () => false,
        rejectionMessage: () => 'Invalid',
        emit: (name, detail) => events.push([name, detail]),
    });
    let renders = 0;
    const host = {
        config,
        model,
        provide: (key: string, p: unknown) => (providers.set(key, p), () => providers.delete(key)),
        provider: (key: string) => providers.get(key),
        topics: { emit: () => undefined },
        emit: (name: string, detail: unknown) => events.push([name, detail]),
        announce: (message: string) => announced.push(message),
        requestRender: () => void renders++,
        disposables: { timeout: (fn: () => void) => (fn(), () => undefined) }, // announcements run at once
        resolvedLocale: t,
        writeCells: writer.writeCells,
    } as unknown as DataTableCoreHost<Row>;
    new QueryController(host).attach();
    const controller = new AiPart(host);
    controller.attach();
    // The element's methods as the shell hands them to the part once it is loaded (the shell itself: data-table-ai-controller.node.test.ts).
    const ai: Required<AiService> = {
        runAiFilter: () => controller.runBox(),
        applyNaturalLanguageFilter: (query) => controller.filter(query),
        aiFillColumn: (key, prompt, options) => controller.fill(key, prompt, options),
        cancelAi: () => controller.cancel(),
        busy: () => controller.busy(),
    };
    const named = (name: string) => events.filter(([n]) => n === name).map(([, d]) => d);
    return { model, ai, controller, events, named, announced, config, providers, renders: () => renders };
}

/** A promise the test resolves by hand. */
function deferred<V>() {
    let resolve!: (v: V) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<V>((res, rej) => ((resolve = res), (reject = rej)));
    return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => vi.useRealTimers());

// Moved unchanged from data-table.utils.node.test.ts with the function (wave 7: it lives in data-table-ai.ts, loaded only with AI).
describe('parseNlFilterSpec', () => {
    const KEYS = ['status', 'name'];
    it('keeps a string globalFilter and known columnFilters', () => {
        const raw = JSON.stringify({ globalFilter: 'x', columnFilters: { status: ['failed'], bogus: 1 } });
        expect(parseNlFilterSpec(raw, KEYS)).toEqual({ globalFilter: 'x', columnFilters: { status: ['failed'] } });
    });
    it('returns an empty spec for malformed or non-object input', () => {
        for (const raw of ['not json', '"a string"', 'null', '[]', '']) expect(parseNlFilterSpec(raw, KEYS)).toEqual({});
    });
    it('drops a non-string globalFilter and an all-unknown columnFilters', () => {
        expect(parseNlFilterSpec('{"globalFilter":3,"columnFilters":{"zzz":1}}', KEYS)).toEqual({});
    });
    it('cannot be used to rewrite the prototype', () => {
        const spec = parseNlFilterSpec('{"columnFilters":{"__proto__":{"polluted":1}}}', ['__proto__']);
        expect(Object.hasOwn(spec.columnFilters ?? {}, '__proto__')).toBe(true);
        expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });
});

describe('nlColumns, fitsFilter, hardenSpec, projectRow', () => {
    it('describes the filterable data columns as { key, header }, never a table-owned one (the pipeline filters only those, PR #80 review)', () => {
        expect(nlColumns([...COLUMNS, { accessorKey: '_actions', header: '', enableFiltering: true }])).toEqual([{ key: 'status', header: 'Status' }]);
    });

    it('checks a value against the column filter kind (D5)', () => {
        const text = { accessorKey: 'a', header: 'A' } as ColumnDef<Row>;
        const multi = { ...text, filterComponent: 'ge-data-table-multiselect-filter' };
        const date = { ...text, filterComponent: 'GE-DATA-TABLE-DATE-FILTER' };
        const range = { ...text, filterComponent: 'ge-data-table-date-range-filter' };
        const custom = { ...text, filterFn: () => true };
        expect([fitsFilter(text, 'x'), fitsFilter(text, 5), fitsFilter(text, Number.NaN), fitsFilter(text, ['x']), fitsFilter(text, { a: 1 })]).toEqual([true, true, false, false, false]);
        expect([fitsFilter(multi, ['a', 2, null]), fitsFilter(multi, 'a'), fitsFilter(multi, [{}])]).toEqual([true, false, false]);
        expect([fitsFilter(date, '2024-03-01'), fitsFilter(date, 5), fitsFilter(date, 'soon'), fitsFilter(date, {})]).toEqual([true, true, false, false]);
        expect([
            fitsFilter(range, { start: '2024-01-01', end: null }),
            fitsFilter(range, { end: '2024-01-01' }),
            fitsFilter(range, { from: '2024-01-01' }),
            fitsFilter(range, { start: 'never' }),
            fitsFilter(range, 5),
        ]).toEqual([true, true, false, false, false]);
        expect(fitsFilter(custom, { anything: true })).toBe(true);
    });

    it('drops the column filters that do not fit and the record when none is left', () => {
        expect(hardenSpec({ globalFilter: 'a', columnFilters: { status: 'active', name: { bad: 1 } } }, COLUMNS)).toEqual({ globalFilter: 'a', columnFilters: { status: 'active' } });
        expect(hardenSpec({ columnFilters: { name: ['x'] } }, COLUMNS)).toEqual({});
        expect(hardenSpec({ globalFilter: 'x' }, COLUMNS)).toEqual({ globalFilter: 'x' });
        expect(hardenSpec({ columnFilters: { name: 'Alice', status: 'active' } }, COLUMNS)).toEqual({ columnFilters: { status: 'active' } }); // `name` is not filterable
    });

    it('projects a row to the given own keys only', () => {
        const row = Object.assign(Object.create({ inherited: 1 }) as object, { id: '1', secret: 's', name: 'A' });
        expect(projectRow(row, ['id', 'name', 'inherited', 'missing'])).toEqual({ id: '1', name: 'A' });
        expect(projectRow(DATA[0])).toBe(DATA[0]);
    });
});

describe('askAi', () => {
    it('answers the LAST emission of an async iterable, and passes the request with a signal', async () => {
        const seen: AiRequest[] = [];
        const provider: AiProvider = (request) => {
            seen.push(request);
            return (async function* () {
                yield '{"glo';
                yield '{"globalFilter":"x"}';
            })();
        };
        expect(await askAi(provider, { task: 'nl-filter', input: 'q' }, new AbortController().signal)).toBe('{"globalFilter":"x"}');
        expect(seen[0]?.signal).toBeInstanceOf(AbortSignal);
    });

    it('rejects when the signal aborts or the time is up, even if the provider never answers', async () => {
        const never: AiProvider = () => new Promise<string>(() => undefined);
        const abort = new AbortController();
        const pending = askAi(never, { task: 'nl-filter', input: 'q' }, abort.signal);
        abort.abort(new Error('stop'));
        await expect(pending).rejects.toThrow('stop');
        await expect(askAi(never, { task: 'nl-filter', input: 'q' }, new AbortController().signal, 5)).rejects.toMatchObject({ name: 'TimeoutError' });
    });

    it('stops a streaming provider on abort: its iterator is returned, it is not read to the end (PR #80 review)', async () => {
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        let stopped = false;
        const stream: AiProvider = () =>
            (async function* () {
                try {
                    yield 'a';
                    await sleep(20);
                    yield 'b';
                    await sleep(1000);
                    yield 'c';
                } finally {
                    stopped = true;
                }
            })();
        const abort = new AbortController();
        const pending = askAi(stream, { task: 'nl-filter', input: 'q' }, abort.signal);
        await sleep(5);
        abort.abort(new Error('stop'));
        await expect(pending).rejects.toThrow('stop');
        await sleep(100);
        expect(stopped).toBe(true);
    });
});

describe('runFill', () => {
    const ports = (log: string[], answers: Record<string, () => Promise<string>>, signal = new AbortController().signal) => ({
        signal,
        ask: (row: string) => (log.push(`ask ${row}`), answers[row]?.() ?? Promise.resolve(`v${row}`)),
        write: (batch: readonly { row: string; value: string }[]) => (log.push(`write ${batch.map((b) => b.value).join(',')}`), batch.map(() => 'written' as const)),
        progress: (done: number, total: number) => void log.push(`${done}/${total}`),
    });

    it('asks one row at a time by default, and `concurrency` rows per batch with the write order kept', async () => {
        const one: string[] = [];
        expect(await runFill(['a', 'b'], 1, ports(one, {}))).toEqual({ count: 2, rejected: 0, skipped: 0 });
        expect(one).toEqual(['ask a', 'write va', '1/2', 'ask b', 'write vb', '2/2']);
        const three: string[] = [];
        const slowA = deferred<string>();
        const run = runFill(['a', 'b', 'c', 'd'], 3, ports(three, { a: () => slowA.promise }));
        await flush();
        expect(three).toEqual(['ask a', 'ask b', 'ask c']); // a batch of three in flight, nothing written before all answered
        slowA.resolve('va');
        await run;
        expect(three).toEqual(['ask a', 'ask b', 'ask c', 'write va,vb,vc', '3/4', 'ask d', 'write vd', '4/4']);
    });

    it('counts rejected and skipped cells, and stops at a provider error keeping what was written', async () => {
        const log: string[] = [];
        const boom = new Error('boom');
        const result = await runFill(['a', 'b', 'c'], 1, {
            ...ports(log, { b: () => Promise.reject(boom) }),
            write: (batch) => batch.map(() => 'rejected' as const),
        });
        expect(result).toEqual({ count: 0, rejected: 1, skipped: 0, failed: true, error: boom });
        expect(log).toEqual(['ask a', '1/3', 'ask b']);
    });

    it('writes nothing after an abort', async () => {
        const log: string[] = [];
        const abort = new AbortController();
        const gate = deferred<string>();
        const run = runFill(['a', 'b'], 1, ports(log, { a: () => gate.promise }, abort.signal));
        abort.abort();
        gate.resolve('late');
        expect((await run).failed).toBe(true);
        expect(log).toEqual(['ask a']);
    });
});

describe('the AI part: NL filter', () => {
    it('compiles a question into both filter models and emits nl-filter (Angular)', async () => {
        const ai = makeAiProvider(JSON.stringify({ globalFilter: 'ali', columnFilters: { status: 'active' } }));
        const { ai: service, model, named } = setup({ provider: ai.provider });
        await service.applyNaturalLanguageFilter('show active alice');
        expect(model.get('globalFilter')).toBe('ali');
        expect(model.get('columnFilters')).toEqual({ status: 'active' });
        expect(named('nl-filter')).toEqual([{ query: 'show active alice', spec: { globalFilter: 'ali', columnFilters: { status: 'active' } } }]);
        expect(ai.requests[0]).toMatchObject({ task: 'nl-filter', input: 'show active alice', context: { columns: [{ key: 'status', header: 'Status' }] } }); // the filterable columns
        expect(ai.requests[0]?.signal).toBeInstanceOf(AbortSignal);
    });

    it('does nothing without a provider or for a blank question (Angular)', async () => {
        const { ai, model, events } = setup();
        await ai.applyNaturalLanguageFilter('anything');
        expect(model.get('globalFilter')).toBe('');
        const scripted = makeAiProvider('{}');
        const withProvider = setup({ provider: scripted.provider });
        await withProvider.ai.applyNaturalLanguageFilter('   ');
        expect(scripted.requests).toEqual([]);
        expect(events).toEqual([]);
    });

    it('emits nl-filter for an empty spec, changes nothing and says so (Angular, plus the announcement)', async () => {
        for (const answer of ['{}', '', 'not json', '{"columnFilters":{"bogus":1,"__proto__":{"x":1}}}', '{"columnFilters":{"name":{"from":1}}}']) {
            const { ai, model, named, announced } = setup({ provider: makeAiProvider(answer).provider });
            await ai.applyNaturalLanguageFilter('nothing matches');
            expect(model.get('globalFilter')).toBe('');
            expect(model.get('columnFilters')).toEqual({});
            expect(named('nl-filter')).toEqual([{ query: 'nothing matches', spec: {} }]);
            expect(announced).toEqual([t.nlFilterRunning, t.nlFilterNoChange]);
        }
    });

    it('replaces both records, returns to page 0 and announces the count (D5, Angular B7)', async () => {
        const { ai, model, announced } = setup({ provider: makeAiProvider('{"globalFilter":""}').provider, pageSize: 1 });
        model.set('globalFilter', 'a');
        model.set('columnFilters', { status: 'active' });
        model.set('paginationState', { pageIndex: 1, pageSize: 1 });
        await ai.applyNaturalLanguageFilter('show everything');
        expect(model.get('globalFilter')).toBe('');
        expect(model.get('columnFilters')).toEqual({});
        expect(model.get('paginationState').pageIndex).toBe(0);
        expect(announced.at(-1)).toBe(t.filtersClearedAnnouncement);
    });

    it('a failure is announced, never thrown, and the running state is reset (Angular B8)', async () => {
        const { ai, announced, controller } = setup({ provider: () => Promise.reject(new Error('boom')) });
        await expect(ai.applyNaturalLanguageFilter('show anything')).resolves.toBeUndefined();
        expect(announced).toEqual([t.nlFilterRunning, t.nlFilterFailed]);
        expect((controller as unknown as { filterRun: unknown }).filterRun).toBeUndefined();
    });

    it('a new question aborts the running one, whose answer is then ignored', async () => {
        const first = deferred<string>();
        const signals: AbortSignal[] = [];
        const provider: AiProvider = (request) => {
            signals.push(request.signal as AbortSignal);
            return signals.length === 1 ? first.promise : '{"globalFilter":"second"}';
        };
        const { ai, model, named, announced } = setup({ provider });
        const one = ai.applyNaturalLanguageFilter('first');
        await ai.applyNaturalLanguageFilter('second');
        first.resolve('{"globalFilter":"first"}');
        await one;
        expect(signals[0]?.aborted).toBe(true);
        expect(model.get('globalFilter')).toBe('second');
        expect(named('nl-filter')).toHaveLength(1);
        expect(announced).not.toContain(t.nlFilterFailed);
    });

    it('runAiFilter runs the box text (trimmed), ignores a blank box and the same question while it runs (Angular)', async () => {
        const gate = deferred<string>();
        const scripted = makeAiProvider(() => gate.promise);
        const { ai, controller, model } = setup({ provider: scripted.provider });
        const box = controller as unknown as { text: string };
        box.text = '   ';
        await ai.runAiFilter();
        expect(scripted.requests).toHaveLength(0);
        box.text = '  show bob ';
        const run = ai.runAiFilter();
        void ai.runAiFilter(); // same question while it runs: nothing
        expect(scripted.requests.map((r) => r.input)).toEqual(['show bob']);
        gate.resolve('{"globalFilter":"bob"}');
        await run;
        expect(model.get('globalFilter')).toBe('bob');
    });

    it('cancelAi and detach abort the running question silently', async () => {
        const never = makeAiProvider(() => new Promise<string>(() => undefined));
        const { ai, controller, announced } = setup({ provider: never.provider });
        const one = ai.applyNaturalLanguageFilter('q');
        ai.cancelAi();
        await one;
        expect(never.requests[0]?.signal?.aborted).toBe(true);
        const two = ai.applyNaturalLanguageFilter('q2');
        controller.detach();
        await two;
        expect(never.requests[1]?.signal?.aborted).toBe(true);
        expect(announced).toEqual([t.nlFilterRunning, t.nlFilterRunning]);
    });

    it('server filtering: only the models change (the query service fires `query`)', async () => {
        const { ai, model } = setup({ provider: makeAiProvider('{"globalFilter":"x"}').provider, extra: { localFiltering: false } });
        await ai.applyNaturalLanguageFilter('q');
        expect(model.get('globalFilter')).toBe('x');
    });

    it('draws the box only with enableNlFilter (the shell loads the part only with a provider)', () => {
        expect(setup({ provider: () => '{}', extra: { enableNlFilter: false } }).controller.render()).toBeNull();
        expect(setup({ provider: () => '{}' }).controller.render()).not.toBeNull();
    });
});

describe('the AI part: AI fill', () => {
    it('fills the column through valueSetter for each FILTERED row of every page (Angular)', async () => {
        const scripted = makeAiProvider((req) => `note for ${(JSON.parse(req.input) as Row).name}`);
        const { ai, model, named } = setup({ provider: scripted.provider, pageSize: 1 });
        model.set('globalFilter', 'alice');
        await ai.aiFillColumn('note', 'write a note');
        expect(model.get('data').map((r) => r.note)).toEqual(['note for Alice', '', '']);
        expect(named('ai-fill-complete')).toEqual([{ columnKey: 'note', count: 1, rejected: 0, skipped: 0 }]);
        expect(scripted.requests[0]).toMatchObject({ task: 'table-fill', prompt: 'write a note', context: { column: 'Note' } });
    });

    it('fills only the filtered rows, written by id (rowIndex -1: no drawn address), without re-reading the drawn rows per batch (PR #80 review)', async () => {
        const scripted = makeAiProvider((req) => `n${(JSON.parse(req.input) as Row).id}`);
        const { ai, model, named, providers } = setup({ provider: scripted.provider, pageSize: 1 });
        model.set('columnFilters', { status: 'active' });
        const rendered = vi.spyOn(providers.get('query') as { renderedRows(): unknown }, 'renderedRows');
        await ai.aiFillColumn('note', 'p');
        expect(model.get('data').map((r) => r.note)).toEqual(['n1', '', 'n3']);
        expect(named('cell-edit').map((e) => (e as { rowIndex: number }).rowIndex)).toEqual([-1, -1]);
        expect(named('ai-fill-complete')).toEqual([{ columnKey: 'note', count: 2, rejected: 0, skipped: 0 }]);
        expect(rendered).not.toHaveBeenCalled();
    });

    it('leaves out the rows writeCells cannot find by id (tree children) BEFORE asking, and counts them skipped (PR #80 review)', async () => {
        const scripted = makeAiProvider('v');
        const { ai, model, named, providers } = setup({ provider: scripted.provider });
        const child: Row = { id: '1.1', name: 'Kid', status: 'active', note: '' };
        providers.set('selection', { selectedRows: () => [DATA[0], child] });
        await ai.aiFillColumn('note', 'p', { rows: 'selected' });
        expect(scripted.requests.map((r) => (JSON.parse(r.input) as Row).id)).toEqual(['1']);
        expect(model.get('data').map((r) => r.note)).toEqual(['v', '', '']);
        expect(named('ai-fill-complete')).toEqual([{ columnKey: 'note', count: 1, rejected: 0, skipped: 1 }]);
    });

    it('does nothing for a column without a valueSetter or without a provider (Angular)', async () => {
        const scripted = makeAiProvider('x');
        const { ai, model, events } = setup({ provider: scripted.provider });
        await ai.aiFillColumn('name', 'p');
        await setup().ai.aiFillColumn('note', 'p');
        expect(model.get('data').map((r) => r.name)).toEqual(['Alice', 'Bob', 'Cyd']);
        expect(scripted.requests).toEqual([]);
        expect(events).toEqual([]);
    });

    it('skips the rows the editValidator rejects and counts them (Angular, count = cells written)', async () => {
        const columns = COLUMNS.map((c) => (c.accessorKey === 'note' ? { ...c, editValidator: (v: unknown) => (v === 'ok' ? true : 'rejected') } : c));
        const scripted = makeAiProvider((req) => ((JSON.parse(req.input) as Row).name === 'Alice' ? 'ok' : 'bad'));
        const { ai, model, named } = setup({ provider: scripted.provider, columns });
        await ai.aiFillColumn('note', 'p');
        expect(model.get('data').map((r) => r.note)).toEqual(['ok', '', '']);
        expect(named('ai-fill-complete')).toEqual([{ columnKey: 'note', count: 1, rejected: 2, skipped: 0 }]);
        expect(named('edit-error')).toHaveLength(2);
    });

    it('a row that vanished from data mid-fill is skipped', async () => {
        const gate = deferred<string>();
        let calls = 0;
        const { ai, model, named } = setup({ provider: () => (++calls === 2 ? gate.promise : 'v') });
        const run = ai.aiFillColumn('note', 'p');
        await flush();
        model.set(
            'data',
            model.get('data').filter((r) => r.id !== '2'),
        );
        gate.resolve('v');
        await run;
        expect(named('ai-fill-complete')).toEqual([{ columnKey: 'note', count: 2, rejected: 0, skipped: 1 }]);
    });

    it('a provider error stops the run, keeps what was written and reports failed (Angular B6)', async () => {
        const boom = new Error('boom');
        let calls = 0;
        const { ai, model, named, announced } = setup({ provider: () => (++calls === 2 ? Promise.reject(boom) : 'v') });
        await ai.aiFillColumn('note', 'p');
        expect(model.get('data').map((r) => r.note)).toEqual(['v', '', '']);
        expect(named('ai-fill-complete')).toEqual([{ columnKey: 'note', count: 1, rejected: 0, skipped: 0, failed: true, error: boom }]);
        expect(announced.at(-1)).toBe(t.aiFillFailed);
    });

    it('cancelAi (and the caller signal) stop it, keeping the cells already written, reported as cancelled with no announcement; busy() is true while it runs (PR #80 review)', async () => {
        const gate = deferred<string>();
        let calls = 0;
        const { ai, model, named, announced } = setup({ provider: () => (++calls === 2 ? gate.promise : 'v') });
        const run = ai.aiFillColumn('note', 'p');
        expect(ai.busy()).toBe(true);
        await flush();
        ai.cancelAi();
        await run;
        expect(ai.busy()).toBe(false);
        expect(model.get('data').map((r) => r.note)).toEqual(['v', '', '']);
        expect(named('ai-fill-complete')).toEqual([{ columnKey: 'note', count: 1, rejected: 0, skipped: 0, cancelled: true }]);
        expect(announced).toEqual(['Filling 1 of 3']); // the progress before the cancel; no done / failed announcement
        const caller = new AbortController();
        caller.abort();
        const other = setup({ provider: () => 'v' });
        await other.ai.aiFillColumn('note', 'p', { signal: caller.signal });
        expect(other.model.get('data').map((r) => r.note)).toEqual(['', '', '']);
        expect(other.named('ai-fill-complete')).toEqual([{ columnKey: 'note', count: 0, rejected: 0, skipped: 0, cancelled: true }]);
    });

    it('a fill replaced by a new one is reported cancelled, the new one completes (PR #80 review)', async () => {
        const gate = deferred<string>();
        let calls = 0;
        const { ai, named, announced } = setup({ provider: () => (++calls === 1 ? gate.promise : 'v') });
        const first = ai.aiFillColumn('note', 'p');
        await ai.aiFillColumn('note', 'p2');
        await first;
        expect(named('ai-fill-complete')).toEqual([
            { columnKey: 'note', count: 0, rejected: 0, skipped: 0, cancelled: true }, // the replaced one stops at once
            { columnKey: 'note', count: 3, rejected: 0, skipped: 0 },
        ]);
        expect(announced.filter((a) => !a.startsWith('Filling'))).toEqual(['3 cells filled']);
    });

    it('detach mid-fill writes nothing more and reports nothing', async () => {
        const gate = deferred<string>();
        const { ai, controller, model, named } = setup({ provider: () => gate.promise });
        const run = ai.aiFillColumn('note', 'p');
        controller.detach();
        gate.resolve('late');
        await run;
        expect(model.get('data').map((r) => r.note)).toEqual(['', '', '']);
        expect(named('ai-fill-complete')).toEqual([]);
    });

    it('rows: selected and page, inputColumns projection, concurrency', async () => {
        const scripted = makeAiProvider((req) => req.input);
        const { ai, model, providers } = setup({ provider: scripted.provider, pageSize: 2 });
        providers.set('selection', { selectedRows: () => [DATA[2]] });
        await ai.aiFillColumn('note', 'p', { rows: 'selected', inputColumns: ['name'] });
        expect(model.get('data').map((r) => r.note)).toEqual(['', '', '{"name":"Cyd"}']);
        await ai.aiFillColumn('note', 'p', { rows: 'page', inputColumns: ['id'], concurrency: 3 });
        expect(model.get('data').map((r) => r.note)).toEqual(['{"id":"1"}', '{"id":"2"}', '{"name":"Cyd"}']);
    });

    it('progress events at most every 250 ms plus the last, announcements every 10 % and at the end', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const data = Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: `n${i}`, status: 's', note: '' }));
        const { ai, named, announced } = setup({ provider: () => (vi.advanceTimersByTime(100), 'v'), data, pageSize: 50 });
        await ai.aiFillColumn('note', 'p');
        // 100 ms per row: a progress event every third row (300 ms >= 250), and the last one
        expect(named('ai-fill-progress').map((p) => (p as { done: number }).done)).toEqual([3, 6, 9, 12, 15, 18, 20]);
        expect(announced.filter((a) => a.startsWith('Filling'))).toHaveLength(9); // 10 %, 20 % ... 90 %
        expect(announced.at(-1)).toBe('20 cells filled');
    });
});
