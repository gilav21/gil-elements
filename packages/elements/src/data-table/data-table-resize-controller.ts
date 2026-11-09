import { isSecondaryTouch } from '../shared/touch.js';
import { columnCells, HEAD_SELECTOR as HEAD } from './data-table-columns.js';
import { type DataTableCoreHost, requireProvider } from './data-table-host.js';
import type { ResizeService } from './data-table-providers.js';
import { columnMinWidthPx } from './data-table-virtual.js';
import { interpolate } from './data-table.locales.js';
import type { EnhancedColumnDef } from './data-table.types.js';

const HANDLE = '[data-slot="data-table-resize-handle"]';
/** Two touch taps closer than this are a double tap; a tap that moved more than `TAP_SLOP` was a drag. */
const DOUBLE_TAP_MS = 300;
const TAP_SLOP = 4;
const KEY_STEP = 10;
const KEY_STEP_LARGE = 50;
/** Added to the widest content: `max-content` of a border-box cell already holds its padding, this covers the border and rounding. */
const FIT_SLACK = 2;
const KEY_ANNOUNCE_MS = 300;
const MIN_FIT_WIDTH = 50;

interface Drag {
    readonly key: string;
    readonly n: number;
    readonly handle: HTMLElement;
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    readonly startWidth: number;
    readonly floor: number;
    /** `1`, or `-1` in rtl: the end edge moves the other way. */
    readonly sign: number;
    readonly oldWidth: string;
    /** The inline value of the column's custom property before the drag, put back on cancel. */
    readonly original: string;
    readonly wasAuto: boolean;
    readonly pinned: boolean;
    width: number;
    travel: number;
    readonly stop: () => void;
}

const px = (n: number): string => `${n}px`;

/**
 * Column resize: a pointer drag on the head's handle (mouse, pen and touch share one path, with pointer capture), a
 * double click or double tap that fits the column to its content, and arrow keys on the focusable separator.
 *
 * A drag rewrites ONE custom property (`--ge-dt-col-N`) of the table, so header, body and footer follow with no
 * render, and commits the width once on release. Auto-fit measures the rendered cells in place.
 */
export class ResizeController<T> {
    private drag: Drag | null = null;
    private lastTap: { key: string; at: number } | null = null;
    private lastFit = 0;
    private cancelAnnounce: (() => void) | undefined;
    private unprovide: (() => void) | undefined;
    private removeKeys: (() => void) | undefined;
    private readonly teardown: (() => void)[] = [];

    constructor(private readonly host: DataTableCoreHost<T>) {}

    private columns() {
        return requireProvider(this.host, 'columns');
    }

    private table(): HTMLElement | null {
        return this.host.root.querySelector<HTMLElement>('[data-slot="table"]');
    }

    private viewport(): HTMLElement | null {
        return this.host.root.querySelector<HTMLElement>('[data-slot="data-table-viewport"]');
    }

    private rootFontPx(): number {
        const { ownerDocument } = this.host.root;
        return Number.parseFloat(ownerDocument.defaultView?.getComputedStyle(ownerDocument.documentElement).fontSize ?? '') || 16;
    }

    private column(key: string): { column: EnhancedColumnDef<T>; n: number } | null {
        const columns = this.columns().enhancedColumns();
        const n = columns.findIndex((c) => String(c.accessorKey) === key);
        const column = columns[n];
        return column ? { column, n } : null;
    }

    /** The width the model or the definition gives `key`, as the `column-resize` event reports it. */
    private declaredWidth(key: string, column: EnhancedColumnDef<T>): string {
        const widths = this.host.model.get('columnWidths');
        return Object.hasOwn(widths, key) ? (widths[key] ?? column._width) : column._width;
    }

    /** One model write and one `column-resize` event for a width the user chose. */
    private commit(changes: readonly { key: string; oldWidth: string; newWidth: string }[]): void {
        if (changes.length === 0) return;
        const widths = this.host.model.get('columnWidths');
        this.host.model.set('columnWidths', Object.fromEntries([...Object.entries(widths), ...changes.map((c) => [c.key, c.newWidth] as const)]));
        for (const { key, oldWidth, newWidth } of changes) this.host.emit('column-resize', { columnKey: key, oldWidth, newWidth });
    }

    // ---- pointer drag -----------------------------------------------------------------------------------------

