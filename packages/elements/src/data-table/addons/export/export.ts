/**
 * The export addon (Angular `uiDtExport`): CSV and XLSX of the table's rows, downloaded or returned. No UI: `table.addon<ExportApi>('export')`
 * reaches it. It imports no core value (only types), so its entry carries the CSV and xlsx writers and nothing of the table.
 */
import { resolveAddonLocale } from '../../../shared/addon-locale.js';
import { CSV_BOM, toCsv } from '../../../shared/csv.js';
import { generateXlsx, type XlsxCell } from '../../../shared/xlsx.js';
import type { DataTableAddon, DataTableAddonHost } from '../../data-table-addon-kit.js';
import type { QueryService } from '../../data-table-providers.js';
import type { ColumnDef, DataTableExportQuery } from '../../data-table.types.js';
import { EXPORT_LOCALES, type ExportLocale } from './export-locale.js';

/**
 * Server-side rows: given the current query (filters and sort, no paging), returns every matching row (Angular `ExportDataProvider`). `signal` is
 * the request's, so a fetch can stop with it; an abort rejects the export at once whether or not the provider honours it.
 */
export type ExportDataProvider<T> = (query: DataTableExportQuery, signal?: AbortSignal) => Promise<readonly T[]> | readonly T[];

export type ExportFormat = 'csv' | 'xlsx';

/** One export call. */
export interface ExportRequest<T = unknown> {
    /**
     * Which rows, when neither `rows` nor a provider gives them: `'filtered'` (default, Angular) the filtered and sorted rows of every page;
     * `'all'` the unfiltered `data`; `'selected'` the filtered and sorted rows that are selected (a selected row a filter hides is not exported);
     * `'page'` the data rows of the page as drawn. Tree and grouped tables export flat rows (no indentation, no group rows); in a tree table
     * `'filtered'` and `'selected'` walk the whole filtered tree, children included, whatever is collapsed or paged, and `'all'` the whole
     * unfiltered tree in data order.
     */
    scope?: 'filtered' | 'all' | 'selected' | 'page';
    /** `'visible'` (default) the drawn data columns in drawn order; `'all'` every data column as defined, hidden ones included. */
    columns?: 'visible' | 'all';
    /** Write the header row. Default true. */
    includeHeaders?: boolean;
    /** These rows instead of the table's (Angular `customData`). */
    rows?: readonly T[];
    /** Server-side rows for this call; wins over the addon option's provider. Used for the `'filtered'` and `'all'` scopes only: `'selected'` and `'page'` always export the table's own rows. */
    provider?: ExportDataProvider<T>;
    /** XLSX: the sheet tab's name (default `Sheet1`), made valid for Excel. */
    sheetName?: string;
    /** XLSX: bold header row. Default true. */
    boldHeader?: boolean;
    /**
     * XLSX: numbers, booleans and dates as typed cells (ISO date strings as dates) for columns without a `cell()` formatter. Default false
     * (parity: every cell is text).
     */
    typedCells?: boolean;
    /** Aborting it stops the export: busy clears, nothing downloads, the promise rejects with the signal's reason. */
    signal?: AbortSignal;
}

/** The addon's options (`addonOptions.export` or `use(exportAddon, options)`). */
export interface ExportOptions<T = unknown> {
    /** Server-side rows for every `'filtered'` / `'all'` call (Angular `exportDataProvider`); `'selected'` and `'page'` export the table's own rows. */
    provider?: ExportDataProvider<T>;
    /** File name without extension when a call gives none. Default `export`. */
    filename?: string;
    /** A locale code of `EXPORT_LOCALES` or a whole dictionary; default the table's locale. */
    locale?: string | ExportLocale;
}

/**
 * What `table.addon<ExportApi>('export')` returns. Concurrent calls run independently; the busy overlay stays while any runs. In server mode
 * (`local-filtering` or `local-pagination` off) without a `provider` (option or per call) or `rows`, an export holds only the rows loaded in
 * the table, as in Angular; the table warns once. Give a provider to fetch every matching row (it receives `exportQuery()`).
 */
export interface ExportApi<T = unknown> {
    /** Downloads `<filename>.csv` (UTF-8 with BOM, CRLF, formula-guarded cells). The second argument may be the rows, as in Angular. */
    exportToCsv(filename?: string, request?: ExportRequest<T> | readonly T[]): Promise<void>;
    /** Downloads `<filename>.xlsx`. */
    exportToExcel(filename?: string, request?: ExportRequest<T> | readonly T[]): Promise<void>;
    /** The CSV text (no BOM), without downloading. */
    toCsv(request?: ExportRequest<T>): Promise<string>;
    /** The XLSX bytes, without downloading. */
    toXlsx(request?: ExportRequest<T>): Promise<Uint8Array>;
}

export interface ExportCompleteDetail {
    format: ExportFormat;
    filename: string;
    rows: number;
    bytes: number;
}

