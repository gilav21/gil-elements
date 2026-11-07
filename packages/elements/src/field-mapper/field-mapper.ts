import { html, nothing, svg, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { UiElement } from '@gilav21/elements-base';
import { startAutoScroll, type AutoScrollController } from '../shared/auto-scroll.js';
import { createFlip } from '../shared/flip.js';
import css from './field-mapper.css?inline';
import { resolveFieldMapperLocale, type FieldMapperLocale } from './field-mapper.locales.js';
import type {
    FieldMapperItem,
    FieldMapperItemContext,
    FieldMapperLayout,
    FieldMapperLink,
    FieldMapperLinkLabelContext,
    FieldMapperLinkTone,
    FieldMapperMaxLinks,
    FieldMapperSide,
} from './field-mapper.types.js';
import {
    addLink,
    alignEndRows,
    filterItems,
    linkPath,
    navigate,
    removeLinks,
    resolveMaxLinks,
    sameLink,
    type FieldMapperLinkChange,
} from './field-mapper.utils.js';

/** One drawn line, in the grid's coordinate space. */
export interface FieldMapperLine {
    readonly key: string;
    readonly link: FieldMapperLink;
    readonly path: string;
    readonly midX: number;
    readonly midY: number;
    readonly tone: FieldMapperLinkTone;
    /** One end is hidden by a filter, so the line runs to that list's edge. */
    readonly toEdge: boolean;
}

interface Geometry {
    readonly width: number;
    readonly height: number;
    readonly gutter: number;
    readonly lines: readonly FieldMapperLine[];
    readonly rubberBand: string | null;
}

interface Point {
    readonly x: number;
    readonly y: number;
}

/** What the grid looked like at one measurement. */
interface Frame {
    readonly origin: DOMRect;
    readonly handles: ReadonlyMap<string, Point>;
    readonly columns: Readonly<Record<FieldMapperSide, DOMRect | null>>;
    readonly notes: Readonly<Record<FieldMapperSide, number | null>>;
}

interface PickedItem {
    readonly side: FieldMapperSide;
    readonly id: string;
}

interface DragState extends PickedItem {
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    moved: boolean;
    clientX: number;
    clientY: number;
}

/** Renders one item's content; a Lit template, a node or text. */
export type FieldMapperRenderItem = (item: FieldMapperItem, context: FieldMapperItemContext) => unknown;
/** Renders the short label beside a line. */
export type FieldMapperRenderLinkLabel = (link: FieldMapperLink, context: FieldMapperLinkLabelContext) => unknown;

const EMPTY_GEOMETRY: Geometry = { width: 0, height: 0, gutter: 0, lines: [], rubberBand: null };
/** Below this container width (in rem) the gutter no longer fits and the rows layout takes over. */
const NARROW_BELOW_REM = 28;
/** Pointer travel (px) before a press on a handle becomes a drag rather than a tap. */
const DRAG_THRESHOLD = 4;
const REALIGN_MS = 220;
const HEADER_ROWS = 1;
const NO_BREAK_SPACE = String.fromCodePoint(0xa0);
/** What a change to each of these makes stale: the drawn lines. */
const MEASURED = ['start', 'end', 'links', 'noAlign', 'layout', 'searchable', 'linkTone', 'renderLinkLabel', 'renderItem', 'startQuery', 'endQuery', 'measuredNarrow', 'startHeading', 'endHeading', 'locale'];

let nextId = 0;

function handleKey(side: FieldMapperSide, id: string): string {
    return `${side}\u0000${id}`;
}

function otherSide(side: FieldMapperSide): FieldMapperSide {
    return side === 'start' ? 'end' : 'start';
}

function centerOf(rect: DOMRect, origin: DOMRect): Point {
    return { x: rect.left + rect.width / 2 - origin.left, y: rect.top + rect.height / 2 - origin.top };
}

/** The x of whichever vertical edge of `column` is nearer to `x`. */
function nearestEdge(column: DOMRect, origin: DOMRect, x: number): number {
    const left = column.left - origin.left;
    const right = column.right - origin.left;
    return Math.abs(left - x) < Math.abs(right - x) ? left : right;
}

/**
 * Two lists side by side, joined by lines that say which goes with which: import field mapping, schema mapping,
 * pairing columns across two tables.
 *
 * Lists are `start` and `end`, never left and right: in a right-to-left document the start list is on the right and the
 * whole component mirrors. A line can be drawn three ways, each complete on its own (drag from an item's dot, tap one
 * item then one in the other list, or the keyboard), and every change is announced in a polite live region.
 *
 * Both lists sit in one CSS grid inside one scroll container, so the lines (an SVG in the same scrolled content) can
 * never drift from their items. Below about 28rem of its own width the component switches to stacked rows, each start
 * item with a picker for its partner.
 *
 * `links` is two-way in the Angular library; here the element updates its own `links` property and fires `links-change`.
 *
 * @fires links-change - A link was added or removed. `detail` is the new `links` array.
 * @fires link-select - A line was selected, or the selection cleared. `detail` is the link or `null`.
 * @prop {FieldMapperItem[]} start - Items of the start list: on the left in LTR, on the right in RTL.
 * @prop {FieldMapperItem[]} end - Items of the end list.
 * @prop {FieldMapperLink[]} links - The links. The component never invents one: every change comes from the user.
 * @prop {{ start?: number; end?: number }} maxLinks - How many links one item may hold, per side (default 1). Going over moves the oldest link; `Infinity` allows any number.
 * @prop {(link) => 'default' | 'muted' | 'strong'} linkTone - Picks each line's tone.
 * @prop {(item, context) => unknown} renderItem - Content of one item in place of its label.
 * @prop {(link, context) => unknown} renderLinkLabel - A short label in the gutter at each line's midpoint.
 * @attr {string} start-heading - Heading over the start list. Falls back to the locale's.
 * @attr {string} end-heading - Heading over the end list.
 * @attr {boolean} no-align - Keeps the end list in its own order instead of putting each linked item level with its partner.
 * @attr {'auto' | 'columns' | 'rows'} layout - `auto` switches to stacked rows below about 28rem; the others force one.
 * @attr {boolean} searchable - Adds a filter box over each list.
 * @attr {string} locale - Locale id or object; defaults to the page's `lang`, then `en`.
 * @csspart base - The root element.
 * @cssprop --field-mapper-gutter - Width of the gutter between the lists.
 * @cssprop --field-mapper-max-height - Height at which the lists scroll.
 */
export class GeFieldMapper extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        start: { attribute: false },
        end: { attribute: false },
        links: { attribute: false },
        maxLinks: { attribute: false },
        startHeading: { attribute: 'start-heading' },
        endHeading: { attribute: 'end-heading' },
        noAlign: { type: Boolean, attribute: 'no-align', reflect: true },
        layout: { reflect: true },
        searchable: { type: Boolean, reflect: true },
        linkTone: { attribute: false },
        renderItem: { attribute: false },
        renderLinkLabel: { attribute: false },
        locale: {},
        startQuery: { state: true },
        endQuery: { state: true },
        pending: { state: true },
        selectedLink: { state: true },
        geometry: { state: true },
        liveMessage: { state: true },
        dragging: { state: true },
        activeId: { state: true },
        measuredNarrow: { state: true },
    };

    declare start: readonly FieldMapperItem[];
    declare end: readonly FieldMapperItem[];
    declare links: readonly FieldMapperLink[];
    declare maxLinks: FieldMapperMaxLinks;
    declare startHeading: string | undefined;
    declare endHeading: string | undefined;
    declare noAlign: boolean;
    declare layout: FieldMapperLayout;
    declare searchable: boolean;
    declare linkTone: ((link: FieldMapperLink) => FieldMapperLinkTone) | null;
    declare renderItem: FieldMapperRenderItem | null;
    declare renderLinkLabel: FieldMapperRenderLinkLabel | null;
    declare locale: string | FieldMapperLocale;
    declare startQuery: string;
    declare endQuery: string;
    declare pending: PickedItem | null;
    declare selectedLink: FieldMapperLink | null;
    declare geometry: Geometry;
    declare liveMessage: string;
    declare dragging: PickedItem | null;
    declare activeId: Record<FieldMapperSide, string | null>;
    declare measuredNarrow: boolean;

    private readonly baseId = `ge-field-mapper-${++nextId}`;
    private readonly ids = {
        startHeading: `${this.baseId}-start-heading`,
        endHeading: `${this.baseId}-end-heading`,
        instructions: `${this.baseId}-instructions`,
    };
    private readonly flip = createFlip(() => this.endItemElements());
    private readonly observer: ResizeObserver | undefined = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.onResize()) : undefined;
    private animating = false;
    private frameHandle = 0;
    private drag: DragState | null = null;
    private stopDrag: (() => void) | null = null;
    private autoScroll: AutoScrollController | null = null;
    private suppressClick = false;
    private liveToggle = false;
    private observedGrid: Element | null = null;
    private realignAfterRender = false;

    constructor() {
        super();
        this.start = [];
        this.end = [];
        this.links = [];
        this.maxLinks = { start: 1, end: 1 };
        this.noAlign = false;
        this.layout = 'auto';
        this.searchable = false;
        this.linkTone = null;
        this.renderItem = null;
        this.renderLinkLabel = null;
        this.locale = '';
        this.startQuery = '';
        this.endQuery = '';
        this.pending = null;
        this.selectedLink = null;
        this.geometry = EMPTY_GEOMETRY;
        this.liveMessage = '';
        this.dragging = null;
        this.activeId = { start: null, end: null };
        this.measuredNarrow = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'field-mapper';
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.observer?.disconnect();
        this.observedGrid = null;
        this.endDrag();
        if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
        this.frameHandle = 0;
    }

    // ---- derived data -------------------------------------------------------------------------------------

    private get t(): FieldMapperLocale {
        return resolveFieldMapperLocale(this.locale);
    }

    private get limits() {
        return resolveMaxLinks(this.maxLinks);
    }

    private get startHeadingText(): string {
        return this.startHeading ?? this.t.startHeading;
    }

    private get endHeadingText(): string {
        return this.endHeading ?? this.t.endHeading;
    }

    /** Whether the stacked rows layout is showing. */
    get narrow(): boolean {
        return this.layout === 'auto' ? this.measuredNarrow : this.layout === 'rows';
    }

    private get startVisible(): readonly FieldMapperItem[] {
        return filterItems(this.start, this.startQuery);
    }

    private get endVisible(): readonly FieldMapperItem[] {
        return filterItems(this.end, this.endQuery);
    }

    private get endRows(): readonly (FieldMapperItem | null)[] {
        return this.noAlign ? this.endVisible : alignEndRows(this.startVisible, this.endVisible, this.links);
    }

    private itemById(side: FieldMapperSide, id: string): FieldMapperItem | undefined {
        return (side === 'start' ? this.start : this.end).find((item) => item.id === id);
    }

    private visualIds(): Record<FieldMapperSide, readonly string[]> {
        return {
            start: this.startVisible.map((item) => item.id),
            end: this.endRows.flatMap((item) => (item ? [item.id] : [])),
        };
    }

    /** The one item of each list that Tab reaches: the last one focused while it is visible, else the first. */
    private tabStops(): Record<FieldMapperSide, string> {
        const ids = this.visualIds();
        const stop = (side: FieldMapperSide): string => {
            const id = this.activeId[side];
            return id !== null && ids[side].includes(id) ? id : (ids[side].at(0) ?? '');
        };
        return { start: stop('start'), end: stop('end') };
    }

    /** Per side, how many items the filter hides that are linked to a visible item. */
    private hiddenLinked(): Record<FieldMapperSide, number> {
        const startShown = new Set(this.startVisible.map((item) => item.id));
        const endShown = new Set(this.endVisible.map((item) => item.id));
        const hiddenStart = new Set<string>();
        const hiddenEnd = new Set<string>();
        for (const link of this.links) {
            const startIn = startShown.has(link.startId);
            const endIn = endShown.has(link.endId);
            if (startIn && !endIn && this.itemById('end', link.endId)) hiddenEnd.add(link.endId);
            if (endIn && !startIn && this.itemById('start', link.startId)) hiddenStart.add(link.startId);
        }
        return { start: hiddenStart.size, end: hiddenEnd.size };
    }

    // ---- reading the model --------------------------------------------------------------------------------

    private labelOf(side: FieldMapperSide, id: string): string {
        return this.itemById(side, id)?.label ?? id;
    }

    /** Links that touch an item. */
    linksOf(side: FieldMapperSide, id: string): readonly FieldMapperLink[] {
        return this.links.filter((link) => (side === 'start' ? link.startId : link.endId) === id);
    }

    private partnerIds(side: FieldMapperSide, id: string): readonly string[] {
        return this.linksOf(side, id).map((link) => (side === 'start' ? link.endId : link.startId));
    }

    private isLinked(side: FieldMapperSide, id: string): boolean {
        return this.linksOf(side, id).length > 0;
    }

    /** Accessible name of an item: its label and what it is linked to. */
    private itemName(side: FieldMapperSide, item: FieldMapperItem): string {
        const partners = this.partnerIds(side, item.id).map((id) => this.labelOf(otherSide(side), id));
        const state = partners.length > 0 ? this.t.linkedTo(partners.join(', ')) : this.t.notLinked;
        return `${item.label}, ${state}`;
    }

    private itemState(side: FieldMapperSide, id: string): string | null {
        if (this.pending?.side === side && this.pending.id === id) return 'choosing';
        if (this.dragging?.side === side && this.dragging.id === id) return 'dragging';
        return null;
    }

    private isSelectedLink(link: FieldMapperLink): boolean {
        return this.selectedLink !== null && sameLink(this.selectedLink, link);
    }

    // ---- changing the model -------------------------------------------------------------------------------

    /** Links two items, moving older links out where `maxLinks` requires. */
    link(startId: string, endId: string): void {
        const start = this.itemById('start', startId);
        const end = this.itemById('end', endId);
        if (!start || !end || start.disabled || end.disabled) return;
        this.commit(addLink(this.links, { startId, endId }, this.limits));
    }

    /** Removes one link. */
    unlink(link: FieldMapperLink): void {
        this.commit(removeLinks(this.links, (candidate) => sameLink(candidate, link)));
    }

    /** Removes every link of one item. */
    unlinkItem(side: FieldMapperSide, id: string): void {
        this.commit(removeLinks(this.links, (link) => (side === 'start' ? link.startId : link.endId) === id));
    }

    private commit(change: FieldMapperLinkChange): void {
        if (change.added === null && change.removed.length === 0) return;
        const animate = !this.noAlign && !this.narrow && this.grid !== null;
        if (animate) this.flip.measure();
        this.links = change.links;
        const selected = this.selectedLink;
        if (selected && change.removed.some((link) => sameLink(link, selected))) this.setSelectedLink(null);
        this.announce(this.describe(change));
        this.realignAfterRender = animate;
        this.dispatchEvent(new CustomEvent<readonly FieldMapperLink[]>('links-change', { detail: change.links, bubbles: true, composed: true }));
    }

    private describe(change: FieldMapperLinkChange): string {
        const t = this.t;
        const parts = change.added ? [t.linked(this.labelOf('start', change.added.startId), this.labelOf('end', change.added.endId))] : [];
        for (const link of change.removed) parts.push(t.unlinked(this.labelOf('start', link.startId), this.labelOf('end', link.endId)));
        return parts.join('. ');
    }

    /** A trailing no-break space that alternates makes a repeated message a text change, so a screen reader reads it again. */
    private announce(message: string): void {
        this.liveToggle = !this.liveToggle;
        this.liveMessage = this.liveToggle ? message : `${message}${NO_BREAK_SPACE}`;
    }

    // ---- picking: tap, click, Enter ---------------------------------------------------------------------

    /** The tap / Enter path: the first pick marks an item as choosing; a pick in the other list links the two; picking it again cancels. */
    pick(side: FieldMapperSide, item: FieldMapperItem): void {
        if (item.disabled) return;
        const pending = this.pending;
        if (pending === null || pending.side === side) {
            this.choose(side, item, pending);
            return;
        }
        this.pending = null;
        if (side === 'end') this.link(pending.id, item.id);
        else this.link(item.id, pending.id);
    }

    private choose(side: FieldMapperSide, item: FieldMapperItem, pending: PickedItem | null): void {
        if (pending?.id === item.id) {
            this.cancel();
            return;
        }
        this.pending = { side, id: item.id };
        this.announce(this.t.choosing(item.label, side === 'start' ? this.endHeadingText : this.startHeadingText));
    }

    /** Drops a pending pick and any selected line. */
    cancel(): void {
        if (this.pending === null && this.selectedLink === null) return;
        this.pending = null;
        if (this.selectedLink) this.setSelectedLink(null);
        this.announce(this.t.cancelled);
    }

    private readonly onItemClick = (side: FieldMapperSide, item: FieldMapperItem) => {
        if (this.suppressClick) return;
        this.setActive(side, item.id);
        this.pick(side, item);
    };

    // ---- selecting a line ---------------------------------------------------------------------------------

    /** Selects a line (or clears the selection with `null`), emits `link-select` and announces it. */
    selectLink(link: FieldMapperLink | null): void {
        this.setSelectedLink(link);
        this.announce(link ? this.t.linkSelected(this.labelOf('start', link.startId), this.labelOf('end', link.endId)) : this.t.cancelled);
    }

    private setSelectedLink(link: FieldMapperLink | null): void {
        this.selectedLink = link;
        this.dispatchEvent(new CustomEvent<FieldMapperLink | null>('link-select', { detail: link, bubbles: true, composed: true }));
    }

    private cycleLinkSelection(side: FieldMapperSide, id: string): void {
        const own = this.linksOf(side, id);
        if (own.length === 0) return;
        const selected = this.selectedLink;
        const index = selected ? own.findIndex((link) => sameLink(link, selected)) : -1;
        this.selectLink(own[(index + 1) % own.length] ?? null);
    }

    // ---- keyboard -----------------------------------------------------------------------------------------

    private onItemKeydown(event: KeyboardEvent, side: FieldMapperSide, item: FieldMapperItem): void {
        const next = navigate(this.visualIds()[side], item.id, event.key);
        if (next !== null) {
            event.preventDefault();
            this.focusItem(side, next);
            return;
        }
        if (this.handleCommandKey(event.key, side, item)) event.preventDefault();
    }

    /** Runs the non-navigation key bindings; returns whether the key was used. */
    private handleCommandKey(key: string, side: FieldMapperSide, item: FieldMapperItem): boolean {
        switch (key) {
            case 'Enter':
            case ' ':
                this.pick(side, item);
                return true;
            case 'Delete':
            case 'Backspace':
                this.removeFromItem(side, item.id);
                return true;
            case 'Escape':
                this.cancel();
                return true;
            default:
                if (key !== this.keyTowardGutter(side)) return false;
                this.cycleLinkSelection(side, item.id);
                return true;
        }
    }

    /** The arrow key that points from a list toward the other one, which mirrors in RTL. */
    private keyTowardGutter(side: FieldMapperSide): string {
        const root = this.root;
        const startOnLeft = !root || getComputedStyle(root).direction !== 'rtl';
        return (side === 'start') === startOnLeft ? 'ArrowRight' : 'ArrowLeft';
    }

    /** Delete on an item: the selected line if it is this item's, otherwise all of its links. */
    private removeFromItem(side: FieldMapperSide, id: string): void {
        const selected = this.selectedLink;
        if (selected && this.linksOf(side, id).some((link) => sameLink(link, selected))) this.unlink(selected);
        else this.unlinkItem(side, id);
    }

    private setActive(side: FieldMapperSide, id: string): void {
        if (this.activeId[side] === id) return;
        this.activeId = { ...this.activeId, [side]: id };
    }

    private focusItem(side: FieldMapperSide, id: string): void {
        const previous = this.itemElement(side, this.tabStops()[side]);
        const next = this.itemElement(side, id);
        this.setActive(side, id);
        // Move the tab stop now, not at the next render: a Tab pressed before then would land on the stale stop in this list.
        previous?.setAttribute('tabindex', '-1');
        next?.setAttribute('tabindex', '0');
        next?.focus();
    }

    // ---- pointer drag -------------------------------------------------------------------------------------

    private onHandlePointerDown(event: PointerEvent, side: FieldMapperSide, item: FieldMapperItem): void {
        if (item.disabled || event.button !== 0 || this.drag) return;
        this.drag = { side, id: item.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, clientX: event.clientX, clientY: event.clientY, moved: false };
        const move = (e: PointerEvent): void => this.onDragMove(e);
        const up = (e: PointerEvent): void => this.onDrop(e);
        const cancel = (e: PointerEvent): void => this.onDragCancel(e);
        const doc = this.ownerDocument;
        doc.addEventListener('pointermove', move);
        doc.addEventListener('pointerup', up);
        doc.addEventListener('pointercancel', cancel);
        this.stopDrag = () => {
            doc.removeEventListener('pointermove', move);
            doc.removeEventListener('pointerup', up);
            doc.removeEventListener('pointercancel', cancel);
        };
    }

    private onDragMove(event: PointerEvent): void {
        const drag = this.drag;
        if (drag?.pointerId !== event.pointerId) return;
        drag.clientX = event.clientX;
        drag.clientY = event.clientY;
        if (!drag.moved) {
            if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
            drag.moved = true;
            this.pending = null;
            this.dragging = { side: drag.side, id: drag.id };
            this.autoScroll = startAutoScroll();
        }
        event.preventDefault();
        this.autoScroll?.update(event.clientX, event.clientY);
        this.scheduleMeasure();
    }

    private onDragCancel(event: PointerEvent): void {
        if (this.drag?.pointerId === event.pointerId) this.endDrag();
    }

    private onDrop(event: PointerEvent): void {
        const drag = this.drag;
        if (drag?.pointerId !== event.pointerId) return;
        this.endDrag();
        if (!drag.moved) return;
        // The click that follows a drag lands on whatever the pointer was released over; it must not count as a tap.
        this.suppressClick = true;
        setTimeout(() => (this.suppressClick = false));
        const target = this.dropTarget(event.clientX, event.clientY, drag.side);
        if (!target) return;
        if (drag.side === 'start') this.link(drag.id, target);
        else this.link(target, drag.id);
    }

    private endDrag(): void {
        this.stopDrag?.();
        this.stopDrag = null;
        this.autoScroll?.stop();
        this.autoScroll = null;
        this.drag = null;
        if (this.dragging !== null) this.dragging = null;
        this.scheduleMeasure();
    }

    /** Id of the item of the other list under the pointer, if any. */
    private dropTarget(x: number, y: number, from: FieldMapperSide): string | null {
        const hit = this.shadowRoot?.elementFromPoint(x, y);
        const item = hit?.closest<HTMLElement>('[data-slot="field-mapper-item"]');
        if (!item || !this.grid?.contains(item)) return null;
        if (item.dataset.side === from || item.getAttribute('aria-disabled') === 'true') return null;
        return item.dataset.id ?? null;
    }

    // ---- narrow layout ------------------------------------------------------------------------------------

    private onPartnerPicked(startId: string, endId: string): void {
        if (endId === '') this.unlinkItem('start', startId);
        else this.link(startId, endId);
    }

    // ---- geometry -----------------------------------------------------------------------------------------

    private get root(): HTMLElement | null {
        return this.shadowRoot?.querySelector<HTMLElement>('.root') ?? null;
    }

    private get grid(): HTMLElement | null {
        return this.shadowRoot?.querySelector<HTMLElement>('.grid') ?? null;
    }

    private onResize(): void {
        const root = this.root;
        if (!root) return;
        const rem = Number.parseFloat(getComputedStyle(this.ownerDocument.documentElement).fontSize) || 16;
        const narrow = root.getBoundingClientRect().width < NARROW_BELOW_REM * rem;
        if (narrow !== this.measuredNarrow) {
            this.pending = null;
            this.measuredNarrow = narrow;
        }
        this.scheduleMeasure();
    }

    /** Batches every reason to re-measure into one frame. */
    private scheduleMeasure(): void {
        if (this.frameHandle || typeof requestAnimationFrame !== 'function') return;
        this.frameHandle = requestAnimationFrame(() => {
            this.frameHandle = 0;
            this.measure();
            if (this.animating) this.scheduleMeasure();
        });
    }

    /** Animates the end list into its new order, redrawing the lines every frame while it moves. */
    private playRealign(): void {
        this.animating = true;
        this.scheduleMeasure();
        void this.flip.play(REALIGN_MS).then(() => {
            this.animating = false;
            this.scheduleMeasure();
        });
    }

    private measure(): void {
        const grid = this.grid;
        if (!grid || this.narrow) {
            if (this.geometry !== EMPTY_GEOMETRY) this.geometry = EMPTY_GEOMETRY;
            return;
        }
        const frame = this.readFrame(grid);
        const lines: FieldMapperLine[] = [];
        for (const link of this.links) {
            const line = this.lineFor(link, frame, this.linkTone?.(link) ?? 'default');
            if (line) lines.push(line);
        }
        const { start, end } = frame.columns;
        this.geometry = {
            width: grid.scrollWidth,
            height: grid.scrollHeight,
            gutter: start && end ? Math.max(0, Math.max(start.left, end.left) - Math.min(start.right, end.right)) : 0,
            lines,
            rubberBand: this.rubberBand(frame),
        };
    }

    private readFrame(grid: HTMLElement): Frame {
        const origin = grid.getBoundingClientRect();
        const handles = new Map<string, Point>();
        for (const handle of grid.querySelectorAll<HTMLElement>('[data-slot="field-mapper-handle"]')) {
            const { side, id } = handle.dataset;
            if (side && id !== undefined) handles.set(handleKey(side as FieldMapperSide, id), centerOf(handle.getBoundingClientRect(), origin));
        }
        const column = (side: FieldMapperSide): DOMRect | null => grid.querySelector(`[data-slot="field-mapper-heading"][data-side="${side}"]`)?.getBoundingClientRect() ?? null;
        const note = (side: FieldMapperSide): number | null => {
            const el = grid.querySelector(`[data-slot="field-mapper-hidden-note"][data-side="${side}"]`);
            return el ? centerOf(el.getBoundingClientRect(), origin).y : null;
        };
        return { origin, handles, columns: { start: column('start'), end: column('end') }, notes: { start: note('start'), end: note('end') } };
    }

    private lineFor(link: FieldMapperLink, frame: Frame, tone: FieldMapperLinkTone): FieldMapperLine | null {
        const from = frame.handles.get(handleKey('start', link.startId)) ?? null;
        const to = frame.handles.get(handleKey('end', link.endId)) ?? null;
        if (from && to) return this.makeLine(link, from, to, tone, false);
        if (from && this.itemById('end', link.endId)) return this.makeLine(link, from, this.edgePoint(frame, 'end', from), tone, true);
        if (to && this.itemById('start', link.startId)) return this.makeLine(link, this.edgePoint(frame, 'start', to), to, tone, true);
        return null;
    }

    /** Where a line to a filtered-out item on `side` ends: that list's inner edge, beside its note. */
    private edgePoint(frame: Frame, side: FieldMapperSide, from: Point): Point {
        const column = frame.columns[side];
        const x = column ? nearestEdge(column, frame.origin, from.x) : from.x;
        return { x, y: frame.notes[side] ?? frame.origin.height };
    }

    private makeLine(link: FieldMapperLink, from: Point, to: Point, tone: FieldMapperLinkTone, toEdge: boolean): FieldMapperLine {
        return {
            key: handleKey('start', link.startId) + handleKey('end', link.endId),
            link,
            path: linkPath(from.x, from.y, to.x, to.y),
            midX: (from.x + to.x) / 2,
            midY: (from.y + to.y) / 2,
            tone,
            toEdge,
        };
    }

    private rubberBand(frame: Frame): string | null {
        const drag = this.drag;
        if (!drag?.moved) return null;
        const from = frame.handles.get(handleKey(drag.side, drag.id));
        if (!from) return null;
        const x = drag.clientX - frame.origin.left;
        const y = drag.clientY - frame.origin.top;
        return drag.side === 'start' ? linkPath(from.x, from.y, x, y) : linkPath(x, y, from.x, from.y);
    }

    private itemElement(side: FieldMapperSide, id: string): HTMLElement | null {
        for (const el of this.grid?.querySelectorAll<HTMLElement>(`[data-slot="field-mapper-item"][data-side="${side}"]`) ?? []) {
            if (el.dataset.id === id) return el;
        }
        return null;
    }

    private endItemElements(): HTMLElement[] {
        return Array.from(this.grid?.querySelectorAll<HTMLElement>('[data-slot="field-mapper-item"][data-side="end"]') ?? []);
    }

    protected override updated(changed: PropertyValues): void {
        const grid = this.grid;
        const target = grid ?? this.root;
        if (target !== this.observedGrid) {
            this.observer?.disconnect();
            if (this.root) this.observer?.observe(this.root);
            if (grid) this.observer?.observe(grid);
            this.observedGrid = target;
            this.onResize();
        }
        if (MEASURED.some((key) => changed.has(key))) this.scheduleMeasure();
        if (this.realignAfterRender) {
            this.realignAfterRender = false;
            this.playRealign();
        }
    }

    // ---- rendering ----------------------------------------------------------------------------------------

    private itemContent(side: FieldMapperSide, item: FieldMapperItem): unknown {
        if (this.renderItem) return this.renderItem(item, { item, side, linked: this.isLinked(side, item.id) });
        return html`<span class="truncate" dir="auto">${item.label}</span>`;
    }

    private renderFilter(side: FieldMapperSide) {
        const heading = side === 'start' ? this.startHeadingText : this.endHeadingText;
        const t = this.t;
        return html`<ge-input
            data-slot="field-mapper-filter"
            .value=${side === 'start' ? this.startQuery : this.endQuery}
            placeholder=${t.filterPlaceholder}
            aria-label=${t.filterLabel(heading)}
            @input=${(event: Event) => {
                const value = (event.target as HTMLInputElement).value;
                if (side === 'start') this.startQuery = value;
                else this.endQuery = value;
            }}
        ></ge-input>`;
    }

    private renderRows(): TemplateResult {
        const t = this.t;
        const hidden = this.hiddenLinked().start;
        return html`<div class="rows" data-slot="field-mapper-rows">
            <div class="rows-head">
                <div id=${this.ids.startHeading} style="font-weight:500" dir="auto">${this.startHeadingText}</div>
                ${this.searchable ? this.renderFilter('start') : nothing}
            </div>
            <ul class="rows-list" aria-labelledby=${this.ids.startHeading}>
                ${repeat(this.startVisible, (item) => item.id, (item) => this.renderRow(item))}
            </ul>
            ${hidden > 0 ? html`<p class="note">${t.hiddenLinked(hidden)}</p>` : nothing}
        </div>`;
    }

    private renderRow(item: FieldMapperItem): TemplateResult {
        const t = this.t;
        const single = this.limits.start === 1;
        const partners = this.partnerIds('start', item.id);
        const options = single ? this.end : this.end.filter((option) => !partners.includes(option.id));
        return html`<li class="row" data-slot="field-mapper-row" data-id=${item.id}>
            <div style="min-width:0" aria-disabled=${item.disabled ? 'true' : nothing}>${this.itemContent('start', item)}</div>
            <span class="row-other" dir="auto" aria-hidden="true">${this.endHeadingText}</span>
            ${!single && partners.length > 0
                ? html`<ul class="chips" aria-label=${this.itemName('start', item)}>
                      ${partners.map(
                          (endId) => html`<li class="chip">
                              <span class="truncate" dir="auto">${this.labelOf('end', endId)}</span>
                              <ge-button variant="ghost" size="icon" aria-label=${t.removeLinkTo(this.labelOf('end', endId))} @click=${() => this.unlink({ startId: item.id, endId })}><ge-icon name="x" size="sm"></ge-icon></ge-button>
                          </li>`,
                      )}
                  </ul>`
                : nothing}
            <ge-native-select
                .value=${single ? (partners.at(0) ?? '') : ''}
                ?disabled=${Boolean(item.disabled)}
                aria-label=${t.pickerLabel(item.label)}
                @change=${(event: Event) => this.onPartnerPicked(item.id, (event.target as HTMLSelectElement).value)}
            >
                <option value="">${single ? t.notLinked : t.addLink}</option>
                ${options.map((option) => html`<option value=${option.id} ?disabled=${Boolean(option.disabled)} dir="auto">${option.label}</option>`)}
            </ge-native-select>
        </li>`;
    }

    private renderHeading(side: FieldMapperSide): TemplateResult {
        const start = side === 'start';
        return html`<div class="heading" style=${`grid-column:${start ? 1 : 3}`} data-slot="field-mapper-heading" data-side=${side}>
            <div class="heading-text" dir="auto" id=${start ? this.ids.startHeading : this.ids.endHeading}>${start ? this.startHeadingText : this.endHeadingText}</div>
            ${this.searchable ? this.renderFilter(side) : nothing}
        </div>`;
    }

    private renderItem_(side: FieldMapperSide, item: FieldMapperItem, row: number, tabStop: string, ids: readonly string[]): TemplateResult {
        const handle = html`<span
            class="handle"
            data-slot="field-mapper-handle"
            data-side=${side}
            data-id=${item.id}
            @pointerdown=${(event: PointerEvent) => this.onHandlePointerDown(event, side, item)}
            ><span class="dot"></span
        ></span>`;
        const content = html`<div class="content">${this.itemContent(side, item)}</div>`;
        const end = side === 'end';
        return html`<div
            role="option"
            class="item"
            style=${`grid-column:${end ? 3 : 1};grid-row:${row}`}
            tabindex=${tabStop === item.id ? 0 : -1}
            aria-label=${this.itemName(side, item)}
            aria-selected=${this.itemState(side, item.id) === 'choosing' ? 'true' : 'false'}
            aria-disabled=${item.disabled ? 'true' : nothing}
            aria-posinset=${end ? ids.indexOf(item.id) + 1 : nothing}
            aria-setsize=${end ? this.endVisible.length : nothing}
            data-slot="field-mapper-item"
            data-side=${side}
            data-id=${item.id}
            data-state=${this.itemState(side, item.id) ?? nothing}
            ?data-linked=${this.isLinked(side, item.id)}
            @click=${() => this.onItemClick(side, item)}
            @focus=${() => this.setActive(side, item.id)}
            @keydown=${(event: KeyboardEvent) => this.onItemKeydown(event, side, item)}
        >
            ${end ? html`${handle}${content}` : html`${content}${handle}`}
        </div>`;
    }

    private renderColumns(): TemplateResult {
        const t = this.t;
        const ids = this.visualIds();
        const stops = this.tabStops();
        const endRows = this.endRows;
        const endRowOf = new Map<string, number>();
        endRows.forEach((item, row) => {
            if (item) endRowOf.set(item.id, row);
        });
        const hidden = this.hiddenLinked();
        const geometry = this.geometry;
        const rowCount = Math.max(this.startVisible.length, endRows.length);
        const listbox = (side: FieldMapperSide, items: TemplateResult[]) => html`<div
            role="listbox"
            class="list"
            aria-labelledby=${side === 'start' ? this.ids.startHeading : this.ids.endHeading}
            aria-describedby=${this.ids.instructions}
            data-slot="field-mapper-list"
            data-side=${side}
        >${items}</div>`;
        return html`<div class="scroll" data-slot="field-mapper-scroll" @scroll=${() => this.drag?.moved && this.scheduleMeasure()}>
            <div class="grid" data-slot="field-mapper-grid" ?data-dragging=${this.dragging !== null}>
                <div class="header" style="grid-column:1 / -1;grid-row:1" data-slot="field-mapper-header">${this.renderHeading('start')}${this.renderHeading('end')}</div>
                <svg class="lines" width=${geometry.width} height=${geometry.height} data-slot="field-mapper-lines" aria-hidden="true">
                    ${geometry.lines.map(
                        (line) => svg`<path class="hit" d=${line.path} data-slot="field-mapper-line-hit" @click=${() => this.selectLink(this.isSelectedLink(line.link) ? null : line.link)}></path><path class="line" d=${line.path} data-slot="field-mapper-line" data-tone=${line.tone} ?data-to-edge=${line.toEdge} ?data-selected=${this.isSelectedLink(line.link)}></path>`,
                    )}
                    ${geometry.rubberBand ? svg`<path class="line" data-tone="strong" d=${geometry.rubberBand} data-slot="field-mapper-rubber-band"></path>` : nothing}
                </svg>
                ${listbox(
                    'start',
                    this.startVisible.map((item, i) => this.renderItem_('start', item, i + HEADER_ROWS + 1, stops.start, ids.start)),
                )}
                ${listbox(
                    'end',
                    this.endVisible.map((item) => this.renderItem_('end', item, (endRowOf.get(item.id) ?? 0) + HEADER_ROWS + 1, stops.end, ids.end)),
                )}
                ${(['start', 'end'] as const).map((side) =>
                    hidden[side]
                        ? html`<p class="note hidden-note" style=${`grid-column:${side === 'start' ? 1 : 3};grid-row:${rowCount + 2}`} data-slot="field-mapper-hidden-note" data-side=${side}>${t.hiddenLinked(hidden[side])}</p>`
                        : nothing,
                )}
                ${geometry.lines.map((line) => this.renderLineLabel(line))}
            </div>
        </div>`;
    }

    private renderLineLabel(line: FieldMapperLine): TemplateResult | typeof nothing {
        const selected = this.isSelectedLink(line.link);
        if (!this.renderLinkLabel && !selected) return nothing;
        const start = this.itemById('start', line.link.startId);
        const end = this.itemById('end', line.link.endId);
        return html`<div class="label" style=${`left:${line.midX}px;top:${line.midY}px;max-width:${this.geometry.gutter}px`} data-slot="field-mapper-link-label">
            ${this.renderLinkLabel && start && end ? html`<div class="label-text" dir="auto">${this.renderLinkLabel(line.link, { link: line.link, start, end })}</div>` : nothing}
            ${selected
                ? html`<ge-button variant="outline" size="icon" aria-label=${this.t.removeLink} @click=${() => this.unlink(line.link)}><ge-icon name="x" size="sm"></ge-icon></ge-button>`
                : nothing}
        </div>`;
    }

    protected override render() {
        const t = this.t;
        return html`<div part="base" class="root" data-slot="field-mapper" dir=${t.rtl ? 'rtl' : nothing} data-layout=${this.narrow ? 'rows' : 'columns'}>
            ${this.narrow ? this.renderRows() : this.renderColumns()}
            <p class="sr-only" id=${this.ids.instructions}>${t.instructions}</p>
            <div class="sr-only" aria-live="polite" aria-atomic="true" data-slot="field-mapper-live">${this.liveMessage}</div>
        </div>`;
    }
}
