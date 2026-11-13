import { startAutoScroll, type AutoScrollController } from '../shared/auto-scroll.js';
import { VALUE_CONTROLS_SELECTOR } from '../shared/interactive-tags.js';
import { onLongPress, onPointerDrag } from '../shared/touch.js';
import { baseColumnOrder, dropSide, moveByOffset, moveColumnKey, type DropSide } from './data-table-column-order.js';
import { columnCells, HEAD_SELECTOR as HEAD, pinGroupOf } from './data-table-columns.js';
import { type DataTableCoreHost, isTextFieldKey, ownClosest, ownEvents, ownsTarget, requireProvider } from './data-table-host.js';
import { KEY_PRIORITY } from './data-table-registry.js';
import { interpolate } from './data-table.locales.js';

/** A header is a drag only after the pointer moved this far, so a click on its sort button stays a click. */
const DRAG_THRESHOLD = 4;
const DRAGGABLE_HEAD = `${HEAD}[data-draggable]`;
/** Things inside a header that keep their own press: the VALUE controls (never a button or a link: a click on a sort button stays a click and the header stays draggable from it), the resize handle and the header actions. */
const OWN_PRESS = `${VALUE_CONTROLS_SELECTOR}, [data-slot="data-table-resize-handle"], [data-slot="data-table-header-action"]`;

interface Drag {
    readonly key: string;
    /** The keys that may trade places with it: visible, reorderable and in the same pin group. */
    readonly group: readonly string[];
    readonly scroller: AutoScrollController;
    readonly stopScroll: () => void;
    target: { key: string; side: DropSide } | null;
    x: number;
}

/**
 * Column reorder: a pointer drag on a header (a long press first on touch, so the header still scrolls), and
 * Alt+Shift+Left / Right from the keyboard. A column only moves inside its pin group, since the layout draws pinned
 * columns apart from the rest. The drop writes `columnOrder` once.
 */
export class ColumnDragController<T> {
    private pending: { key: string; x: number; y: number; pointerId: number } | null = null;
    private drag: Drag | null = null;
    private indicator: HTMLElement | null = null;
    private stops: (() => void)[] = [];
    private readonly teardown: (() => void)[] = [];

    constructor(private readonly host: DataTableCoreHost<T>) {}

    private columns() {
        return requireProvider(this.host, 'columns');
    }

    private headOf(key: string): HTMLElement | null {
        return this.host.root.querySelector<HTMLElement>(`${HEAD}[data-column-id="${CSS.escape(key)}"]`);
    }

    private isRtl(): boolean {
        return this.host.root.ownerDocument.defaultView?.getComputedStyle(this.host.root).direction === 'rtl';
    }

    /** The keys that may trade places with `key`; null when it cannot move. */
    private groupOf(key: string): string[] | null {
        return this.host.config.enableColumnReorder ? pinGroupOf(this.columns().enhancedColumns(), key) : null;
    }

    private baseOrder(): string[] {
        return baseColumnOrder(this.host.config.columns, this.host.model.get('columnOrder'));
    }

    private announceMove(key: string, next: readonly string[], group: readonly string[]): void {
        const inGroup = next.filter((k) => group.includes(k));
        const column = this.host.config.columns.find((c) => String(c.accessorKey) === key)?.header ?? key;
        this.host.announce(interpolate(this.host.resolvedLocale.columnMovedAnnouncement, { column, position: inGroup.indexOf(key) + 1, total: inGroup.length }));
    }

    // ---- pointer ----------------------------------------------------------------------------------------------

/**
     * The draggable header of THIS table that a press path starts in, or null when the press is a VALUE control's own. The path is walked from the deepest node up
     * to that header (a consumer header component's OPEN shadow root included; a closed root stops at its host, where the tag list applies) and never above it: an
     * editable wrapper around the table is no control of the header. ONE rule for the mouse press and the touch long press.
     */
    private pressedHead(path: readonly EventTarget[]): HTMLElement | null {
        const head = path.find((node): node is HTMLElement => node instanceof HTMLElement && node.matches(DRAGGABLE_HEAD) && ownsTarget(this.host.root, node));
        if (!head) return null;
        for (const node of path) {
            if (node === head) return head;
            if (node instanceof Element && node.matches(OWN_PRESS)) return null;
        }
        return head;
    }

