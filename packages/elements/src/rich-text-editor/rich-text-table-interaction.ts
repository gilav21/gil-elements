import { html, nothing, ReactiveElement, svg, unsafeCSS, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import type { RichTextControllerHost, RichTextRenderingController } from './rich-text-controllers.js';
import { Disposables } from './rich-text-registry.js';
import type { TableBorderStyle, TableCellAlignment, TableCommands } from './rich-text-table-commands.js';
import { buildCellGrid, caretCellOf, cellGridBounds, cellRectangle, type CellGrid } from './rich-text-table-grid.js';
import css from './rich-text-table.css?inline';

interface ResizeState {
    readonly table: HTMLTableElement;
    readonly before: HTMLTableCellElement;
    readonly after: HTMLTableCellElement | null;
    readonly startX: number;
    readonly beforeWidth: number;
    readonly afterWidth: number;
    readonly tableWidth: number;
    /** 1 in LTR; -1 in RTL, where the column before the border is the one on the right. */
    readonly direction: 1 | -1;
}

interface ResizeBorder {
    readonly table: HTMLTableElement;
    readonly before: HTMLTableCellElement;
    readonly after: HTMLTableCellElement | null;
}

const RESIZE_HOTSPOT = 4;
const MIN_COLUMN_WIDTH = 60;
const MENU_MARGIN = 8;
const CELL_SELECTED = 'rte-cell-selected';
const CELL_COLORS = [
    'transparent', '#ffffff', '#fef3c7', '#d9f99d', '#bbf7d0', '#a5f3fc', '#c7d2fe', '#fce7f3',
    '#fecaca', '#fed7aa', '#fde68a', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9', '#ead1dc',
] as const;

const BORDER_ICONS: readonly { style: TableBorderStyle; label: 'bordersAll' | 'bordersNone' | 'bordersOuter' | 'bordersHorizontal'; icon: TemplateResult }[] = [
    {
        style: 'all',
        label: 'bordersAll',
        icon: svg`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="18" height="18"/><line x1="10" y1="1" x2="10" y2="19"/><line x1="1" y1="10" x2="19" y2="10"/></svg>`,
    },
    {
        style: 'none',
        label: 'bordersNone',
        icon: svg`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1" opacity="0.35"><rect x="1" y="1" width="18" height="18" stroke-dasharray="2 2"/><line x1="10" y1="1" x2="10" y2="19" stroke-dasharray="2 2"/><line x1="1" y1="10" x2="19" y2="10" stroke-dasharray="2 2"/></svg>`,
    },
    {
        style: 'outer',
        label: 'bordersOuter',
        icon: svg`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor"><rect x="1" y="1" width="18" height="18" stroke-width="1.5"/><line x1="10" y1="1" x2="10" y2="19" stroke-width="1" opacity="0.25" stroke-dasharray="2 2"/><line x1="1" y1="10" x2="19" y2="10" stroke-width="1" opacity="0.25" stroke-dasharray="2 2"/></svg>`,
    },
    {
        style: 'horizontal',
        label: 'bordersHorizontal',
        icon: svg`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor"><line x1="1" y1="1" x2="19" y2="1" stroke-width="1.5"/><line x1="1" y1="10" x2="19" y2="10" stroke-width="1.5"/><line x1="1" y1="19" x2="19" y2="19" stroke-width="1.5"/></svg>`,
    },
];

type LineSpan = readonly [number, number];

/** x extents of the three text lines each alignment icon draws, at y 6, 12 and 18. */
const ALIGN_ICONS: readonly { alignment: TableCellAlignment; label: 'cellAlignLeft' | 'cellAlignCenter' | 'cellAlignRight'; lines: readonly LineSpan[] }[] = [
    { alignment: 'left', label: 'cellAlignLeft', lines: [[3, 21], [3, 15], [3, 17]] },
    { alignment: 'center', label: 'cellAlignCenter', lines: [[3, 21], [7, 17], [5, 19]] },
    { alignment: 'right', label: 'cellAlignRight', lines: [[3, 21], [9, 21], [7, 21]] },
];

function alignIcon(lines: readonly LineSpan[]): TemplateResult {
    const rows = lines.map(([x1, x2], row) => svg`<line x1=${x1} x2=${x2} y1=${6 + row * 6} y2=${6 + row * 6}/>`);
    return svg`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${rows}</svg>`;
}

const outerWidth = (element: HTMLElement): number => element.getBoundingClientRect().width;

/** Gives the table fixed layout and every first-row cell its on-screen width, so a drag moves exactly the columns it names. */
function pinWidths(table: HTMLTableElement, cells: readonly HTMLTableCellElement[]): void {
    const widths = new Map<HTMLElement, number>([[table, outerWidth(table)], ...cells.map((cell): [HTMLElement, number] => [cell, outerWidth(cell)])]);
    table.style.tableLayout = 'fixed';
    for (const [element, width] of widths) element.style.width = `${width}px`;
}

function cellAt(target: EventTarget | null): HTMLTableCellElement | null {
    return target instanceof Element ? target.closest<HTMLTableCellElement>('td, th') : null;
}

/** The single-column first-row cell covering `column`, when no colspan makes it cover more. */
function singleColumnCell(row: CellGrid[number], column: number): HTMLTableCellElement | null {
    const cell = row[column];
    return cell && (cell.colSpan || 1) === 1 ? cell : null;
}

/**
 * Pointer and touch handling for tables in the editable: picking a range of cells, dragging a column
 * border, and the right-click menu that drives the table commands.
 */
export class TableInteractionController implements RichTextRenderingController {
    private readonly life = new Disposables();
    private readonly menuClose = new Disposables();
    private selected: HTMLTableCellElement[] = [];
    private anchor: HTMLTableCellElement | null = null;
    private target: HTMLTableCellElement | null = null;
    private menu: { x: number; y: number } | null = null;
    private resize: ResizeState | null = null;
    private resizeArmed = false;
    private drag: AbortController | null = null;

    constructor(private readonly host: RichTextControllerHost) {}

    attach(): void {
        const { host, life } = this;
        const root = host.contentRoot;
        life.listen<MouseEvent>(root, 'mousedown', (event) => this.onMouseDown(event));
        life.listen<MouseEvent>(root, 'mousemove', (event) => this.onMouseMove(event));
        life.listen<MouseEvent>(root, 'contextmenu', (event) => this.onContextMenu(event));
        life.listen<TouchEvent>(root, 'touchstart', (event) => this.onTouchStart(event), { passive: false });
        life.add(host.onContentReplaced(() => this.reset()));
        life.add(host.provide('tableSelection', {
            selectedCells: () => this.selected,
            select: (cells) => this.applySelection(cells),
            clear: () => this.applySelection([]),
            target: () => this.target ?? caretCellOf(host.getSelection()),
            setTarget: (cell) => {
                this.target = cell;
            },
        }));
        life.add(() => this.endDrag());
        life.add(() => this.closeMenu());
    }

    detach(): void {
        this.life.dispose();
        this.applySelection([]);
        this.resize = null;
    }

    private get inert(): boolean {
        return this.host.readonly || this.host.isDisabled;
    }

    private reset(): void {
        this.selected = [];
        this.anchor = null;
        this.target = null;
    }

    // Cell selection

    private applySelection(cells: readonly HTMLTableCellElement[]): void {
        for (const cell of this.selected) cell.classList.remove(CELL_SELECTED);
        for (const cell of cells) cell.classList.add(CELL_SELECTED);
        this.selected = [...cells];
        this.host.invalidate();
    }

    /** Ctrl/Cmd+click toggles one cell; Shift+click takes the rectangle from the anchor. Returns whether it handled the press. */
    private onModifiedClick(event: MouseEvent, cell: HTMLTableCellElement): boolean {
        const toggling = event.ctrlKey || event.metaKey;
        if (!toggling && !event.shiftKey) return false;
        const table = cell.closest('table');
        if (!table) return false;
        event.preventDefault();
        if (event.shiftKey && this.anchor?.closest('table') === table) {
            this.applySelection(this.anchor === cell ? [cell] : this.rectangle(this.anchor, cell));
        } else if (toggling) {
            this.applySelection(this.selected.includes(cell) ? this.selected.filter((c) => c !== cell) : [...this.selected, cell]);
            this.anchor = cell;
        } else {
            this.applySelection([cell]);
            this.anchor = cell;
        }
        this.dropTextSelection();
        return true;
    }

    private rectangle(anchor: HTMLTableCellElement, current: HTMLTableCellElement): HTMLTableCellElement[] {
        const cells = cellRectangle(anchor, current);
        return cells.length > 1 ? cells : [];
    }

    /** Leaves the cell selection as the only highlight; a collapsed range would be extended again by the next mouse move. */
    private dropTextSelection(): void {
        this.host.getSelection()?.removeAllRanges();
    }

    private onMouseDown(event: MouseEvent): void {
        if (this.inert) return;
        const cell = cellAt(event.target);
        if (event.button === 2) {
            if (!cell || !this.selected.includes(cell)) this.applySelection([]);
            return;
        }
        if (cell && this.onModifiedClick(event, cell)) return;
        this.applySelection([]);
        if (cell && this.startResize(event, cell, event.clientX, this.resizeArmed)) return;
        if (cell) this.beginCellDrag(cell);
    }

    private beginCellDrag(cell: HTMLTableCellElement): void {
        this.anchor = cell;
        this.listenDrag((signal) => {
            const { doc } = this.host;
            doc.addEventListener('mousemove', (event) => this.dragSelectTo(event.clientX, event.clientY, true), { signal });
            doc.addEventListener('mouseup', () => this.endDrag(), { signal });
        });
    }

    /** Extends the cell range to the cell under the pointer; a move off the anchor's table or onto no cell changes nothing. */
    private dragSelectTo(clientX: number, clientY: number, collapseText: boolean): HTMLTableCellElement | null {
        const anchor = this.anchor;
        const cell = cellAt(this.host.doc.elementFromPoint(clientX, clientY));
        const table = anchor?.closest('table');
        if (!anchor || !cell || !table || cell.closest('table') !== table) return null;
        this.applySelection(this.rectangle(anchor, cell));
        // Inside one cell the text selection stays: it is how part of a cell's contents is picked.
        if (collapseText && this.selected.length > 1) this.dropTextSelection();
        return cell;
    }

    private onTouchStart(event: TouchEvent): void {
        if (this.inert) return;
        const cell = cellAt(event.target);
        const touch = event.touches[0] ?? event.changedTouches[0];
        if (touch && cell && this.startResize(event, cell, touch.clientX, true)) return;
        if (!cell) return;
        this.applySelection([]);
        this.anchor = cell;
        this.listenDrag((signal) => {
            const { doc } = this.host;
            doc.addEventListener('touchmove', (move) => {
                const point = move.touches[0];
                if (point && this.dragSelectTo(point.clientX, point.clientY, false)) move.preventDefault();
            }, { signal, passive: false });
            doc.addEventListener('touchend', () => this.endDrag(), { signal });
            doc.addEventListener('touchcancel', () => this.endDrag(), { signal });
        });
    }

    // Column resize

    private onMouseMove(event: MouseEvent): void {
        if (this.resize || this.inert) return;
        const cell = cellAt(event.target);
        if (cell && this.resolveBorder(cell, event.clientX)) {
            this.resizeArmed = true;
            this.host.contentRoot.style.cursor = 'col-resize';
        } else if (this.resizeArmed) {
            this.resizeArmed = false;
            this.host.contentRoot.style.cursor = '';
        }
    }

    /** Pins the table to fixed layout with explicit widths and starts a column drag. Returns false when the pointer is not on a draggable border. */
    private startResize(event: Event, cell: HTMLTableCellElement, clientX: number, armed: boolean): boolean {
        const border = armed ? this.resolveBorder(cell, clientX) : null;
        if (!border) return false;
        event.preventDefault();
        event.stopPropagation();
        const { table, before, after } = border;
        pinWidths(table, Array.from(table.rows[0]?.cells ?? []));
        this.resize = {
            table, before, after,
            tableWidth: outerWidth(table),
            startX: clientX,
            beforeWidth: outerWidth(before),
            afterWidth: after ? outerWidth(after) : 0,
            direction: this.host.isRtl ? -1 : 1,
        };
        this.listenDrag((signal) => {
            const { doc } = this.host;
            doc.addEventListener('mousemove', (move) => this.resizeTo(move.clientX), { signal });
            doc.addEventListener('mouseup', () => this.finishResize(), { signal });
            doc.addEventListener('touchmove', (move) => {
                const point = move.touches[0];
                if (!point) return;
                move.preventDefault();
                this.resizeTo(point.clientX);
            }, { signal, passive: false });
            doc.addEventListener('touchend', () => this.finishResize(), { signal });
            doc.addEventListener('touchcancel', () => this.finishResize(), { signal });
        });
        return true;
    }

    /**
     * The border a pointer at `clientX` grabs on `cell`, as the first-row cells that size the columns either
     * side of it. Columns come from the cell grid, not the cell's index in its row, which a rowspan shifts.
     * A fixed-layout table takes its widths from the first row alone, so each column beside the border needs
     * a first-row cell of its own; `after` is null at the table's end edge, which resizes the table.
     */
    private resolveBorder(cell: HTMLTableCellElement, clientX: number): ResizeBorder | null {
        const table = cell.closest<HTMLTableElement>('table');
        const side = this.edgeAt(cell, clientX);
        if (!table || !side) return null;
        const grid = buildCellGrid(table);
        const bounds = cellGridBounds(grid, cell);
        const column = side === 'end' ? bounds.maxCol : bounds.minCol - 1;
        const firstRow = grid[0];
        if (column < 0 || !firstRow) return null;
        const before = singleColumnCell(firstRow, column);
        const atTableEnd = column === firstRow.length - 1;
        const after = atTableEnd ? null : singleColumnCell(firstRow, column + 1);
        return before && (atTableEnd || after) ? { table, before, after } : null;
    }

    private edgeAt(cell: HTMLTableCellElement, clientX: number): 'start' | 'end' | null {
        const rect = cell.getBoundingClientRect();
        const nearRight = clientX >= rect.right - RESIZE_HOTSPOT;
        const nearLeft = clientX <= rect.left + RESIZE_HOTSPOT;
        const [end, start] = this.host.isRtl ? [nearLeft, nearRight] : [nearRight, nearLeft];
        if (end) return 'end';
        return start ? 'start' : null;
    }

    private resizeTo(clientX: number): void {
        const state = this.resize;
        if (!state) return;
        const delta = (clientX - state.startX) * state.direction;
        state.before.style.width = `${Math.max(MIN_COLUMN_WIDTH, state.beforeWidth + delta)}px`;
        if (state.after) state.after.style.width = `${Math.max(MIN_COLUMN_WIDTH, state.afterWidth - delta)}px`;
        else state.table.style.width = `${state.tableWidth + delta}px`;
    }

    private finishResize(): void {
        this.endDrag();
        this.resizeArmed = false;
        this.host.contentRoot.style.cursor = '';
        this.host.commit({ focus: false });
    }

    /** One abort controller owns the document listeners of the running gesture. */
    private listenDrag(register: (signal: AbortSignal) => void): void {
        this.drag?.abort();
        const controller = new AbortController();
        this.drag = controller;
        register(controller.signal);
    }

    private endDrag(): void {
        this.drag?.abort();
        this.drag = null;
        this.resize = null;
    }

    // Context menu

    private onContextMenu(event: MouseEvent): void {
        if (this.inert) return;
        const target = event.target instanceof Element ? event.target : null;
        const table = target?.closest('table');
        const root = this.host.contentRoot;
        if (table && root.contains(table)) event.preventDefault();
        const cell = cellAt(target);
        this.closeMenu();
        if (!cell || !root.contains(cell)) return;
        event.stopPropagation();
        this.openMenu(cell, event.clientX, event.clientY);
    }

    /**
     * A second right-click while the menu is up lands on the menu itself, so the cell beneath it is found by
     * making the menu transparent to hit-testing for a moment: another cell of this editor moves the menu
     * there, anything else closes it.
     */
    private onMenuContextMenu(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();
        const menu = event.currentTarget;
        if (!(menu instanceof HTMLElement)) return;
        menu.style.pointerEvents = 'none';
        const cell = cellAt(this.host.doc.elementFromPoint(event.clientX, event.clientY));
        menu.style.pointerEvents = '';
        this.closeMenu();
        if (cell && this.host.contentRoot.contains(cell)) this.openMenu(cell, event.clientX, event.clientY);
    }

    private openMenu(cell: HTMLTableCellElement, x: number, y: number): void {
        this.target = cell;
        this.menu = { x, y };
        this.host.invalidate();
        void this.keepMenuInViewport();
        const close = (): void => this.closeMenu();
        // Registered after this event has finished so the opening gesture does not close the menu at once.
        this.menuClose.timeout(() => {
            const { doc } = this.host;
            this.menuClose.listen(doc, 'click', close);
            this.menuClose.listen(doc, 'contextmenu', close);
        }, 0);
    }

    private closeMenu(): void {
        this.menuClose.dispose();
        if (!this.menu) return;
        this.menu = null;
        this.host.invalidate();
    }

    private async keepMenuInViewport(): Promise<void> {
        if (this.host.element instanceof ReactiveElement) await this.host.element.updateComplete;
        const menu = this.host.overlayAnchor.querySelector<HTMLElement>('.table-menu');
        const position = this.menu;
        if (!menu || !position) return;
        const rect = menu.getBoundingClientRect();
        const { innerWidth, innerHeight } = this.host.doc.defaultView ?? globalThis;
        const x = rect.right > innerWidth ? innerWidth - rect.width - MENU_MARGIN : position.x;
        const y = rect.bottom > innerHeight ? innerHeight - rect.height - MENU_MARGIN : position.y;
        if (x === position.x && y === position.y) return;
        this.menu = { x, y };
        this.host.invalidate();
    }

    private run(action: (commands: TableCommands) => void): void {
        this.closeMenu();
        const commands = this.host.provider('tableCommands');
        if (commands) action(commands);
    }

    renderOverlay(): TemplateResult | null {
        const position = this.menu;
        if (!position) return null;
        const t = this.host.resolvedLocale.table;
        const item = (label: string, action: (commands: TableCommands) => void, danger = false) => html`
            <button type="button" class="item ${danger ? 'danger' : ''}" @click=${() => this.run(action)}>${label}</button>`;
        const separator = html`<div class="separator"></div>`;
        const canMerge = this.selected.length >= 2;
        const canSplit = this.host.provider('tableCommands')?.canSplitCell() ?? false;
        return html`
            <style>${unsafeCSS(css)}</style>
            <div
                class="table-menu"
                style=${styleMap({ left: `${position.x}px`, top: `${position.y}px` })}
                @mousedown=${(event: MouseEvent) => event.preventDefault()}
                @contextmenu=${(event: MouseEvent) => this.onMenuContextMenu(event)}
            >
                ${item(t.addRowAbove, (c) => c.addRowAbove())}
                ${item(t.addRowBelow, (c) => c.addRowBelow())}
                ${separator}
                ${item(t.addColumnLeft, (c) => c.addColumnLeft())}
                ${item(t.addColumnRight, (c) => c.addColumnRight())}
                ${separator}
                ${item(t.toggleHeaderRow, (c) => c.toggleHeaderRow())}
                ${separator}
                ${canMerge ? item(t.mergeCells, (c) => c.mergeCells()) : nothing}
                ${canSplit ? item(t.splitCell, (c) => c.splitCell()) : nothing}
                ${canMerge || canSplit ? separator : nothing}
                <div class="group">
                    <div class="group-label">${t.borders}</div>
                    <div class="row">
                        ${BORDER_ICONS.map(({ style, label, icon }) => html`
                            <button type="button" class="tool" title=${t[label]} @click=${() => this.run((c) => c.setBorders(style))}>${icon}</button>`)}
                    </div>
                </div>
                ${separator}
                <div class="group">
                    <div class="group-label">${t.cellAlignLeft}</div>
                    <div class="row" dir="ltr">
                        ${ALIGN_ICONS.map(({ alignment, label, lines }) => html`
                            <button type="button" class="tool" title=${t[label]} @click=${() => this.run((c) => c.setCellAlignment(alignment))}>${alignIcon(lines)}</button>`)}
                    </div>
                </div>
                <div class="group">
                    <div class="group-label">${t.cellColor}</div>
                    <div class="swatches">
                        ${CELL_COLORS.map((color) => html`
                            <button type="button" class="swatch" style=${styleMap({ backgroundColor: color })} aria-label=${color} @click=${() => this.run((c) => c.setCellColor(color))}></button>`)}
                    </div>
                </div>
                ${separator}
                ${item(t.deleteRow, (c) => c.deleteRow(), true)}
                ${item(t.deleteColumn, (c) => c.deleteColumn(), true)}
                ${item(t.deleteTable, (c) => c.deleteTable(), true)}
            </div>`;
    }
}
