import { html, render, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import { createFlip, type FlipHandle } from '../shared/flip.js';
import { startAutoScroll, type AutoScrollController } from '../shared/auto-scroll.js';
import { acquireAriaLive, type AriaLiveHandle } from '../shared/sortable-aria-live.js';
import {
    entryDepth,
    peersInGroup,
    registerSortable,
    type AcceptResult,
    type ForeignDropContext,
    type SortableRegistryEntry,
} from '../shared/sortable-registry.js';
import { onPointerDrag } from '../shared/touch.js';
import css from './sortable.css?inline';
import { resolveSortableLocale, type SortableLocale } from './sortable.locales.js';

export const SORTABLE_REGISTER = 'ge-sortable-register';

/** Layout axis the sortable lays its items along. */
export type SortableOrientation = 'vertical' | 'horizontal';

/** Chain of list ids from the outermost sortable down to (and including) one list. A top-level list's path is `[itsOwnId]`. */
export type SortableNestedPath = readonly string[];

/** Endpoint of a reorder: the list and the position within it. */
export interface SortableLocation {
    readonly listId: string;
    /** Zero-based position within the list when the reorder commits. */
    readonly index: number;
    /** Ancestry of `listId`, outermost first, ending with `listId` itself. */
    readonly path?: SortableNestedPath;
}

/** `detail` of `reorder`. */
export interface SortableReorderEvent<T = unknown> {
    readonly from: SortableLocation;
    readonly to: SortableLocation;
    readonly item: T;
}

/** `detail` of `drop-rejected`. */
export interface SortableDropRejectedEvent<T = unknown> {
    readonly item: T;
    readonly fromListId: string;
    readonly toListId: string;
    readonly toIndex: number;
    readonly reason: string | null;
}

/** `detail` of `item-enter` and `item-leave`. */
export interface SortableForeignHoverEvent<T = unknown> {
    readonly item: T;
    readonly fromListId: string;
}

export type SortableAccepts<T = unknown> =
    | boolean
    | ((
          item: T,
          ctx: { readonly fromListId: string; readonly toListId: string; readonly toIndex: number },
      ) => boolean | { readonly ok: boolean; readonly reason?: string });

export type SortablePositionClassFn<T = unknown> = (item: T, index: number, total: number, listId: string) => string;
export type SortableLandEffectFn<T = unknown> = (item: T, from: SortableLocation, to: SortableLocation) => string | null;
export type SortableTrackByFn<T = unknown> = (item: T, index: number) => unknown;
export type SortableRenderItem<T = unknown> = (item: T, index: number) => unknown;

/**
 * Pre-made land-effect names for the `landEffect` property. Each plays a one-shot Web Animations effect that is
 * skipped under `prefers-reduced-motion`; any other string is added to the item as a class and removed after ~700ms.
 */
export const SORTABLE_LAND_EFFECTS = {
    flash: 'ge-sortable-land-flash',
    pulse: 'ge-sortable-land-pulse',
    shake: 'ge-sortable-land-shake',
    glow: 'ge-sortable-land-glow',
} as const;

/** What the parts of a sortable need from it. */
export interface SortableHost extends HTMLElement {
    readonly disabled: boolean;
    readonly handleOnly: boolean;
    readonly dragSource: number | null;
    readonly liftedIndex: number | null;
    readonly effectiveDragDelta: { x: number; y: number };
    readonly resolvedListId: string;
    indexOf(item: HTMLElement): number;
    positionClassFor(item: HTMLElement): string;
    startDrag(fromIndex: number, startX: number, startY: number): void;
    handleItemKeyDown(index: number, event: KeyboardEvent): void;
    register(part: SortablePart): void;
    unregister(part: SortablePart): void;
}

/** A part that re-renders when the drag state changes. */
export interface SortablePart extends HTMLElement {
    requestUpdate(): void;
}

const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => (value ? null : 'false') };

function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
    const copy = [...arr];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item as T);
    return copy;
}

/** The drop gap for a pointer position against item midpoints: `0` is before the first item, `rects.length` after the last. */
function computeTargetIndex(rects: DOMRect[], pointer: number, orientation: SortableOrientation, sourceIndex: number): number {
    for (let i = 0; i < rects.length; i++) {
        if (i === sourceIndex) continue;
        const rect = rects[i] as DOMRect;
        const mid = orientation === 'vertical' ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
        if (pointer < mid) return i;
    }
    return rects.length;
}

interface BuiltInLandEffect {
    readonly keyframes: Keyframe[];
    readonly duration: number;
    readonly easing: string;
}

/**
 * Built-ins play with `composite: 'add'` so transform effects (pulse, shake) overlay the FLIP translate instead of
 * being suppressed by it. `flash` and `glow` use `color-mix`, which works with any `--primary` syntax.
 */