    private readonly onDown = (event: PointerEvent): void => {
        // Touch waits for a long press (below); a second pointer never starts a drag.
        if (event.pointerType === 'touch' || event.button !== 0 || this.pending || this.drag) return;
        const head = this.pressedHead(event.composedPath());
        const key = head?.dataset['columnId'];
        if (key === undefined || !this.groupOf(key)) return;
        this.pending = { key, x: event.clientX, y: event.clientY, pointerId: event.pointerId };
        const view = this.host.root.ownerDocument.defaultView ?? window;
        this.stops = [
            this.host.disposables.listen<PointerEvent>(view, 'pointermove', this.onMove),
            this.host.disposables.listen<PointerEvent>(view, 'pointerup', this.onUp),
            this.host.disposables.listen(view, 'pointercancel', this.cancel),
            this.host.disposables.listen<KeyboardEvent>(this.host.root.ownerDocument, 'keydown', (e) => e.key === 'Escape' && this.cancel()),
        ];
    };

    private readonly onMove = (event: PointerEvent): void => {
        const { pending } = this;
        if (!pending || event.pointerId !== pending.pointerId) return;
        if (!this.drag && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) >= DRAG_THRESHOLD) this.begin(pending.key);
        if (this.drag) this.update(event.clientX, event.clientY);
    };

    private readonly onUp = (event: PointerEvent): void => {
        if (!this.pending || event.pointerId !== this.pending.pointerId) return;
        const dragged = this.drag !== null;
        this.finish(true);
        if (dragged) this.swallowClick();
    };

    private readonly cancel = (): void => this.finish(false);

    /** The click that ends a drag lands on the header and would sort it: take it once. */
    private swallowClick(): void {
        const { root } = this.host;
        const swallow = (event: Event): void => {
            event.stopPropagation();
            event.preventDefault();
            off();
        };
        const timer = setTimeout(() => off(), 0);
        const off = (): void => {
            clearTimeout(timer);
            root.removeEventListener('click', swallow, true);
        };
        root.addEventListener('click', swallow, true);
    }

    // ---- the drag, whatever started it ------------------------------------------------------------------------

    private begin(key: string): void {
        const group = this.groupOf(key);
        const viewport = this.host.root.querySelector<HTMLElement>('[data-slot="data-table-viewport"]');
        if (!group) return;
        for (const cell of columnCells(this.host.root, key)) cell.toggleAttribute('data-dragging', true);
        viewport?.toggleAttribute('data-table-dragging', true);
        // The viewport scrolls under a held pointer: the header it is over changes without a pointer event.
        const stopScroll = viewport ? this.host.disposables.listen(viewport, 'scroll', () => this.drag && this.refresh(this.drag)) : () => undefined;
        this.drag = { key, group, scroller: startAutoScroll({ edge: 40, maxSpeed: 12, win: this.host.root.ownerDocument.defaultView ?? window }), stopScroll, target: null, x: 0 };
    }

    private update(clientX: number, clientY: number): void {
        const { drag } = this;
        if (!drag) return;
        drag.x = clientX;
        drag.scroller.update(clientX, clientY);
        this.refresh(drag);
    }

    /** The header under the pointer, if it is in the group, and which edge of it the drop would land on. */
    private refresh(drag: Drag): void {
        const rtl = this.isRtl();
        let target: Drag['target'] = null;
        for (const key of drag.group) {
            const rect = key === drag.key ? null : this.headOf(key)?.getBoundingClientRect();
            if (rect && drag.x >= rect.left && drag.x < rect.right) target = { key, side: dropSide(drag.x, rect, rtl) };
        }
        if (target?.key === drag.target?.key && target?.side === drag.target?.side) return;
        drag.target = target;
        this.indicator?.remove();
        this.indicator = null;
        const head = target ? this.headOf(target.key) : null;
        if (!head || !target) return;
        const indicator = head.ownerDocument.createElement('div');
        indicator.setAttribute('data-slot', 'data-table-drop-indicator');
        indicator.setAttribute('data-edge', target.side === 'before' ? 'start' : 'end');
        indicator.setAttribute('aria-hidden', 'true');
        head.append(indicator);
        this.indicator = indicator;
    }

    private finish(drop: boolean): void {
        const { drag } = this;
        this.pending = null;
        this.drag = null;
        for (const stop of this.stops.splice(0)) stop();
        this.indicator?.remove();
        this.indicator = null;
        if (!drag) return;
        drag.scroller.stop();
        drag.stopScroll();
        for (const cell of columnCells(this.host.root, drag.key)) cell.toggleAttribute('data-dragging', false);
        this.host.root.querySelector('[data-slot="data-table-viewport"]')?.toggleAttribute('data-table-dragging', false);
        if (!drop || !drag.target) return;
        const next = moveColumnKey(this.baseOrder(), drag.group, drag.key, drag.target.key, drag.target.side);
        if (!next) return;
        this.host.model.set('columnOrder', next);
        this.announceMove(drag.key, next, drag.group);
    }

    // ---- touch: a long press picks the header up ----------------------------------------------------------------

    private readonly onLongPress = (event: TouchEvent, path: readonly EventTarget[]): void => {
        const head = this.pressedHead(path);
        const key = head?.getAttribute('data-column-id');
        const touch = event.touches[0];
        if (!head || key == null || !touch || this.drag || !this.groupOf(key)) return;
        this.begin(key);
        this.update(touch.clientX, touch.clientY);
        // Non-passive `touchmove` on the window: once the header is picked up the finger moves the column, not the page.
        onPointerDrag(
            (x, y, e) => {
                if (e.cancelable) e.preventDefault();
                this.update(x, y);
            },
            (e) => this.finish(e.type !== 'touchcancel'),
        );
    };

    // ---- keyboard ---------------------------------------------------------------------------------------------

    private handleKey(event: KeyboardEvent): boolean {
        if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return false;
        const target = event.target as Element;
        // wave5: a key typed in a text field (Alt+Shift+Arrow selects text by word) or inside a widget that owns its keys (the header filter panel,
        // `data-table-keeps-focus`) is that field's own, never a column move.
        if (isTextFieldKey(this.host.root, event, { keepsFocus: true })) return false;
        const head = ownClosest<HTMLElement>(this.host.root, target, DRAGGABLE_HEAD);
        const key = head?.dataset['columnId'];
        const group = key === undefined ? null : this.groupOf(key);
        if (!head || key === undefined || !group) return false;
        const next = moveByOffset(this.baseOrder(), group, key, (event.key === 'ArrowRight') !== this.isRtl() ? 1 : -1);
        if (!next) return false;
        event.preventDefault();
        const onHandle = ownClosest(this.host.root, target, '[data-slot="data-table-resize-handle"]') !== null;
        this.host.model.set('columnOrder', next);
        this.announceMove(key, next, group);
        // The head nodes are keyed by column, so they moved; a moved node loses focus. Put it back on the same control.
        this.host.afterRender(() => {
            const moved = this.headOf(key);
            const control = onHandle ? moved?.querySelector<HTMLElement>('[data-slot="data-table-resize-handle"]') : moved?.querySelector<HTMLElement>('ge-data-table-column-header');
            (control?.shadowRoot?.querySelector<HTMLElement>('ge-button') ?? control)?.focus();
        });
        return true;
    }

    // ---- wiring -----------------------------------------------------------------------------------------------

    attach(): void {
        const { root, disposables } = this.host;
        this.teardown.push(
            disposables.listen<PointerEvent>(root, 'pointerdown', ownEvents(root, this.onDown)),
            this.host.addKeyHandler(KEY_PRIORITY.columnDrag, (event) => this.handleKey(event)),
            disposables.add(onLongPress(root, this.onLongPress)),
        );
    }

    detach(): void {
        this.finish(false);
        for (const stop of this.teardown.splice(0)) stop();
    }
}