    private readonly onDown = (event: PointerEvent): void => {
        if (this.drag && isSecondaryTouch(event)) return this.cancel();
        const handle = (event.target as Element).closest?.<HTMLElement>(HANDLE);
        if (!handle || event.button !== 0 || this.drag || isSecondaryTouch(event)) return;
        const head = handle.closest<HTMLElement>(HEAD);
        const key = head?.dataset['columnId'];
        const found = key === undefined ? null : this.column(key);
        const table = this.table();
        if (!head || key === undefined || !found || !table) return;
        const { column, n } = found;
        const direction = handle.ownerDocument.defaultView?.getComputedStyle(this.host.root).direction;
        const name = `--ge-dt-col-${n}`;
        handle.setPointerCapture(event.pointerId);
        handle.toggleAttribute('data-resizing', true);
        this.viewport()?.toggleAttribute('data-table-resizing', true);
        const stops = [
            this.host.disposables.listen<PointerEvent>(handle, 'pointermove', this.onMove),
            this.host.disposables.listen<PointerEvent>(handle, 'pointerup', this.onUp),
            this.host.disposables.listen(handle, 'pointercancel', this.cancel),
            this.host.disposables.listen(handle, 'lostpointercapture', this.cancel),
            this.host.disposables.listen<KeyboardEvent>(handle.ownerDocument, 'keydown', (e) => e.key === 'Escape' && this.cancel()),
            this.host.disposables.listen(handle.ownerDocument.defaultView ?? window, 'blur', this.cancel),
        ];
        const startWidth = head.getBoundingClientRect().width;
        this.drag = {
            key,
            n,
            handle,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startWidth,
            floor: columnMinWidthPx(column, this.rootFontPx()),
            sign: direction === 'rtl' ? -1 : 1,
            oldWidth: this.declaredWidth(key, column),
            original: table.style.getPropertyValue(name),
            wasAuto: column._width === 'auto',
            pinned: column._pin !== undefined,
            width: startWidth,
            travel: 0,
            stop: () => stops.forEach((stop) => stop()),
        };
        // An auto column ignores `--ge-dt-col-N`; it is fixed from the first move (a render after the commit says so too).
        if (this.drag.wasAuto) this.setFixed(key, true);
    };

    private readonly onMove = (event: PointerEvent): void => {
        const drag = this.drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        const dx = event.clientX - drag.startX;
        drag.travel = Math.max(drag.travel, Math.hypot(dx, event.clientY - drag.startY));
        const width = Math.max(drag.floor, Math.round(drag.startWidth + dx * drag.sign));
        if (width === drag.width) return;
        drag.width = width;
        this.show(drag);
    };

    private readonly onUp = (event: PointerEvent): void => {
        const drag = this.drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        this.finish(drag);
        const width = Math.round(drag.width);
        if (width !== Math.round(drag.startWidth)) {
            this.lastTap = null;
            this.commit([{ key: drag.key, oldWidth: drag.oldWidth, newWidth: px(width) }]);
        } else {
            this.restore(drag);
            if (event.pointerType === 'touch' && drag.travel <= TAP_SLOP) this.tap(drag.key, event.timeStamp);
        }
        this.columns().liveWidth(drag.key, null);
    };

    private readonly cancel = (): void => {
        const drag = this.drag;
        if (!drag) return;
        this.finish(drag);
        this.restore(drag);
        this.columns().liveWidth(drag.key, null);
    };

    /** Moves the dragged column on screen: its custom property, and the offsets of pinned columns that follow it. */
    private show(drag: Drag): void {
        const table = this.table();
        if (!table) return;
        const columns = this.columns();
        table.style.setProperty(`--ge-dt-col-${drag.n}`, px(drag.width));
        columns.liveWidth(drag.key, drag.width);
        if (drag.pinned) columns.enhancedColumns().forEach((c, n) => c._pinOffset !== undefined && table.style.setProperty(`--ge-dt-pin-${n}`, c._pinOffset));
    }