export interface ExportErrorDetail {
    format: ExportFormat;
    error: unknown;
}

declare module '../../data-table-events.js' {
    interface DataTableAddonEvents {
        'export-complete': ExportCompleteDetail;
        'export-error': ExportErrorDetail;
    }
}

export const CSV_MIME = 'text/csv;charset=utf-8;';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Rows per `exportData` call; between two the export yields to the event loop, so the busy overlay paints on a large export. */
export const EXPORT_CHUNK_ROWS = 5000;

/** How long the object URL lives after the click: revoking it at once cancels the download in Safari and some Firefox builds (Angular B1). */
export const REVOKE_DELAY_MS = 4000;

/** `name` (or `export`) made a predictable file name: path, reserved and control characters become `_`, and the extension is added once. */
export function exportFilename(name: string | undefined, extension: ExportFormat): string {
    const base = (name?.trim() || 'export').replace(/[/\\:*?"<>|\u0000-\u001F\u007F]/g, '_');
    return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
}

/** Hands `blob` to the browser as a download named `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.append(a); // connected, so Firefox honours the click
    a.click();
    setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
    }, REVOKE_DELAY_MS);
}

/** Tables already told that a server-mode export without a provider holds only the loaded rows. */
const serverModeWarned = new WeakSet<object>();

const yieldTask =(): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A date-only ISO string as a local date; a full ISO date-time through `Date`. Anything else is not a date. */
function isoDate(value: string): Date | null {
    const parts = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
    if (!parts) return null;
    const [year, month, day] = [Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])];
    const calendar = new Date(Date.UTC(year, month, day));
    if (calendar.getUTCMonth() !== month || calendar.getUTCDate() !== day) return null; // a rolled-over day (2023-02-30), with or without a time
    const date = parts[4] ? new Date(value) : new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** The typed cell of a raw value, or undefined to keep the exported text. */
export function typedCell(raw: unknown): XlsxCell | undefined {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
    if (typeof raw === 'boolean') return raw;
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? undefined : raw;
    if (typeof raw === 'string') return isoDate(raw) ?? undefined;
    return undefined;
}

function abortReason(signal: AbortSignal | undefined): unknown {
    return signal?.reason ?? new DOMException('The export was aborted.', 'AbortError');
}

/** `value`, or a rejection with the abort reason as soon as `signal` aborts (the listener is removed either way). */
function untilAborted<R>(value: R | Promise<R>, signal: AbortSignal | undefined): Promise<R> {
    if (!signal) return Promise.resolve(value);
    if (signal.aborted) return Promise.reject(abortReason(signal));
    let onAbort = (): void => undefined;
    const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(abortReason(signal));
        signal.addEventListener('abort', onAbort, { once: true });
    });
    return Promise.race([Promise.resolve(value), aborted]).finally(() => signal.removeEventListener('abort', onAbort));
}

/** The export flow of one table: rows, grid, file. */
class TableExporter<T> {
    private busyCount = 0;
    private disposed = false;

    constructor(
        private readonly host: DataTableAddonHost<T>,
        private readonly options: ExportOptions<T>,
    ) {}

    readonly api: ExportApi<T> = {
        exportToCsv: (filename, request) => this.download('csv', filename, request),
        exportToExcel: (filename, request) => this.download('xlsx', filename, request),
        toCsv: (request) => this.busy(async () => toCsv((await this.grid(request ?? {}, false)) as string[][])),
        toXlsx: (request) => this.busy(async () => this.xlsx(request ?? {})),
    };

    dispose(): void {
        this.disposed = true;
    }

    private locale(): ExportLocale {
        return resolveAddonLocale(EXPORT_LOCALES, this.host, this.options.locale);
    }

    /** The busy overlay for as long as any export of this table runs. */
    private async busy<R>(run: () => Promise<R>): Promise<R> {
        if (this.busyCount++ === 0) this.host.setBusy(this.locale().exporting);
        try {
            return await run();
        } finally {
            if (--this.busyCount === 0) this.host.setBusy(null);
        }
    }

    private check(signal: AbortSignal | undefined): void {
        if (signal?.aborted || this.disposed) throw abortReason(signal);
    }

    private async download(format: ExportFormat, filename: string | undefined, given: ExportRequest<T> | readonly T[] | undefined): Promise<void> {
        const request: ExportRequest<T> = Array.isArray(given) ? { rows: given as readonly T[] } : ((given as ExportRequest<T> | undefined) ?? {});
        const name = exportFilename(filename || this.options.filename, format);
        try {
            await this.busy(async () => {
                const grid = await this.grid(request, format === 'xlsx' && request.typedCells === true);
                this.check(request.signal);
                const rows = grid.length - (request.includeHeaders === false ? 0 : 1);
                if (rows === 0 || (grid[0]?.length ?? 0) === 0) {
                    this.host.announce(this.locale().exportEmpty); // no data row or no column: no file, header or not
                    return;
                }
                const blob =
                    format === 'csv' ? new Blob([CSV_BOM + toCsv(grid as string[][])], { type: CSV_MIME }) : new Blob([this.workbook(grid, request)], { type: XLSX_MIME });
                downloadBlob(blob, name);
                this.host.emit('export-complete', { format, filename: name, rows, bytes: blob.size });
                this.host.announce(this.locale().exportDone);
            });
        } catch (error) {
            if (!request.signal?.aborted && !this.disposed) {
                this.host.emit('export-error', { format, error });
                this.host.announce(this.locale().exportFailed);
            }
            throw error;
        }
    }

