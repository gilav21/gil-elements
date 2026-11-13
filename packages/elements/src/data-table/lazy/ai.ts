/**
 * The AI features (wave 7, package D; Angular cmp 1146-1170 and 5058-5100): the toolbar's natural-language filter box, the NL filter and the AI
 * column fill. A build entry (`data-table/lazy/ai`), loaded by the `ai` controller's `lazyPart` once `aiProvider` is set; the shell
 * (`data-table-ai-controller.ts`) hands every element method here. Differences from Angular (docs/data-table-wave-7-spec.md D.2, D5, D6):
 * - NL filter: the spec REPLACES both filter records (a follow-up "show everything" clears the column filters), returns to page 0 and announces
 *   the result (`applyFilters`); column filter values that do not fit the column's filter are dropped; a failure is announced, never thrown.
 * - AI fill: rows of every page are written by id through `writeCells` (validated, `cell-edit` fired, NOT undoable as in Angular); `count` is the
 *   cells written; a provider error stops the run and keeps what was written; progress, cancel, concurrency and a row projection are added.
 */
import type { TemplateResult } from 'lit';
import { interpolate } from '../../shared/interpolate.js';
import { askAi, hardenSpec, nlColumns, parseNlFilterSpec, projectRow, runFill } from '../data-table-ai.js';
import type { DataTableCoreHost } from '../data-table-host.js';
import { renderNlFilter } from '../data-table-nl-filter.js';
import type { DataTableAiFillOptions } from '../data-table.types.js';

/** Progress events are fired at most this often. */
const PROGRESS_MS = 250;

export class AiPart<T> {
    private attached = false;
    /** What the box holds. */
    private text = '';
    /** The running NL request: its (trimmed) question and its abort. */
    private filterRun: { readonly query: string; readonly abort: AbortController } | undefined;
    private fillRun: AbortController | undefined;

    constructor(private readonly host: DataTableCoreHost<T>) {}

    attach(): void {
        this.attached = true;
    }

    /** The table left the document or `aiProvider` was removed: every request is aborted, a running fill writes and reports nothing more. */
    detach(): void {
        this.attached = false;
        this.cancel();
    }

    busy(): boolean {
        return this.fillRun !== undefined;
    }

    render(): TemplateResult | null {
        const { config, resolvedLocale } = this.host;
        if (!config.enableNlFilter) return null;
        return renderNlFilter({
            locale: resolvedLocale,
            text: this.text,
            busy: this.filterRun !== undefined,
            onInput: (text) => (this.text = text),
            submit: () => void this.runBox(),
        });
    }

    /** The box's question (Enter, the submit button, `runAiFilter()`): the same question again while it runs does nothing; a changed one replaces it. */
    runBox(): Promise<void> {
        const query = this.text.trim();
        return !query || this.filterRun?.query === query ? Promise.resolve() : this.filter(query);
    }

    cancel(): void {
        this.filterRun?.abort.abort();
        this.fillRun?.abort();
    }

    async filter(query: string): Promise<void> {
        const { config, resolvedLocale: t } = this.host;
        const provider = config.aiProvider;
        if (!provider || !query.trim()) return;
        this.filterRun?.abort.abort();
        const run = { query: query.trim(), abort: new AbortController() };
        this.filterRun = run;
        this.host.requestRender();
        this.host.announce(t.nlFilterRunning);
        try {
            const columns = nlColumns(config.columns);
            const answer = await askAi(provider, { task: 'nl-filter', input: query, context: { columns } }, run.abort.signal);
            run.abort.signal.throwIfAborted(); // replaced, cancelled or detached while the answer came in
            const keys = columns.map((c) => c.key);
            const spec = hardenSpec(parseNlFilterSpec(answer, keys), config.columns);
            this.host.emit('nl-filter', { query, spec });
            if (spec.globalFilter === undefined && !spec.columnFilters) this.host.announce(t.nlFilterNoChange);
            else this.host.provider('query')?.applyFilters({ globalFilter: spec.globalFilter ?? '', columnFilters: spec.columnFilters ?? {} });
        } catch {
            // A replaced or cancelled request says nothing; a provider error or the timeout is announced.
            if (!run.abort.signal.aborted) this.host.announce(t.nlFilterFailed);
        } finally {
            if (this.filterRun === run) {
                this.filterRun = undefined;
                this.host.requestRender();
            }
        }
    }

    async fill(columnKey: string, prompt: string, options: DataTableAiFillOptions = {}): Promise<void> {
        const { config, resolvedLocale: t } = this.host;
        const provider = config.aiProvider;
        const column = config.columns.find((c) => String(c.accessorKey) === columnKey);
        const query = this.host.provider('query');
        if (!provider || !column?.valueSetter || !query) return;
        const rows = options.rows === 'selected' ? (this.host.provider('selection')?.selectedRows() ?? []) : options.rows === 'page' ? query.renderedRows() : query.sortedData();
        this.fillRun?.abort();
        const abort = new AbortController();
        this.fillRun = abort;
        const signal = options.signal ? AbortSignal.any([abort.signal, options.signal]) : abort.signal;
        this.host.requestRender(); // aria-busy
        const total = rows.length;
        let lastProgress = Date.now();
        let decile = 0;
        const result = await runFill(rows, options.concurrency ?? 1, {
            signal,
            ask: (row) =>
                askAi(provider, { task: 'table-fill', input: JSON.stringify(projectRow(row, options.inputColumns)), prompt, context: { column: column.header } }, signal),
            write: (batch) => {
                // The drawn index is reported (cell-edit, edit-error) when the row is on the page, else -1; the row itself is found by id.
                const drawn = new Map(query.renderedRows().map((row, i) => [query.rowId(row), i]));
                const requests = batch.map(({ row, value }) => {
                    const rowId = query.rowId(row);
                    return { target: { rowIndex: drawn.get(rowId) ?? -1, columnKey, rowId }, value };
                });
                return this.host.writeCells(requests, { emitEdit: true }).map((r) => r.status);
            },
            progress: (done) => {
                const now = Date.now();
                if (done === total || now - lastProgress >= PROGRESS_MS) {
                    lastProgress = now;
                    this.host.emit('ai-fill-progress', { columnKey, done, total });
                }
                const reached = Math.floor((done * 10) / total);
                if (done < total && reached > decile) {
                    decile = reached;
                    this.host.announce(interpolate(t.aiFillRunning, { done, total }));
                }
            },
        });
        abort.abort(); // a failed batch's other requests stop
        if (this.fillRun === abort) {
            this.fillRun = undefined;
            this.host.requestRender();
        }
        if (!this.attached) return; // a table that left the document reports nothing
        this.host.announce(result.failed ? t.aiFillFailed : interpolate(t.aiFillDone, { count: result.count }));
        this.host.emit('ai-fill-complete', { columnKey, ...result });
    }
}