const BUILT_IN_LAND_EFFECTS: Record<string, BuiltInLandEffect> = {
    'ge-sortable-land-flash': {
        // A tinted inset shadow over the item's own background: `composite: 'add'` does not add colours, and replacing the background erased the card.
        keyframes: [
            { boxShadow: 'inset 0 0 0 0 color-mix(in srgb, var(--primary) 0%, transparent)' },
            { boxShadow: 'inset 0 0 0 100px color-mix(in srgb, var(--primary) 45%, transparent)', offset: 0.3 },
            { boxShadow: 'inset 0 0 0 0 color-mix(in srgb, var(--primary) 0%, transparent)' },
        ],
        duration: 550,
        easing: 'ease-out',
    },
    'ge-sortable-land-pulse': {
        keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: 0.5 }, { transform: 'scale(1)' }],
        duration: 400,
        easing: 'ease-out',
    },
    'ge-sortable-land-shake': {
        keyframes: [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-4px)', offset: 0.2 },
            { transform: 'translateX(4px)', offset: 0.4 },
            { transform: 'translateX(-3px)', offset: 0.6 },
            { transform: 'translateX(3px)', offset: 0.8 },
            { transform: 'translateX(0)' },
        ],
        duration: 450,
        easing: 'ease-out',
    },
    'ge-sortable-land-glow': {
        keyframes: [
            { boxShadow: '0 0 0 0 color-mix(in srgb, var(--primary) 60%, transparent)' },
            { boxShadow: '0 0 0 10px color-mix(in srgb, var(--primary) 0%, transparent)' },
        ],
        duration: 650,
        easing: 'ease-out',
    },
};