    private async xlsx(request: ExportRequest<T>): Promise<Uint8Array> {
        const grid = await this.grid(request, request.typedCells === true);
        this.check(request.signal);
        return this.workbook(grid, request);
    }

    private workbook(grid: readonly (readonly XlsxCell[])[], request: ExportRequest<T>): Uint8Array<ArrayBuffer> {
        return generateXlsx(grid, { boldFirstRow: request.boldHeader !== false && request.includeHeaders !== false, sheetName: request.sheetName });
    }

    private query(): QueryService<T> {
        const query = this.host.provider('query');
        if (!query) throw new Error('[ge-data-table] export: the table has no query service.');
        return query;
    }

    private async rows(request: ExportRequest<T>): Promise<readonly T[]> {
        if (request.rows) return request.rows;
        const query = this.query();
        // 'selected' and 'page' are rows the user sees in the table: always the local ones, never the provider's.
        if (request.scope === 'page') return query.renderedRows();
        if (request.scope === 'selected') {
            const selection = this.host.provider('selection');
            return selection ? this.filtered(query).filter((row) => selection.isSelected(query.rowId(row))) : [];
        }
        const provider = request.provider ?? this.options.provider;
        const { signal } = request;
        if (provider) return untilAborted(signal ? provider(query.exportQuery(), signal) : provider(query.exportQuery()), signal);
        this.warnServerMode();
        switch (request.scope) {
            case 'all': {
                const tree = query.flatTree({ unfiltered: true }); // a tree table: every node of `data`, depth-first in data order
                return tree.length > 0 ? tree : query.rawRows();
            }
            default:
                return this.filtered(query);
        }
    }

    /** Server filtering or paging and no provider: the export holds only the loaded rows (Angular too); said once per table. */
    private warnServerMode(): void {
        const table = this.host.root as Partial<Record<'localFiltering' | 'localPagination', unknown>>;
        if ((table.localFiltering !== false && table.localPagination !== false) || serverModeWarned.has(this.host.root)) return;
        serverModeWarned.add(this.host.root);
        console.warn('[ge-data-table] export: server-mode export without a provider exports only the loaded rows; give the export addon a `provider`.');
    }

    /** The filtered, sorted rows of every page; in a tree table every node of the filtered tree, depth-first in drawn order, whatever is collapsed. */
    private filtered(query: QueryService<T>): readonly T[] {
        const tree = query.flatTree();
        return tree.length > 0 ? tree : query.sortedData();
    }

    /** Header plus the rows' cells, built `EXPORT_CHUNK_ROWS` rows at a time; `typed` swaps raw values in where the column has no `cell()`. */
    private async grid(request: ExportRequest<T>, typed: boolean): Promise<XlsxCell[][]> {
        this.check(request.signal);
        const rows = await this.rows(request);
        this.check(request.signal);
        const query = this.query();
        const options = { onlyVisible: request.columns !== 'all' };
        const columns = query.exportColumns(options); // one snapshot: a column hidden or moved during a yield does not change the file
        const grid: XlsxCell[][] = request.includeHeaders === false ? [] : query.exportData({ ...options, includeHeaders: true }, [], columns);
        for (let start = 0; start < rows.length; start += EXPORT_CHUNK_ROWS) {
            if (start > 0) {
                await yieldTask();
                this.check(request.signal);
            }
            const chunk = rows.slice(start, start + EXPORT_CHUNK_ROWS);
            const cells = query.exportData({ ...options, includeHeaders: false }, chunk, columns);
            for (const [i, line] of cells.entries()) grid.push(typed ? this.typedLine(query, columns, chunk[i] as T, line) : line);
        }
        return grid;
    }

    private typedLine(query: QueryService<T>, columns: readonly ColumnDef<T>[], row: T, line: string[]): XlsxCell[] {
        return line.map((text, j) => {
            const column = columns[j];
            if (!column || column.cell) return text;
            return typedCell(query.cellValue(row, column.accessorKey, column)) ?? text;
        });
    }
}

/** The export addon, id `export`. */
export const exportAddon: DataTableAddon = {
    id: 'export',
    setup(host, setting) {
        if (setting === false) return undefined;
        const options = typeof setting === 'object' && setting !== null ? (setting as ExportOptions) : {};
        const exporter = new TableExporter(host, options);
        host.expose(exporter.api);
        return () => exporter.dispose();
    },
};
