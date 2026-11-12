import { resolveCellFormatting } from './data-table-cells.js';
import { diffFlashes, flashColumns, type FlashSnapshot, snapshotFlash } from './data-table-flash.js';
import { type DataTableCoreHost, ownElements } from './data-table-host.js';
import type { FormattingService } from './data-table-providers.js';
import type { CellFlashDirection } from './data-table.types.js';

/** The custom property the flash animation reads its duration from (data-table-drag.css), so `cell-flash-duration` and the animation agree. */
const FLASH_MS = '--ge-dt-flash-ms';

/**
 * Conditional formatting (class rules, style rules, colour scale, data bar, icon set) served as `formatting`, and cell flash (wave 6,
 * package C, eager): `flash` answers which cells are flashing, `anyFlashing` whether any is (so a grid with nothing flashing does no
 * per-cell work).
 *
 * Flash differs from Angular (cmp 1781) in cost and in one bug: the snapshot holds the DRAWN rows only (the window in virtual mode), taken
 * again whenever the data, the columns or the window change, so a data change costs O(drawn rows); and every cell expires on its OWN
 * deadline through one re-armed timer (Angular's first timer clears every later flash early, AB4). Timers are the host's disposables.
 */
export class FormattingController<T> {
    private unprovide: (() => void) | undefined;
    private snapshot: FlashSnapshot | null = null;
    private seen: { data: unknown; columns: unknown; rendered: unknown; window: string } | null = null;
    /** Row id -> column key -> what flashes and until when (`performance.now()`). */
    private readonly flashes = new Map<string, Map<string, { direction: CellFlashDirection; until: number }>>();
    private timer: { at: number; cancel: () => void } | null = null;
    /** The duration written to the host as `--ge-dt-flash-ms`, or null when nothing was written. */
    private writtenMs: number | null = null;

    constructor(private readonly host: DataTableCoreHost<T>) {}

    private readonly service: FormattingService<T> = {
        cell: resolveCellFormatting,
        flash: (rowId, columnKey) => this.flashes.get(rowId)?.get(columnKey)?.direction,
        anyFlashing: () => this.flashes.size > 0,
    };

    attach(): void {
        this.unprovide = this.host.provide('formatting', this.service);
    }

    hostUpdate(): void {
        const { config, model } = this.host;
        if (!config.enableCellFlash) return this.reset();
        this.writeDuration(config.cellFlashDuration);
        const query = this.host.provider('query');
        if (!query) return;
        const data = model.get('data');
        // The drawn list is the memoised `renderedRows()` (a page, a filter, a sort, a group or a node opened or closed is a new array) plus the virtual window.
        const rendered = query.renderedRows();
        const window = this.windowKey();
        const seen = this.seen;
        if (seen?.data === data && seen.columns === config.columns && seen.rendered === rendered && seen.window === window) return; // nothing new is drawn
        const rows = this.drawnRows(rendered);
        const columns = flashColumns(config.columns);
        // A change of the data or the columns flashes against what was drawn; anything else that changes what is drawn (another page, a filter, a sort, a
        // window that moved) over the same data only re-snapshots: a row that comes into view does not flash.
        if (this.snapshot && seen && (seen.data !== data || seen.columns !== config.columns)) this.start(diffFlashes(this.snapshot, rows, columns, config.getRowId), config.cellFlashDuration);
        this.snapshot = snapshotFlash(rows, columns, config.getRowId);
        this.seen = { data, columns: config.columns, rendered, window };
    }

    detach(): void {
        this.reset();
        this.unprovide?.();
    }

    /** The rows drawn now: every rendered row, or the virtual window (plus the rows it retains). */
    private drawnRows(rows: readonly T[]): readonly T[] {
        const virtual = this.host.provider('virtual');
        if (!virtual?.active()) return rows;
        const w = virtual.window();
        const drawn = rows.slice(w.start, w.end);
        for (const i of w.retained) {
            const row = rows[i];
            if (row !== undefined && (i < w.start || i >= w.end)) drawn.push(row);
        }
        return drawn;
    }

    private windowKey(): string {
        const virtual = this.host.provider('virtual');
        if (!virtual?.active()) return '';
        const w = virtual.window();
        return `${w.start}:${w.end}:${w.retained.join(',')}`;
    }

    private start(changes: ReturnType<typeof diffFlashes>, durationMs: number): void {
        if (changes.size === 0) return;
        const until = performance.now() + Math.max(0, durationMs);
        const again: [rowId: string, key: string][] = [];
        for (const [rowId, cells] of changes) {
            let held = this.flashes.get(rowId);
            if (!held) this.flashes.set(rowId, (held = new Map()));
            for (const [key, direction] of cells) {
                if (held.has(key)) again.push([rowId, key]); // flashing already: the attribute may not change, so the animation must be restarted
                held.set(key, { direction, until });
            }
        }
        if (again.length > 0) this.host.afterRender(() => this.restart(again));
        this.arm();
    }

    /**
     * A cell that changes again while it flashes keeps its `data-flash` value when the direction is the same, so its CSS animation would not start over:
     * the cell's `data-flash-again` is toggled, which switches the keyframes' name (data-table-drag.css) and so restarts the fade.
     */
    private restart(cells: readonly (readonly [string, string])[]): void {
        const { root } = this.host;
        const rows = new Map(ownElements(root, root.querySelectorAll<HTMLElement>('[data-slot="table-row"][data-row-id]')).map((row) => [row.dataset['rowId'], row]));
        for (const [rowId, key] of cells) {
            const cell = [...(rows.get(rowId)?.querySelectorAll<HTMLElement>('[data-slot="table-cell"][data-column]') ?? [])].find((el) => el.dataset['column'] === key);
            cell?.toggleAttribute('data-flash-again');
        }
    }

    /** One timer, for the earliest deadline; it drops what expired, asks for a render and arms itself for the next one. */
    private arm(): void {
        let next = Infinity;
        for (const cells of this.flashes.values()) for (const { until } of cells.values()) next = Math.min(next, until);
        if (next === Infinity) return this.stopTimer();
        if (this.timer && this.timer.at <= next) return;
        this.stopTimer();
        const cancel = this.host.disposables.timeout(() => {
            this.timer = null;
            this.expire();
        }, Math.max(0, next - performance.now()));
        this.timer = { at: next, cancel };
    }

    private expire(): void {
        const now = performance.now() + 1; // 1 ms: a timer may fire a hair early
        for (const [rowId, cells] of this.flashes) {
            for (const [key, { until }] of cells) if (until <= now) cells.delete(key);
            if (cells.size === 0) this.flashes.delete(rowId);
        }
        this.host.requestRender();
        this.arm();
    }

    private stopTimer(): void {
        this.timer?.cancel();
        this.timer = null;
    }

    private writeDuration(ms: number): void {
        if (this.writtenMs === ms) return;
        this.writtenMs = ms;
        this.host.root.style.setProperty(FLASH_MS, `${Math.max(0, ms)}ms`);
    }

    /** Flash off (or the table detached): nothing flashes, nothing is remembered, the duration property is taken back. */
    private reset(): void {
        // No render is asked for: this runs inside an update (the render that follows reads `anyFlashing` false) or a detach.
        this.stopTimer();
        this.flashes.clear();
        this.snapshot = null;
        this.seen = null;
        if (this.writtenMs !== null) {
            this.host.root.style.removeProperty(FLASH_MS);
            this.writtenMs = null;
        }
    }
}