function prefersReducedMotion(): boolean {
    return globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function playBuiltInLandEffect(el: HTMLElement, effect: BuiltInLandEffect): void {
    if (prefersReducedMotion()) return;
    el.animate(effect.keyframes, { duration: effect.duration, easing: effect.easing, composite: 'add', fill: 'none' });
}

let nextId = 0;

/**
 * A list you reorder by dragging (mouse or touch) or with the keyboard, and between lists that share a `group`.
 *
 * The items are `ge-sortable-item` children. Write them yourself and the list reorders the nodes and tells you with
 * `reorder`; or set `items` and `renderItem` and the list renders them and writes every reorder back as a new
 * `items` array (it never mutates yours). Keep one mode per group.
 *
 * Space or Enter lifts the focused item and drops it; arrows, Home and End move it; Tab and Shift+Tab hand it to the
 * next or previous list in the group; Escape puts it back. Each step is announced for screen readers.
 *
 * @slot - `ge-sortable-item`s (ignored while `renderItem` is set).
 * @slot header - Content before the items.
 * @slot footer - Content after the items.
 * @slot empty - Shown while the list has no items.
 * @slot ghost - A `ge-sortable-ghost`: the preview shown at the drop gap. Defaults to a faded copy of the dragged item.
 * @slot placeholder - A `ge-sortable-placeholder`: what is left at the lift origin. Defaults to a dashed box.
 * @attr {'vertical' | 'horizontal'} orientation - Axis the items flow along; picks the arrow keys and the pointer axis.
 * @attr {boolean} handle-only - Only a `ge-sortable-handle` (or `[data-sortable-handle]`) starts a pointer drag. Keyboard reordering is unaffected.
 * @attr {boolean} disabled - Blocks pointer drags, keyboard lifts and incoming drops (rejected with reason `disabled`).
 * @attr {string} list-id - Stable id reported in events and announced when an item crosses lists. Defaults to `sortable-N`.
 * @attr {string} group - Lists that share a group name can exchange items.
 * @attr {boolean} auto-scroll - Scrolls the nearest scrollable ancestor while the pointer is near its edge. On by default; `auto-scroll="false"` turns it off.
 * @attr {string} locale - Locale id or object for the announcements; defaults to the page's `lang`, then `en`.
 * @prop {unknown[]} items - Data mode: the items, with `renderItem`.
 * @prop {(item, index) => unknown} renderItem - Data mode: returns a Lit template, a node or text for one item.
 * @prop {boolean | (item, ctx) => boolean | { ok, reason? }} accepts - Gate for items arriving from a peer, evaluated on this (receiving) list.
 * @prop {(item, index) => string} ariaItemLabel - The spoken name of an item. Defaults to `item N`.
 * @prop {(item, index, total, listId) => string} positionClass - Class names put on each item by position.
 * @prop {(item, from, to) => string | null} landEffect - A `SORTABLE_LAND_EFFECTS` name or any class, played after a successful reorder.
 * @prop {(item, index) => unknown} trackBy - Key for data mode, so rows keep their nodes (and the reorder animation) across changes.
 * @fires reorder - After a move is applied; `detail` is `{ from, to, item }`. Not fired for an Escape revert.
 * @fires items-change - Data mode: after a move; `detail` is the new array.
 * @fires drop-rejected - A drop did not happen: `accepts` refused it, or the list was disabled or changed length mid-drag.
 * @fires item-enter - On the receiving list when a foreign item starts hovering it.
 * @fires item-leave - The other half of `item-enter`.
 * @cssprop --density-sortable - Not used: the list adds no spacing of its own.
 */
export class GeSortable extends UiElement implements SortableHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        items: { attribute: false },
        renderItem: { attribute: false },
        orientation: { reflect: true },
        handleOnly: { type: Boolean, attribute: 'handle-only', reflect: true },
        disabled: { type: Boolean, reflect: true },
        listId: { attribute: 'list-id' },
        group: { reflect: true },
        autoScroll: { attribute: 'auto-scroll', converter: defaultTrue },
        accepts: { attribute: false },
        locale: {},
        ariaItemLabel: { attribute: false },
        positionClass: { attribute: false },
        landEffect: { attribute: false },
        trackBy: { attribute: false },
        dragSource: { state: true },
        dragTarget: { state: true },
        dragDelta: { state: true },
        liftedIndex: { state: true },
        placeholderRect: { state: true },
        rejectReason: { state: true },
        foreignHover: { state: true },
    };

    declare items: unknown[];
    declare renderItem: SortableRenderItem | null;
    declare orientation: SortableOrientation;
    declare handleOnly: boolean;
    declare disabled: boolean;
    declare listId: string;
    declare group: string;
    declare autoScroll: boolean;
    declare accepts: SortableAccepts;
    declare locale: string | SortableLocale;
    declare ariaItemLabel: (item: unknown, index: number) => string;
    declare positionClass: SortablePositionClassFn;
    declare landEffect: SortableLandEffectFn;
    declare trackBy: SortableTrackByFn;
    /** Index of the item being dragged with the pointer, or `null`. */
    declare dragSource: number | null;
    /** The gap the dragged item would drop into (`0` to the item count), or `null`. */
    declare dragTarget: number | null;
    declare dragDelta: { x: number; y: number };
    /** Index of the item lifted with the keyboard, or `null`. */
    declare liftedIndex: number | null;
    declare placeholderRect: DOMRect | null;
    declare rejectReason: string | null;
    declare foreignHover: { item: unknown; fromListId: string } | null;

    private static readonly DEFAULT_ANIMATE_MS = 200;
    /** Removal delay for land-effect classes; it must cover the longest built-in keyframe (~600ms). */
    private static readonly LAND_EFFECT_MS = 700;

    private readonly parts = new Set<SortablePart>();
    private readonly autoListId = `sortable-${++nextId}`;
    private readonly flip: FlipHandle = createFlip(() => this.itemElements());
    private readonly registryEntry: SortableRegistryEntry;
    private readonly announcer: AriaLiveHandle = acquireAriaLive();
    private registryUnsub: (() => void) | null = null;
    private registeredGroup = '';
    private autoScroller: AutoScrollController | null = null;
    private dragStartLength: number | null = null;
    private dragCleanup: (() => void) | null = null;
    private draggedEl: HTMLElement | null = null;
    private rects: DOMRect[] = [];
    private liftOrigin: number | null = null;
    private hoverPeer: SortableRegistryEntry | null = null;
    private hoverPeerTarget: number | null = null;
    private flipPlayHandle: ReturnType<typeof setTimeout> | null = null;
    private watcher?: MutationObserver;
    private ghostHost: HTMLElement | null = null;

    constructor() {
        super();
        this.items = [];
        this.renderItem = null;
        this.orientation = 'vertical';
        this.handleOnly = false;
        this.disabled = false;
        this.listId = '';
        this.group = '';
        this.autoScroll = true;
        this.accepts = true;
        this.locale = '';
        this.ariaItemLabel = (...[, index]) => `item ${index + 1}`;
        this.positionClass = () => '';
        this.landEffect = () => null;
        this.trackBy = (item) => item;
        this.dragSource = null;
        this.dragTarget = null;
        this.dragDelta = { x: 0, y: 0 };
        this.liftedIndex = null;
        this.placeholderRect = null;
        this.rejectReason = null;
        this.foreignHover = null;
        this.registryEntry = this.buildRegistryEntry();
        adoptChildren<SortableHost, SortablePart>(this, SORTABLE_REGISTER, (part) => this.register(part));
    }

    register(part: SortablePart): void {
        this.parts.add(part);
    }

    unregister(part: SortablePart): void {
        this.parts.delete(part);
    }

    /** The list's id: `list-id`, or an auto-generated `sortable-N`. */
    get resolvedListId(): string {
        return this.listId || this.autoListId;
    }

    /** The enclosing sortable, when this list sits inside another list's item. */
    private get parentSortable(): GeSortable | null {
        return this.parentElement?.closest<GeSortable>('ge-sortable') ?? null;
    }

    /** This list's ancestry, outermost first, ending with its own id: what makes a tree reorder addressable. */
    get path(): SortableNestedPath {
        const parent = this.parentSortable;
        return parent === null ? [this.resolvedListId] : [...parent.path, this.resolvedListId];
    }

    /** How deep this list sits, counting from 1 for a top-level list. */
    get depth(): number {
        return this.path.length;
    }

    private get text(): SortableLocale {
        return resolveSortableLocale(this.locale);
    }

    private get dataMode(): boolean {
        return this.renderItem !== null;
    }

    /**
     * This list's OWN item elements, in DOM order. A nested list's items sit inside this host too, and while dragging
     * the ghost holds a copy of the dragged row, so both are filtered out.
     */
    private itemElements(): HTMLElement[] {
        return [...this.querySelectorAll<HTMLElement>('ge-sortable-item')].filter(
            (el) => !el.hasAttribute('ghost') && el.closest('ge-sortable') === this,
        );
    }

    /** Position of an item element among this list's items. */
    indexOf(item: HTMLElement): number {
        return this.itemElements().indexOf(item);
    }

    /** The item at `index`, as the caller gave it: the data item in data mode, the element otherwise. */
    private itemAt(index: number): unknown {
        return this.dataMode ? this.items[index] : this.itemElements()[index];
    }

    private get itemCount(): number {
        return this.dataMode ? this.items.length : this.itemElements().length;
    }

    positionClassFor(item: HTMLElement): string {
        const index = this.indexOf(item);
        if (index < 0) return '';
        return this.positionClass(this.itemAt(index), index, this.itemCount, this.resolvedListId);
    }

    /** Pointer delta adjusted for the ghost's in-flow slot, so the dragged row stays glued to the cursor. */
    get effectiveDragDelta(): { x: number; y: number } {
        const delta = this.dragDelta;
        const { dragSource: source, dragTarget: target, placeholderRect: placeholder } = this;
        if (source === null || target === null || placeholder === null) return delta;
        // Inserting the ghost before the source's slot pushes that slot forward by the ghost's size.
        if (target === source || target === source + 1 || target >= source) return delta;
        return this.orientation === 'vertical'
            ? { x: delta.x, y: delta.y - placeholder.height }
            : { x: delta.x - placeholder.width, y: delta.y };
    }

    // ---- lifecycle ----------------------------------------------------------------------------------------

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'sortable';
        this.syncRegistry();
        this.watcher = new MutationObserver(() => this.checkDragIntegrity());
        this.watcher.observe(this, { childList: true });
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.dragCleanup?.();
        this.dragCleanup = null;
        this.autoScroller?.stop();
        this.autoScroller = null;
        if (this.flipPlayHandle !== null) clearTimeout(this.flipPlayHandle);
        this.flipPlayHandle = null;
        this.registryUnsub?.();
        this.registryUnsub = null;
        this.watcher?.disconnect();
        this.ghostHost?.remove();
        this.ghostHost = null;
    }

    private syncRegistry(): void {
        if (!this.isConnected) return;
        if (this.registryUnsub && this.registeredGroup === this.group) return;
        this.registryUnsub?.();
        this.registryUnsub = null;
        this.registeredGroup = this.group;
        if (this.group !== '') this.registryUnsub = registerSortable(this.registryEntry);
    }

    /** A drag is abandoned when the list is disabled or its items change length under it. */
    private checkDragIntegrity(): void {
        if (this.dragSource === null) return;
        if (this.disabled) {
            this.cancelDragDueTo('disabled');
            return;
        }
        if (this.dragStartLength !== null && this.itemCount !== this.dragStartLength) this.cancelDragDueTo('list-changed');
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('group')) this.syncRegistry();
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (this.dataMode) this.renderDataItems();
        this.toggleAttribute('data-receiving', this.foreignHover !== null);
        if (this.rejectReason === null) this.removeAttribute('data-reject');
        else this.setAttribute('data-reject', this.rejectReason);
        this.syncGhost();
        this.checkDragIntegrity();
        if (changed.has('disabled') && this.disabled) this.liftedIndex = null;
        for (const part of this.parts) part.requestUpdate();
    }

    /** Data mode renders into the host's light DOM, so the page's own styles reach the rows. */
    private renderDataItems(): void {
        const template = repeat(
            this.items,
            (item, index) => this.trackBy(item, index),
            (item, index) => html`<ge-sortable-item>${this.renderItem?.(item, index)}</ge-sortable-item>`,
        );
        render(template, this, { host: this });
    }

    // ---- registry -----------------------------------------------------------------------------------------

    private buildRegistryEntry(): SortableRegistryEntry {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        return {
            get listId() {
                return self.resolvedListId;
            },
            get group() {
                return self.group;
            },
            get path() {
                return self.path;
            },
            get element() {
                return self;
            },
            get orientation() {
                return self.orientation;
            },
            getItemRects: () => self.itemRects(),
            canAccept: (item, ctx) => self.evaluateAccepts(item, ctx),
            onForeignEnter: (item, fromListId) => self.handleForeignEnter(item, fromListId),
            onForeignLeave: () => self.handleForeignLeave(),
            setRejectReason: (reason) => {
                self.rejectReason = reason;
            },
            receiveItem: (item, atIndex) => self.handleReceiveItem(item, atIndex),
            removeItem: (item) => self.handleRemoveItem(item),
        };
    }

    private itemRects(): DOMRect[] {
        return this.itemElements().map((el) => el.getBoundingClientRect());
    }

    private handleForeignEnter(item: unknown, fromListId: string): void {
        this.foreignHover = { item, fromListId };
        this.emit('item-enter', { item, fromListId });
    }

    private handleForeignLeave(): void {
        const current = this.foreignHover;
        this.foreignHover = null;
        this.rejectReason = null;
        if (current !== null) this.emit('item-leave', current);
    }

    /** Evaluates `accepts` for a foreign item. A disabled list always rejects. */
    evaluateAccepts(item: unknown, ctx: ForeignDropContext): AcceptResult {
        if (this.disabled) return { ok: false, reason: 'disabled' };
        if (typeof this.accepts === 'boolean') return this.accepts;
        return this.accepts(item, { ...ctx, toListId: this.resolvedListId });
    }

    private normalizeAccept(result: AcceptResult): { ok: boolean; reason: string | null } {
        if (typeof result === 'boolean') return { ok: result, reason: null };
        return { ok: result.ok, reason: result.reason ?? null };
    }

    private emit<T>(name: string, detail: T): void {
        this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
    }

    // ---- committing moves ---------------------------------------------------------------------------------

    /** Applies a list of items: data mode writes the array, DOM mode moves the nodes. */
    private setItemOrder(next: unknown[]): void {
        if (this.dataMode) {
            this.items = next;
            this.emit('items-change', next);
            return;
        }
        const current = this.itemElements();
        const anchor = current.find((el) => !next.includes(el))?.nextElementSibling ?? null;
        let cursor: Element | null = anchor;
        // Walk backwards so each node lands before the one after it; nodes already in place are left alone.
        for (const el of [...(next as HTMLElement[])].reverse()) {
            if (el.nextElementSibling !== cursor || el.parentElement !== this) this.insertBefore(el, cursor);
            cursor = el;
        }
    }

    private schedulePlay(): void {
        if (this.flipPlayHandle !== null) clearTimeout(this.flipPlayHandle);
        this.flipPlayHandle = setTimeout(() => {
            this.flipPlayHandle = null;
            void this.flip.play(GeSortable.DEFAULT_ANIMATE_MS);
            this.restoreLiftFocus();
        }, 0);
    }

    /** Moving a node blurs it; a lifted item must stay focused so the arrows keep working. */
    private restoreLiftFocus(): void {
        if (this.liftedIndex === null) return;
        const el = this.itemElements()[this.liftedIndex];
        if (el && document.activeElement !== el) el.focus({ preventScroll: true });
    }

    private applyReorder(from: number, to: number, options: { clearDrag: boolean; emit: boolean }): void {
        if (from === to) {
            if (options.clearDrag) {
                // A no-op drop still animates the source back from where the pointer left it.
                this.flip.measure();
                this.clearDragState();
                this.schedulePlay();
            }
            return;
        }
        this.flip.measure();
        const current = this.dataMode ? this.items : this.itemElements();
        const item = current[from];
        this.setItemOrder(moveItem(current, from, to));
        if (options.clearDrag) this.clearDragState();
        if (options.emit) this.emitReorder(from, to, item);
        this.schedulePlay();
        if (options.emit) this.scheduleLandEffect(from, to, item);
    }

    private emitReorder(fromIndex: number, toIndex: number, item: unknown): void {
        const listId = this.resolvedListId;
        const path = this.path;
        this.emit<SortableReorderEvent>('reorder', { from: { listId, index: fromIndex, path }, to: { listId, index: toIndex, path }, item });
    }

    private handleReceiveItem(item: unknown, atIndex: number): void {
        this.flip.measure();
        if (this.dataMode) {
            const next = [...this.items];
            next.splice(atIndex, 0, item);
            this.items = next;
            this.emit('items-change', next);
        } else {
            const els = this.itemElements();
            this.insertBefore(item as HTMLElement, els[atIndex] ?? els.at(-1)?.nextElementSibling ?? null);
        }
        this.schedulePlay();
    }

    private handleRemoveItem(item: unknown): void {
        if (this.dataMode) {
            const index = this.items.indexOf(item);
            if (index === -1) return;
            this.flip.measure();
            const next = [...this.items];
            next.splice(index, 1);
            this.items = next;
            this.emit('items-change', next);
        } else {
            this.flip.measure();
            (item as HTMLElement).remove();
        }
        this.schedulePlay();
    }

    private scheduleLandEffect(fromIndex: number, toIndex: number, item: unknown): void {
        const listId = this.resolvedListId;
        const path = this.path;
        const cls = this.landEffect(item, { listId, index: fromIndex, path }, { listId, index: toIndex, path });
        if (cls === null || cls === '') return;
        setTimeout(() => {
            const el = this.itemElements()[toIndex];
            if (!el) return;
            const builtIn = BUILT_IN_LAND_EFFECTS[cls];
            if (builtIn) {
                playBuiltInLandEffect(el, builtIn);
                return;
            }
            // On the item itself, where the page's own stylesheet can reach it.
            el.classList.add(cls);
            setTimeout(() => el.classList.remove(cls), GeSortable.LAND_EFFECT_MS);
        }, 0);
    }

    // ---- ghost and placeholder ----------------------------------------------------------------------------

    private isNoOpGap(gap: number, source: number): boolean {
        return gap === source || gap === source + 1;
    }

    /** The gap the drop ghost belongs in, or `null` while no drag is active or the gap would leave the item where it is. */
    private get ghostGap(): number | null {
        const { dragTarget: target, dragSource: source } = this;
        if (target === null || source === null || this.isNoOpGap(target, source)) return null;
        return target;
    }

    /** Puts the ghost in the flow at the drop gap, or takes it out. It is a light-DOM node so that it flows between the items. */
    private syncGhost(): void {
        const gap = this.ghostGap;
        if (gap === null) {
            this.ghostHost?.remove();
            this.ghostHost = null;
            return;
        }
        const els = this.itemElements();
        const reference = els[gap] ?? null;
        if (!this.ghostHost) this.ghostHost = this.buildGhost();
        if (this.ghostHost.nextElementSibling === reference && this.ghostHost.parentElement === this) return;
        if (reference) this.insertBefore(this.ghostHost, reference);
        else this.insertBefore(this.ghostHost, els.at(-1)?.nextElementSibling ?? null);
    }

    private buildGhost(): HTMLElement {
        const host = document.createElement('div');
        host.setAttribute('aria-hidden', 'true');
        const custom = this.querySelector<HTMLElement>(':scope > ge-sortable-ghost');
        if (custom) {
            host.dataset.slot = 'sortable-ghost-host';
            for (const child of custom.childNodes) host.append(child.cloneNode(true));
        } else {
            host.dataset.slot = 'sortable-ghost';
            const source = this.draggedEl;
            if (source) {
                const copy = source.cloneNode(true) as HTMLElement;
                copy.setAttribute('ghost', '');
                copy.removeAttribute('style');
                copy.removeAttribute('tabindex');
                host.append(copy);
            }
        }
        return host;
    }

    /** The fixed-position box left at the lift origin: the `ge-sortable-placeholder`'s content, or a dashed box. */
    private renderPlaceholder(): TemplateResult | null {
        const r = this.placeholderRect;
        if (!r) return null;
        const style = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
        const custom = this.querySelector<HTMLElement>(':scope > ge-sortable-placeholder');
        if (custom) {
            const copy = [...custom.childNodes].map((child) => child.cloneNode(true));
            return html`<div class="placeholder custom" data-slot="sortable-placeholder-host" style=${style}>${copy}</div>`;
        }
        return html`<div class="placeholder" data-slot="sortable-placeholder" aria-hidden="true" style=${style}></div>`;
    }

    // ---- pointer drags ------------------------------------------------------------------------------------

    /**
     * Begins a pointer drag of the item at `fromIndex` from the pointer's viewport coordinates. Items and handles call
     * this; call it yourself to drive a drag from another pointer source. Tracking is bound to the window for mouse and
     * touch alike. Ignored while disabled.
     */
    startDrag(fromIndex: number, startX: number, startY: number): void {
        if (this.disabled) return;
        this.dragCleanup?.();
        this.rects = this.itemRects();
        this.draggedEl = this.itemElements()[fromIndex] ?? null;
        this.dragSource = fromIndex;
        this.dragTarget = fromIndex;
        this.dragDelta = { x: 0, y: 0 };
        this.placeholderRect = this.rects[fromIndex] ?? null;
        this.dragStartLength = this.itemCount;
        if (this.autoScroll) this.autoScroller = startAutoScroll();
        this.dragCleanup = onPointerDrag(
            (clientX, clientY) => this.onDragMove(fromIndex, startX, startY, clientX, clientY),
            () => this.onDragEnd(),
        );
    }

    private onDragMove(fromIndex: number, startX: number, startY: number, clientX: number, clientY: number): void {
        this.dragDelta = { x: clientX - startX, y: clientY - startY };
        this.autoScroller?.update(clientX, clientY);
        const peer = this.findHoverPeer(clientX, clientY);
        if (peer === null) this.updateLocalTarget(fromIndex, clientX, clientY);
        else this.updatePeerTarget(peer, clientX, clientY);
    }

    /**
     * The peer under the pointer, or `null` to keep the drag local. With nesting the answer is not unique (a child
     * list sits inside its parent), so the DEEPEST containing peer wins; equal depths keep the first match. A list
     * inside the dragged item is excluded: dropping an item into its own subtree would detach that subtree.
     */
    private findHoverPeer(clientX: number, clientY: number): SortableRegistryEntry | null {
        if (this.group === '') return null;
        let best: SortableRegistryEntry | null = null;
        // Over its own list a nested list must not lose to the list around it: only a peer as deep or deeper wins.
        const own = this.getBoundingClientRect();
        const overOwn = clientX >= own.left && clientX <= own.right && clientY >= own.top && clientY <= own.bottom;
        let bestDepth = overOwn ? entryDepth(this.registryEntry) - 1 : -1;
        for (const peer of peersInGroup(this.group, this.registryEntry)) {
            const r = peer.element.getBoundingClientRect();
            if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue;
            if (this.draggedEl?.contains(peer.element)) continue;
            const depth = entryDepth(peer);
            if (depth > bestDepth) {
                best = peer;
                bestDepth = depth;
            }
        }
        return best;
    }

    private updateLocalTarget(fromIndex: number, clientX: number, clientY: number): void {
        this.hoverPeer?.onForeignLeave();
        this.hoverPeer = null;
        this.hoverPeerTarget = null;
        const pointer = this.orientation === 'vertical' ? clientY : clientX;
        this.dragTarget = computeTargetIndex(this.rects, pointer, this.orientation, fromIndex);
    }

    private updatePeerTarget(peer: SortableRegistryEntry, clientX: number, clientY: number): void {
        if (this.hoverPeer !== null && this.hoverPeer !== peer) this.hoverPeer.onForeignLeave();
        if (this.hoverPeer !== peer && this.dragSource !== null) peer.onForeignEnter(this.itemAt(this.dragSource), this.resolvedListId);
        this.hoverPeer = peer;
        const pointer = peer.orientation === 'vertical' ? clientY : clientX;
        const target = computeTargetIndex(peer.getItemRects(), pointer, peer.orientation, -1);
        this.hoverPeerTarget = target;
        this.updatePeerRejectVisual(peer, target);
    }

    /** Pushes the receiving peer's `data-reject` from a live evaluation of `accepts` as the target index shifts. */
    private updatePeerRejectVisual(peer: SortableRegistryEntry, toIndex: number): void {
        if (this.dragSource === null) return;
        const norm = this.normalizeAccept(peer.canAccept(this.itemAt(this.dragSource), { fromListId: this.resolvedListId, toIndex }));
        peer.setRejectReason(norm.ok ? null : (norm.reason ?? 'rejected'));
    }

    private onDragEnd(): void {
        const from = this.dragSource;
        this.dragCleanup = null;
        if (from === null) {
            this.clearDragState();
            return;
        }
        const peer = this.hoverPeer;
        if (peer !== null) {
            this.commitCrossListDrop(from, peer);
            return;
        }
        const gap = this.dragTarget;
        if (gap === null) {
            // Released before any move: still animate the source back from its translated position.
            this.flip.measure();
            this.clearDragState();
            this.schedulePlay();
            return;
        }
        this.applyReorder(from, gap > from ? gap - 1 : gap, { clearDrag: true, emit: true });
    }

    private commitCrossListDrop(from: number, peer: SortableRegistryEntry): void {
        const item = this.itemAt(from);
        const targetIndex = this.hoverPeerTarget ?? 0;
        const norm = this.normalizeAccept(peer.canAccept(item, { fromListId: this.resolvedListId, toIndex: targetIndex }));
        peer.onForeignLeave();
        if (!norm.ok) {
            this.clearDragState();
            this.emit<SortableDropRejectedEvent>('drop-rejected', {
                item,
                fromListId: this.resolvedListId,
                toListId: peer.listId,
                toIndex: targetIndex,
                reason: norm.reason,
            });
            return;
        }
        this.handoff(item, from, peer, targetIndex, () => this.clearDragState());
    }

    /** Moves `item` out of this list into `peer` and reports it. `before` runs between measuring and mutating. */
    private handoff(item: unknown, from: number, peer: SortableRegistryEntry, targetIndex: number, before: () => void): void {
        this.flip.measure();
        before();
        if (this.dataMode) {
            const next = [...this.items];
            next.splice(from, 1);
            this.items = next;
            this.emit('items-change', next);
        }
        peer.receiveItem(item, targetIndex);
        this.emit<SortableReorderEvent>('reorder', {
            from: { listId: this.resolvedListId, index: from, path: this.path },
            to: { listId: peer.listId, index: targetIndex, path: peer.path ?? [peer.listId] },
            item,
        });
        this.schedulePlay();
    }

    private clearDragState(): void {
        this.dragSource = null;
        this.dragTarget = null;
        this.dragDelta = { x: 0, y: 0 };
        this.placeholderRect = null;
        this.hoverPeer = null;
        this.hoverPeerTarget = null;
        this.dragStartLength = null;
        this.draggedEl = null;
        this.autoScroller?.stop();
        this.autoScroller = null;
    }

    /** Abandons an in-flight drag because the list was disabled or its items changed length under it. */
    private cancelDragDueTo(reason: string): void {
        const source = this.dragSource;
        if (source === null) return;
        const item = this.itemAt(source) ?? null;
        this.dragCleanup?.();
        this.dragCleanup = null;
        const peer = this.hoverPeer;
        peer?.onForeignLeave();
        const toIndex = this.hoverPeerTarget ?? -1;
        this.clearDragState();
        if (item !== null) {
            this.emit<SortableDropRejectedEvent>('drop-rejected', {
                item,
                fromListId: this.resolvedListId,
                toListId: peer?.listId ?? this.resolvedListId,
                toIndex,
                reason,
            });
        }
    }

    // ---- keyboard -----------------------------------------------------------------------------------------

    /**
     * Keyboard reordering for the focused item at `index` (items forward their key events here). Space or Enter lifts
     * and drops; Escape reverts to the lift origin without firing `reorder`. While THIS item is lifted: arrows move it
     * one slot along the orientation, Home and End send it to either end, Tab and Shift+Tab hand it to the next or
     * previous list in the group. Every move is announced.
     */
    handleItemKeyDown(index: number, event: KeyboardEvent): void {
        if (this.disabled) return;
        const lifted = this.liftedIndex;
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            this.liftOrDrop(index, lifted);
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelKeyboardDrag();
            return;
        }
        if (lifted === null || lifted !== index) return;
        const last = this.itemCount - 1;
        if (event.key === 'Home') {
            event.preventDefault();
            this.keyboardMove(index, 0);
        } else if (event.key === 'End') {
            event.preventDefault();
            this.keyboardMove(index, last);
        } else if (event.key === 'Tab') {
            event.preventDefault();
            this.keyboardCrossList(index, event.shiftKey ? -1 : 1);
        } else {
            const delta = this.arrowDelta(event.key);
            if (delta === 0) return;
            event.preventDefault();
            this.keyboardMove(index, Math.max(0, Math.min(last, index + delta)));
        }
    }

    private keyboardMove(from: number, to: number): void {
        if (to === from) return;
        this.applyReorder(from, to, { clearDrag: false, emit: true });
        this.liftedIndex = to;
        this.announcer.announce(this.text.moved(to + 1, this.itemCount));
    }

    /** Hands the lifted item to the next or previous peer in the group, skipping lists nested in the lifted item. */
    private keyboardCrossList(from: number, direction: 1 | -1): void {
        if (this.group === '') return;
        const draggedEl = this.itemElements()[from] ?? null;
        const peers = peersInGroup(this.group).filter((p) => p === this.registryEntry || !draggedEl?.contains(p.element));
        const self = peers.indexOf(this.registryEntry);
        if (self === -1 || peers.length < 2) return;
        const peer = peers[(self + direction + peers.length) % peers.length] as SortableRegistryEntry;
        if (peer === this.registryEntry) return;

        const item = this.itemAt(from);
        const existing = peer.getItemRects().length;
        const norm = this.normalizeAccept(peer.canAccept(item, { fromListId: this.resolvedListId, toIndex: existing }));
        if (!norm.ok) {
            this.announcer.announce(this.text.rejected(norm.reason));
            this.emit<SortableDropRejectedEvent>('drop-rejected', {
                item,
                fromListId: this.resolvedListId,
                toListId: peer.listId,
                toIndex: existing,
                reason: norm.reason,
            });
            return;
        }
        this.handoff(item, from, peer, existing, () => {
            this.liftedIndex = null;
            this.liftOrigin = null;
        });
        this.announcer.announce(this.text.movedToList(peer.listId, existing + 1, existing + 1));
    }

    private liftOrDrop(index: number, lifted: number | null): void {
        if (lifted === null) {
            this.liftedIndex = index;
            this.liftOrigin = index;
            this.announcer.announce(this.text.pickedUp(this.itemLabel(index), index + 1, this.itemCount));
        } else {
            this.liftedIndex = null;
            this.liftOrigin = null;
            this.announcer.announce(this.text.dropped(lifted + 1));
        }
    }

    private cancelKeyboardDrag(): void {
        const origin = this.liftOrigin;
        const lifted = this.liftedIndex;
        if (origin !== null && lifted !== null && origin !== lifted) this.applyReorder(lifted, origin, { clearDrag: false, emit: false });
        this.liftedIndex = null;
        this.liftOrigin = null;
        this.announcer.announce(this.text.cancelled);
    }

    private itemLabel(index: number): string {
        const item = this.itemAt(index);
        return item === undefined ? `item ${index + 1}` : this.ariaItemLabel(item, index);
    }

    private arrowDelta(key: string): number {
        const vertical = this.orientation === 'vertical';
        if (key === (vertical ? 'ArrowDown' : 'ArrowRight')) return 1;
        if (key === (vertical ? 'ArrowUp' : 'ArrowLeft')) return -1;
        return 0;
    }

    protected override render() {
        const rtl = this.text.rtl ? 'rtl' : 'ltr';
        return html`<div class="list" part="list" data-orientation=${this.orientation} dir=${rtl}>
                <slot name="header"></slot>
                ${this.itemCount === 0 ? html`<slot name="empty"></slot>` : null}
                <slot></slot>
                <slot name="footer"></slot>
            </div>
            ${this.renderPlaceholder()}`;
    }
}
