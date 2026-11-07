import { html, nothing, render, svg, unsafeCSS, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { UiElement } from '@gilav21/elements-base';
import { defaultTrue } from '../shared/chart/chart-base.js';
import { onContextGesture, onPointerDrag, pointOf } from '../shared/touch.js';
import type { GeContextMenu } from '../context-menu/context-menu.js';
import {
    asLength,
    boundingBox,
    flipForRtl,
    isConnected,
    isOverlapping,
    resizeRect,
    resolveOverlaps,
    toPixels,
    type DashboardItem,
    type Rect,
    type ResizeDirection,
    type ResizeStart,
} from './bento-grid.layout.js';
import css from './bento-grid.css?inline';

export type BentoRenderItem = (item: DashboardItem) => unknown;
export type ResizeHandleType = 'corners' | 'edges' | 'both';
export interface BentoExternalDrop {
    widgetId: string;
    targetId: string | null;
    x?: number;
    y?: number;
}

/** What the menu was opened on: a widget, or an empty cell. */
type MenuData = DashboardItem | { type: 'empty'; x: number; y: number };

interface ResizeState extends ResizeStart {
    id: string;
    direction: ResizeDirection;
    startX: number;
    startY: number;
}

const ICON = (body: SVGTemplateResult) =>
    html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const newId = (): string => globalThis.crypto?.randomUUID?.() ?? `bento-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * A dashboard grid you can edit: drag widgets to new cells, resize them from their edges and corners, select several and
 * merge them, split one in two, and add or delete from a context menu (right-click, the context-menu key or a long press).
 * The grid never changes `items` itself: every edit is announced as `items-change` with the complete next layout, and you
 * store it and set it back. Neighbours a moved or resized widget lands on are shrunk away, or dropped when nothing is left.
 *
 * A widget shows `renderItem(item)` (a Lit template, a node or text), or its `content` as text. The content is rendered into
 * the element's light DOM, so your own styles reach it. Static cards (`ge-bento-grid-item`) can be placed inside as well.
 *
 * @fires items-change - `detail` is the next `DashboardItem[]` after a drag, resize, merge, split, delete or add.
 * @fires selection-change - `detail` is the selected ids.
 * @fires external-drop - A widget dragged in from outside (`application/json` data `{ type: 'widget', id }`) was dropped. `detail` is `{ widgetId, targetId, x?, y? }`: `targetId` for a drop on a widget, `x` and `y` for a drop on empty canvas. Add the widget to `items` yourself.
 * @attr {number} cols - Tracks in the grid (default 12). Also the divisor turning pointer positions into cells.
 * @attr {string} row-height - Height of one row, `grid-auto-rows` (default `120px`); a bare number is pixels.
 * @attr {string} column-width - Width of one column (default `1fr`, a fluid `minmax(0, 1fr)` track); a bare number is pixels.
 * @attr {string} gap - Gutter between cells (default `1.5rem`); counted into the drag and resize snap step.
 * @attr {boolean} show-borders - Outline and shadow on each widget (default true; `show-borders="false"` turns it off).
 * @attr {string} border-radius - Corner radius of each widget (default `0.75rem`).
 * @attr {string} item-padding - Inner padding of each widget (default `1rem`).
 * @attr {boolean} editable - Drag, resize, selection, menus and drops (default true; `editable="false"` turns them all off and clears the selection).
 * @attr {'corners' | 'edges' | 'both'} resize-handle-type - Which grips an editable widget shows (default `both`).
 * @prop {DashboardItem[]} items - The widgets.
 * @prop {(item) => unknown} renderItem - Content of one widget.
 * @slot - Static `ge-bento-grid-item` cards.
 */
export class GeBentoGrid extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        items: { attribute: false },
        renderItem: { attribute: false },
        cols: { type: Number },
        rowHeight: { attribute: 'row-height' },
        columnWidth: { attribute: 'column-width' },
        gap: {},
        showBorders: { attribute: 'show-borders', converter: defaultTrue, reflect: true },
        borderRadius: { attribute: 'border-radius' },
        itemPadding: { attribute: 'item-padding' },
        editable: { converter: defaultTrue, reflect: true },
        resizeHandleType: { attribute: 'resize-handle-type' },
        draggedId: { state: true },
        selectedIds: { state: true },
        dropPreview: { state: true },
        resizePreview: { state: true },
        menuData: { state: true },
    };

    declare items: DashboardItem[];
    declare renderItem: BentoRenderItem | null;
    declare cols: number;
    declare rowHeight: string | number;
    declare columnWidth: string | number;
    declare gap: string | number;
    declare showBorders: boolean;
    declare borderRadius: string | number;
    declare itemPadding: string | number;
    declare editable: boolean;
    declare resizeHandleType: ResizeHandleType;
    declare protected draggedId: string | null;
    declare protected selectedIds: string[];
    declare protected dropPreview: Rect | null;
    declare protected resizePreview: (Rect & { id: string }) | null;
    declare protected menuData: MenuData | null;

    private dragOffset: { x: number; y: number } | null = null;
    private resizeState: ResizeState | null = null;
    private resizeCleanup: (() => void) | null = null;
    private touchDragCleanup: (() => void) | null = null;
    private gestureCleanup: (() => void) | null = null;
    // Slots only take direct children, so the widgets render straight into the host, before this marker.
    private readonly contentEnd = document.createComment('');

    constructor() {
        super();
        this.items = [];
        this.renderItem = null;
        this.cols = 12;
        this.rowHeight = '120px';
        this.columnWidth = '1fr';
        this.gap = '1.5rem';
        this.showBorders = true;
        this.borderRadius = '0.75rem';
        this.itemPadding = '1rem';
        this.editable = true;
        this.resizeHandleType = 'both';
        this.draggedId = null;
        this.selectedIds = [];
        this.dropPreview = null;
        this.resizePreview = null;
        this.menuData = null;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'bento-grid';
        this.append(this.contentEnd);
        if (this.hasUpdated) this.listenForGestures();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.gestureCleanup?.();
        this.gestureCleanup = null;
        this.resizeCleanup?.();
        this.resizeCleanup = null;
        this.touchDragCleanup?.();
        this.touchDragCleanup = null;
        this.contentEnd.remove();
    }

    protected override firstUpdated(): void {
        this.listenForGestures();
    }

    private get grid(): HTMLElement | null {
        return this.renderRoot.querySelector<HTMLElement>('.grid');
    }

    private get menu(): GeContextMenu | null {
        return this.renderRoot.querySelector<GeContextMenu>('ge-context-menu');
    }

    private get rtl(): boolean {
        return getComputedStyle(this).direction === 'rtl';
    }

    private listenForGestures(): void {
        const grid = this.grid;
        if (!grid || this.gestureCleanup) return;
        this.gestureCleanup = onContextGesture(grid, (gesture) => this.onContextGesture(gesture.clientX, gesture.clientY, gesture.path));
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('editable') && !this.editable) this.clearNonEmptySelection();
    }

    protected override updated(): void {
        const items = this.items;
        const template = repeat(
            items,
            (item) => item.id,
            (item) => html`<div slot=${`item-${item.id}`} style="display:contents">${this.renderItem ? this.renderItem(item) : html`<p style="margin:0">${item.content}</p>`}</div>`,
        );
        render(template, this, { host: this, renderBefore: this.contentEnd });
    }

    // ---- geometry -----------------------------------------------------------------------------------------

    private px(value: string | number, reference: number): number {
        const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const own = Number.parseFloat(getComputedStyle(this).fontSize) || 16;
        return toPixels(asLength(value), reference, own, root);
    }

    private columnPixels(width: number): number {
        const gap = this.px(this.gap, width);
        if (asLength(this.columnWidth) === '1fr') return (width - (this.cols - 1) * gap) / this.cols;
        return this.px(this.columnWidth, width);
    }

    /** The 1-based cell under a viewport point, optionally shifted by where inside the widget it was grabbed. */
    private cellAt(clientX: number, clientY: number, grid: HTMLElement, offset: { x: number; y: number } | null = this.dragOffset): { x: number; y: number } {
        const rect = grid.getBoundingClientRect();
        const pointX = clientX - (offset?.x ?? 0);
        const pointY = clientY - (offset?.y ?? 0);
        const x = this.rtl ? rect.right - pointX : pointX - rect.left;
        const y = pointY - rect.top;
        const gap = this.px(this.gap, rect.width);
        const rowStep = this.px(this.rowHeight, rect.height) + gap;
        return { x: Math.max(1, Math.floor(x / (this.columnPixels(rect.width) + gap)) + 1), y: Math.max(1, Math.floor(y / rowStep) + 1) };
    }

    // ---- selection ----------------------------------------------------------------------------------------

    /** Adds or removes a widget from the selection. `multi` appends; otherwise the id replaces the selection. Clicking a selected id deselects it. No-op while not editable. */
    toggleSelection(id: string, multi = true): void {
        if (!this.editable) return;
        if (this.selectedIds.includes(id)) this.selectedIds = this.selectedIds.filter((other) => other !== id);
        else this.selectedIds = multi ? [...this.selectedIds, id] : [id];
        this.emit('selection-change', this.selectedIds);
    }

    /** Drops the whole selection and announces it. Runs even while not editable. */
    clearSelection(): void {
        this.selectedIds = [];
        this.emit('selection-change', []);
    }

    private clearNonEmptySelection(): void {
        if (this.selectedIds.length > 0) this.clearSelection();
    }

    /** Whether the widget is in the selection. */
    isSelected(id: string): boolean {
        return this.selectedIds.includes(id);
    }

    private get selectedItems(): DashboardItem[] {
        return this.items.filter((item) => this.selectedIds.includes(item.id));
    }

    private get canMerge(): boolean {
        const picked = this.selectedItems;
        return this.selectedIds.length >= 2 && picked.length === this.selectedIds.length && isConnected(picked);
    }

    /** Replaces the selected widgets with one covering their bounding box, keeping the top-left member's id and content. Needs an edge-connected selection; otherwise nothing happens. */
    mergeSelected(): void {
        if (!this.canMerge) return;
        const picked = [...this.selectedItems].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
        const primary = picked[0] as DashboardItem;
        const merged: DashboardItem = { ...primary, ...boundingBox(picked) };
        this.emit('items-change', [...this.items.filter((item) => !this.selectedIds.includes(item.id)), merged]);
        this.clearSelection();
    }

    // ---- item edits ---------------------------------------------------------------------------------------

    /** Announces the layout without the widget, leaving a hole. */
    deleteItem(id: string | undefined): void {
        if (id) this.emit('items-change', this.items.filter((item) => item.id !== id));
    }

    /**
     * Halves a widget. `'vertical'` splits the columns (side by side), `'horizontal'` the rows (stacked). The first half keeps
     * the id and content; the second gets a new id and the content `New Item`. Nothing happens when it is one cell across.
     */
    splitItem(id: string | undefined, direction: 'vertical' | 'horizontal'): void {
        const item = id ? this.items.find((other) => other.id === id) : undefined;
        if (!item) return;
        const vertical = direction === 'vertical';
        const span = vertical ? item.cols : item.rows;
        if (span < 2) return;
        const first = Math.floor(span / 2);
        const second = span - first;
        const added: DashboardItem = vertical
            ? { ...item, id: newId(), x: item.x + first, cols: second, content: 'New Item' }
            : { ...item, id: newId(), y: item.y + first, rows: second, content: 'New Item' };
        const kept = vertical ? { ...item, cols: first } : { ...item, rows: first };
        this.emit('items-change', [...this.items.filter((other) => other.id !== id), kept, added]);
    }

    /** Appends a `New Item` widget at a 1-based cell. Nothing happens when it would overlap an existing widget. */
    addItemAt(x: number, y: number, cols = 1, rows = 1): void {
        const added: DashboardItem = { id: newId(), x, y, cols, rows, content: 'New Item' };
        if (this.items.some((item) => isOverlapping(added, item))) return;
        this.emit('items-change', [...this.items, added]);
    }

    // ---- menus --------------------------------------------------------------------------------------------

    private onContextGesture(clientX: number, clientY: number, path: readonly EventTarget[]): boolean {
        const menu = this.menu;
        if (!this.editable || !menu) return false;
        if (path.some((node) => node instanceof Element && node.localName === 'ge-context-menu-content')) return false;
        const card = path.find((node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains('bento-item'));
        const item = card ? this.items.find((other) => other.id === card.dataset.itemId) : undefined;
        if (item) {
            this.openMenu(clientX, clientY, item);
            return true;
        }
        if (card) return false;
        return this.showEmptyCellMenu(clientX, clientY);
    }

    private openMenu(clientX: number, clientY: number, data: MenuData): void {
        this.menuData = data;
        this.menu?.show(clientX, clientY, data);
    }

    private showEmptyCellMenu(clientX: number, clientY: number): boolean {
        const grid = this.grid;
        if (!grid) return false;
        const rect = grid.getBoundingClientRect();
        const gap = this.px(this.gap, rect.width);
        const x = Math.floor((clientX - rect.left) / (this.columnPixels(rect.width) + gap)) + 1;
        const y = Math.floor((clientY - rect.top) / (this.px(this.rowHeight, rect.height) + gap)) + 1;
        if (this.items.some((item) => isOverlapping({ x, y, cols: 1, rows: 1 }, item))) return false;
        this.openMenu(clientX, clientY, { type: 'empty', x, y });
        return true;
    }

    private readonly onOptionsClick = (event: MouseEvent, item: DashboardItem): void => {
        if (!this.editable) return;
        event.preventDefault();
        event.stopPropagation();
        this.openMenu(event.clientX, event.clientY, item);
    };

    // ---- drag and drop (mouse) ----------------------------------------------------------------------------

    private readonly onDragStart = (event: DragEvent, item: DashboardItem): void => {
        if (!this.editable) return;
        const card = (event.target as HTMLElement).closest<HTMLElement>('.bento-item');
        const rect = card?.getBoundingClientRect();
        this.dragOffset = { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
        this.draggedId = item.id;
        if (!event.dataTransfer) return;
        event.dataTransfer.effectAllowed = 'move';
        // Firefox starts no drag without data.
        event.dataTransfer.setData('text/plain', item.id);
    };

    private readonly onDragEnd = (): void => {
        this.draggedId = null;
        this.dropPreview = null;
        this.dragOffset = null;
    };

    private readonly onItemDragOver = (event: DragEvent): void => {
        if (!this.editable) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    };

    private readonly onGridDragOver = (event: DragEvent): void => {
        if (!this.editable) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = event.dataTransfer.types.includes('application/json') ? 'copy' : 'move';
        const item = this.draggedId ? this.items.find((other) => other.id === this.draggedId) : undefined;
        const grid = this.grid;
        if (!item || !grid) return;
        const { x, y } = this.cellAt(event.clientX, event.clientY, grid);
        this.dropPreview = { x, y, cols: item.cols, rows: item.rows };
    };

    private readonly onItemDrop = (event: DragEvent, target: DashboardItem): void => {
        if (!this.editable) return;
        event.preventDefault();
        event.stopPropagation();
        if (this.draggedId) {
            this.commitMove(this.draggedId, this.dropPreview);
            return;
        }
        const dropped = this.externalPayload(event);
        if (dropped) this.emit('external-drop', { widgetId: dropped, targetId: target.id } satisfies BentoExternalDrop);
    };

    private readonly onGridDrop = (event: DragEvent): void => {
        if (!this.editable) return;
        event.preventDefault();
        this.dropPreview = null;
        const grid = this.grid;
        if (!grid) return;
        if (this.draggedId) {
            const item = this.items.find((other) => other.id === this.draggedId);
            if (item) {
                const { x, y } = this.cellAt(event.clientX, event.clientY, grid);
                this.commitMove(item.id, { x, y, cols: item.cols, rows: item.rows });
            }
            this.draggedId = null;
            return;
        }
        const dropped = this.externalPayload(event);
        if (!dropped) return;
        const { x, y } = this.cellAt(event.clientX, event.clientY, grid, null);
        this.emit('external-drop', { widgetId: dropped, targetId: null, x, y } satisfies BentoExternalDrop);
    };

    private externalPayload(event: DragEvent): string | null {
        const data = event.dataTransfer?.getData('application/json');
        if (!data) return null;
        try {
            const parsed = JSON.parse(data) as { type?: string; id?: string };
            return parsed.type === 'widget' && parsed.id ? parsed.id : null;
        } catch {
            // A drag from some other source carries JSON this grid cannot read.
            return null;
        }
    }

    /** Moves a widget to `preview` and announces the layout with the neighbours it landed on shrunk away. */
    private commitMove(id: string, preview: Rect | null): void {
        if (preview) {
            const moved = this.items.find((item) => item.id === id);
            if (moved) {
                const next: DashboardItem = { ...moved, x: preview.x, y: preview.y };
                this.emit('items-change', resolveOverlaps(this.items.map((item) => (item.id === id ? next : item)), next));
            }
        }
        this.draggedId = null;
        this.dropPreview = null;
    }

    // ---- drag (touch) -------------------------------------------------------------------------------------

    private readonly onTouchStart = (event: TouchEvent, item: DashboardItem): void => {
        if (!this.editable || this.resizeState) return;
        const touch = event.touches[0];
        const card = (event.target as HTMLElement).closest<HTMLElement>('.bento-item');
        if (!touch || !card) return;
        const rect = card.getBoundingClientRect();
        this.dragOffset = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
        this.draggedId = item.id;
        this.touchDragCleanup?.();
        this.touchDragCleanup = onPointerDrag(
            (clientX, clientY) => {
                const grid = this.grid;
                if (!grid) return;
                const { x, y } = this.cellAt(clientX, clientY, grid);
                this.dropPreview = { x, y, cols: item.cols, rows: item.rows };
            },
            () => {
                if (this.draggedId) this.commitMove(this.draggedId, this.dropPreview);
                this.dragOffset = null;
                this.touchDragCleanup = null;
            },
        );
    };

    // ---- resize -------------------------------------------------------------------------------------------

    private readonly onResizeStart = (event: MouseEvent | TouchEvent, item: DashboardItem, direction: ResizeDirection): void => {
        if (!this.editable) return;
        event.preventDefault();
        event.stopPropagation();
        const grid = this.grid;
        if (!grid) return;
        const start = pointOf(event);
        const rect = grid.getBoundingClientRect();
        const gap = this.px(this.gap, rect.width);
        this.resizeState = {
            id: item.id,
            direction,
            startX: start.x,
            startY: start.y,
            x: item.x,
            y: item.y,
            cols: item.cols,
            rows: item.rows,
            colStep: this.columnPixels(rect.width) + gap,
            rowStep: this.px(this.rowHeight, rect.height) + gap,
        };
        this.resizePreview = { id: item.id, x: item.x, y: item.y, cols: item.cols, rows: item.rows };
        this.resizeCleanup?.();
        this.resizeCleanup = onPointerDrag(
            (clientX, clientY) => this.onResizeMove(clientX, clientY),
            () => this.onResizeEnd(),
        );
    };

    private onResizeMove(clientX: number, clientY: number): void {
        const state = this.resizeState;
        if (!state) return;
        const rtl = this.rtl;
        const deltaX = (clientX - state.startX) * (rtl ? -1 : 1);
        const rect = resizeRect(rtl ? flipForRtl(state.direction) : state.direction, deltaX, clientY - state.startY, state);
        const old = this.resizePreview;
        if (old?.cols === rect.cols && old.rows === rect.rows && old.x === rect.x && old.y === rect.y) return;
        this.resizePreview = { id: state.id, ...rect };
    }

    private onResizeEnd(): void {
        const state = this.resizeState;
        const preview = this.resizePreview;
        const item = state ? this.items.find((other) => other.id === state.id) : undefined;
        if (item && preview) {
            const next: DashboardItem = { ...item, x: preview.x, y: preview.y, cols: preview.cols, rows: preview.rows };
            this.emit('items-change', resolveOverlaps(this.items.map((other) => (other.id === item.id ? next : other)), next));
        }
        this.resizeState = null;
        this.resizePreview = null;
        this.resizeCleanup = null;
    }

    // ---- rendering ----------------------------------------------------------------------------------------

    private emit(name: string, detail: unknown): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    private placement(item: DashboardItem): Rect {
        if (this.resizePreview?.id === item.id) return this.resizePreview;
        if (this.draggedId === item.id && this.dropPreview) return this.dropPreview;
        return item;
    }

    private grips(item: DashboardItem): TemplateResult {
        const type = this.resizeHandleType;
        const grip = (direction: ResizeDirection, content: unknown = nothing) =>
            html`<div class="grip ${direction.length === 1 ? 'edge' : 'corner'}" data-direction=${direction} @mousedown=${(e: MouseEvent) => this.onResizeStart(e, item, direction)} @touchstart=${(e: TouchEvent) => this.onResizeStart(e, item, direction)}>${content}</div>`;
        const edges = type === 'edges' || type === 'both';
        const corners = type === 'corners' || type === 'both';
        return html`
            <div class="options"><button type="button" aria-label="Item options" @click=${(e: MouseEvent) => this.onOptionsClick(e, item)}>${ICON(svg`<circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />`)}</button></div>
            ${edges ? html`${grip('n')}${grip('s')}${grip('w')}${grip('e')}` : nothing}
            ${corners
                ? html`${grip('se', html`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v6h-6" /><path d="M21 3v6h-6" /><path d="M3 21h6v-6" /><path d="M10 14L3 21" /><path d="M14 10l7-7" /></svg>`)}${grip('sw', html`<div class="dot"></div>`)}${grip('ne', html`<div class="dot"></div>`)}${grip('nw', html`<div class="dot"></div>`)}`
                : nothing}`;
    }

    private card(item: DashboardItem): TemplateResult {
        const place = this.placement(item);
        const resizing = this.resizePreview?.id === item.id;
        const dragging = this.draggedId === item.id;
        const states = [
            this.editable || this.showBorders ? 'bordered' : '',
            this.showBorders ? 'shadowed' : '',
            this.editable ? 'editable' : '',
            this.isSelected(item.id) || resizing ? 'ringed' : '',
            dragging ? 'dragging' : '',
            resizing || (dragging && this.dropPreview) ? 'lifted' : '',
        ].filter(Boolean).join(' ');
        const style = `grid-column-start:${place.x};grid-column-end:span ${place.cols};grid-row-start:${place.y};grid-row-end:span ${place.rows};border-radius:${asLength(this.borderRadius)};padding:${asLength(this.itemPadding)}`;
        return html`<div
            class="bento-item ${states}"
            part="item"
            data-item-id=${item.id}
            style=${style}
            draggable=${String(this.editable)}
            tabindex="0"
            @click=${(e: MouseEvent) => this.toggleSelection(item.id, e.ctrlKey || e.metaKey)}
            @keydown=${(e: KeyboardEvent) => this.onItemKeydown(e, item)}
            @dragstart=${(e: DragEvent) => this.onDragStart(e, item)}
            @dragend=${this.onDragEnd}
            @dragover=${this.onItemDragOver}
            @drop=${(e: DragEvent) => this.onItemDrop(e, item)}
            @touchstart=${(e: TouchEvent) => this.onTouchStart(e, item)}
        >
            <slot name=${`item-${item.id}`}></slot>
            ${this.editable ? this.grips(item) : nothing}
        </div>`;
    }

    private onItemKeydown(event: KeyboardEvent, item: DashboardItem): void {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.toggleSelection(item.id, false);
        }
    }

    private menuContent(): TemplateResult {
        const data = this.menuData;
        const row = (icon: unknown, label: string, action: () => void, variant = 'default') =>
            html`<ge-context-menu-item variant=${variant} @click=${action}><span class="menu-row">${icon}${label}</span></ge-context-menu-item>`;
        if (data && 'type' in data) {
            const { x, y } = data;
            return html`
                ${row(ICON(svg`<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M8 12h8" /><path d="M12 8v8" />`), 'Add 1x1 Item', () => this.addItemAt(x, y, 1, 1))}
                ${row(ICON(svg`<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 12h18" /><path d="M12 3v18" />`), 'Add 4x2 Item', () => this.addItemAt(x, y, 4, 2))}`;
        }
        const id = data?.id;
        return html`
            ${row(ICON(svg`<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M12 3v18" />`), 'Split Vertical', () => this.splitItem(id, 'vertical'))}
            ${row(ICON(svg`<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 12h18" />`), 'Split Horizontal', () => this.splitItem(id, 'horizontal'))}
            ${row(ICON(svg`<path d="M3 6h18" /><path d="M19 6v14c0 1-2 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />`), 'Delete', () => this.deleteItem(id), 'destructive')}`;
    }

    protected override render() {
        const gap = asLength(this.gap);
        const rowHeight = asLength(this.rowHeight);
        const columnWidth = asLength(this.columnWidth);
        const fluid = columnWidth === '1fr';
        const track = fluid ? 'minmax(0, 1fr)' : columnWidth;
        const colSize = fluid ? `calc((100% + ${gap}) / ${this.cols})` : `calc(${columnWidth} + ${gap})`;
        const gridStyle = `grid-template-columns:repeat(${this.cols}, ${track});grid-auto-rows:${rowHeight};grid-auto-columns:${fluid ? 'auto' : columnWidth};gap:${gap}`;
        const preview = this.dropPreview;
        return html`<div class="grid" part="grid" style=${gridStyle} @dragover=${this.onGridDragOver} @drop=${this.onGridDrop}>
            ${this.editable ? html`<div class="pattern" style="background-image:radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0);background-size:${colSize} calc(${rowHeight} + ${gap})"></div>` : nothing}
            <ge-context-menu><ge-context-menu-content>${this.menuContent()}</ge-context-menu-content></ge-context-menu>
            <slot></slot>
            ${preview
                ? html`<div class="placeholder" style="grid-column-start:${preview.x};grid-column-end:span ${preview.cols};grid-row-start:${preview.y};grid-row-end:span ${preview.rows}"><div class="size">${preview.cols}x${preview.rows}</div></div>`
                : nothing}
            ${repeat(this.items, (item) => item.id, (item) => this.card(item))}
            ${this.editable && this.canMerge
                ? html`<button type="button" class="merge" @click=${() => this.mergeSelected()}>${ICON(svg`<path d="m8 6 4-4 4 4" /><path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22" /><path d="m20 22-5-5" />`)}<span>Merge ${this.selectedIds.length} Items</span></button>`
                : nothing}
        </div>`;
    }
}