    private finish(drag: Drag): void {
        this.drag = null;
        drag.stop();
        if (drag.handle.hasPointerCapture(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId);
        drag.handle.toggleAttribute('data-resizing', false);
        this.viewport()?.toggleAttribute('data-table-resizing', false);
    }

    /** Puts back what the drag showed: the property, the pin offsets and an auto column's `data-width`. */
    private restore(drag: Drag): void {
        const table = this.table();
        if (!table) return;
        if (drag.original) table.style.setProperty(`--ge-dt-col-${drag.n}`, drag.original);
        else table.style.removeProperty(`--ge-dt-col-${drag.n}`);
        if (drag.pinned) this.columns().enhancedColumns().forEach((c, n) => c._pinOffset !== undefined && table.style.setProperty(`--ge-dt-pin-${n}`, c._pinOffset));
        if (drag.wasAuto) this.setFixed(drag.key, false);
    }

    private setFixed(key: string, fixed: boolean): void {
        for (const cell of columnCells(this.host.root, key)) cell.setAttribute('data-width', fixed ? 'fixed' : 'auto');
    }

    private tap(key: string, at: number): void {
        if (this.lastTap?.key === key && at - this.lastTap.at <= DOUBLE_TAP_MS) {
            this.lastTap = null;
            this.lastFit = performance.now();
            this.autoSizeColumn(key);
        } else {
            this.lastTap = { key, at };
        }
    }

    // ---- auto-fit ---------------------------------------------------------------------------------------------

    /**
     * The widest content of each column, measured in place: the head and the rendered cells are let size to
     * `max-content` for the length of one synchronous read (no paint), so shadow content and editors count.
     */
    private measure(keys: readonly string[]): Map<string, number> {
        const table = this.table();
        const widths = new Map<string, number>();
        if (!table) return widths;
        const cells = keys.map((key) => [key, columnCells(this.host.root, key)] as const);
        for (const [, group] of cells) for (const cell of group) cell.toggleAttribute('data-measure', true);
        table.toggleAttribute('data-measuring', true);
        try {
            for (const [key, group] of cells) widths.set(key, Math.max(0, ...group.map((cell) => cell.getBoundingClientRect().width)));
        } finally {
            table.toggleAttribute('data-measuring', false);
            for (const [, group] of cells) for (const cell of group) cell.toggleAttribute('data-measure', false);
        }
        return widths;
    }

    private fit(keys: readonly string[]): void {
        const rootPx = this.rootFontPx();
        const changes = [...this.measure(keys)].flatMap(([key, content]) => {
            const found = this.column(key);
            if (!found || content <= 0) return [];
            const newWidth = px(Math.max(columnMinWidthPx(found.column, rootPx), Math.ceil(content) + FIT_SLACK));
            const oldWidth = this.declaredWidth(key, found.column);
            return newWidth === oldWidth ? [] : [{ key, oldWidth, newWidth }];
        });
        this.commit(changes);
    }

    private readonly autoSizeColumn = (key: string): void => this.fit([key]);

    private readonly service: ResizeService = {
        autoSizeColumn: this.autoSizeColumn,
        autoSizeAllColumns: () => this.fit(this.columns().navigableKeys()),
        fitColumnsToViewport: () => {
            const width = this.viewport()?.clientWidth;
            const keys = this.columns().navigableKeys();
            if (!width || keys.length === 0) return;
            const each = px(Math.max(MIN_FIT_WIDTH, Math.floor(width / keys.length)));
            this.host.model.set('columnWidths', Object.fromEntries([...Object.entries(this.host.model.get('columnWidths')), ...keys.map((key) => [key, each] as const)]));
        },
    };

    // ---- keyboard ---------------------------------------------------------------------------------------------

    private handleKey(event: KeyboardEvent): boolean {
        const handle = (event.target as Element).closest?.<HTMLElement>(HANDLE);
        if (!handle || event.altKey || event.ctrlKey || event.metaKey) return false;
        const key = handle.closest<HTMLElement>(HEAD)?.dataset['columnId'];
        const found = key === undefined ? null : this.column(key);
        if (key === undefined || !found) return false;
        const rtl = handle.ownerDocument.defaultView?.getComputedStyle(this.host.root).direction === 'rtl';
        const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
        const floor = columnMinWidthPx(found.column, this.rootFontPx());
        const current = Math.round(handle.closest(HEAD)?.getBoundingClientRect().width ?? floor);
        let next: number;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = current + ((event.key === 'ArrowRight') !== rtl ? step : -step);
        else if (event.key === 'Home') next = floor;
        else if (event.key === 'Enter') {
            event.preventDefault();
            this.autoSizeColumn(key);
            return true;
        } else if (event.key === 'Escape') {
            handle.blur();
            return true;
        } else return false;
        event.preventDefault();
        next = Math.max(Math.ceil(floor), next);
        if (next === current) return true;
        this.commit([{ key, oldWidth: this.declaredWidth(key, found.column), newWidth: px(next) }]);
        handle.setAttribute('aria-valuenow', String(next));
        this.announceWidth(found.column, next);
        return true;
    }

    /** Typing at the arrow keys repeats: only the last width is spoken, read when the timer fires. */
    private announceWidth(column: EnhancedColumnDef<T>, width: number): void {
        this.cancelAnnounce?.();
        this.cancelAnnounce = this.host.disposables.timeout(() => {
            this.host.announce(interpolate(this.host.resolvedLocale.columnResizedAnnouncement, { column: column.header, width }));
        }, KEY_ANNOUNCE_MS);
    }

    // ---- wiring -----------------------------------------------------------------------------------------------

    attach(): void {
        const { root, disposables } = this.host;
        this.unprovide = this.host.provide('resize', this.service);
        this.removeKeys = this.host.addKeyHandler(20, (event) => this.handleKey(event));
        this.teardown.push(
            disposables.listen<PointerEvent>(root, 'pointerdown', this.onDown),
            disposables.listen<MouseEvent>(root, 'dblclick', (event) => {
                const handle = (event.target as Element).closest?.<HTMLElement>(HANDLE);
                const key = handle?.closest<HTMLElement>(HEAD)?.dataset['columnId'];
                if (key === undefined) return;
                event.preventDefault();
                // A double tap already fitted the column; the browser's own `dblclick` for it must not fit it twice.
                if (performance.now() - this.lastFit > 600) this.autoSizeColumn(key);
            }),
            // The separator's value is the measured width when it takes focus: a `rem`, `%` or `auto` width has no px string to render.
            disposables.listen<FocusEvent>(root, 'focusin', (event) => {
                const handle = (event.target as Element).closest?.<HTMLElement>(HANDLE);
                const width = handle?.closest(HEAD)?.getBoundingClientRect().width;
                if (handle && width) handle.setAttribute('aria-valuenow', String(Math.round(width)));
            }),
        );
    }

    detach(): void {
        this.cancel();
        this.cancelAnnounce?.();
        this.removeKeys?.();
        this.unprovide?.();
        for (const stop of this.teardown.splice(0)) stop();
    }
}
