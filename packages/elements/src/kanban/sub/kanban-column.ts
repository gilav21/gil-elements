import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, findParent } from '../../shared/compound.js';
import { onContextGesture, type ContextGesture } from '../../shared/touch.js';
import { KANBAN_COLUMN_REGISTER, KANBAN_REGISTER, type KanbanColumnHost, type KanbanHost, type KanbanPart } from '../kanban-types.js';
import { KANBAN_LOCALES, type KanbanLocale } from '../kanban.locales.js';
import css from './kanban-column.css?inline';

const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => (value ? null : 'false') };
const PLUS = html`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>`;
const CHEVRON = html`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6" /></svg>`;

/**
 * One column of the board. On a board with `columns` the board draws these for you. Place them yourself, with
 * `ge-kanban-card` children, for a board you lay out by hand.
 *
 * Drops use HTML5 drag and drop: while a card is dragged over, the column highlights and a line shows the gap the card
 * would drop into, and a drop asks the board to move it there.
 *
 * @slot - `ge-kanban-card`s, in custom mode.
 * @slot header - A `ge-kanban-column-header`, which replaces the built-in header.
 * @attr {string} column-id - Links the column to the board: cards are pulled by their `columnId`, and drops are reported against it.
 * @attr {string} heading - Heading text of the built-in header.
 * @attr {number} wip-limit - A soft cap shown as `/ n` beside the count. Going over it turns the count destructive and the border red; it never blocks a drop.
 * @attr {boolean} collapsible - Shows the chevron that collapses the cards to the header. On by default; `collapsible="false"` hides it.
 * @attr {string} swimlane-id - Narrows the column to one swimlane, so a board with lanes draws one column per lane.
 * @prop {KanbanLocale} locale - Strings for the empty state. The board passes its own down.
 */
export class GeKanbanColumn extends UiElement implements KanbanColumnHost, KanbanPart {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        columnId: { attribute: 'column-id' },
        heading: {},
        wipLimit: { type: Number, attribute: 'wip-limit' },
        collapsible: { converter: defaultTrue },
        locale: { attribute: false },
        swimlaneId: { attribute: 'swimlane-id' },
        collapsed: { state: true },
        dropIndicatorIndex: { state: true },
        dropIndicatorTop: { state: true },
        isDragOver: { state: true },
        hasCustomHeader: { state: true },
        customCardCount: { state: true },
    };

    declare columnId: string;
    declare heading: string;
    declare wipLimit: number | undefined;
    declare collapsible: boolean;
    declare locale: KanbanLocale;
    declare swimlaneId: string | undefined;
    declare collapsed: boolean;
    declare dropIndicatorIndex: number;
    declare dropIndicatorTop: number;
    declare isDragOver: boolean;
    declare hasCustomHeader: boolean;
    declare customCardCount: number;
    private kanban?: KanbanHost;
    private stopGesture?: () => void;
    private dragEnterCount = 0;
    private lastDragOverTime = 0;
    private readonly parts = new Set<KanbanPart>();

    constructor() {
        super();
        this.columnId = '';
        this.heading = '';
        this.wipLimit = undefined;
        this.collapsible = true;
        this.locale = KANBAN_LOCALES['en'] as KanbanLocale;
        this.swimlaneId = undefined;
        this.collapsed = false;
        this.dropIndicatorIndex = -1;
        this.dropIndicatorTop = -1;
        this.isDragOver = false;
        this.hasCustomHeader = false;
        this.customCardCount = 0;
        adoptChildren<KanbanColumnHost, KanbanPart>(this, KANBAN_COLUMN_REGISTER, (part) => this.parts.add(part));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'kanban-column';
        this.kanban = findParent<KanbanHost, GeKanbanColumn>(this, KANBAN_REGISTER);
        this.kanban?.register(this);
        this.addEventListener('dragenter', this.onDragEnter);
        this.addEventListener('dragover', this.onDragOver);
        this.addEventListener('dragleave', this.onDragLeave);
        this.addEventListener('drop', this.onDrop);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('dragenter', this.onDragEnter);
        this.removeEventListener('dragover', this.onDragOver);
        this.removeEventListener('dragleave', this.onDragLeave);
        this.removeEventListener('drop', this.onDrop);
        this.stopGesture?.();
        this.stopGesture = undefined;
        this.kanban?.unregister(this);
        this.kanban = undefined;
    }

    /** The cards that are shown: the board's for this column, or the projected ones in custom mode. */
    private get visibleCards() {
        return this.kanban?.getCardsForColumn(this.columnId, this.swimlaneId) ?? [];
    }

    private get customCards(): HTMLElement[] {
        return [...this.querySelectorAll<HTMLElement>(':scope > ge-kanban-card')];
    }

    private get hasCustomCards(): boolean {
        return this.customCardCount > 0;
    }

    private get cardCount(): number {
        return this.hasCustomCards ? this.customCardCount : this.visibleCards.length;
    }

    private get isOverWipLimit(): boolean {
        return this.wipLimit != null && this.cardCount > this.wipLimit;
    }

    /** Collapses or expands the cards, leaving the header and its counts. A collapsed column cannot be dropped into. */
    toggleCollapse(): void {
        this.collapsed = !this.collapsed;
    }

    private onAddCard(): void {
        this.kanban?.onAddCard(this.columnId);
    }

    /** A right-click, the context-menu key or a long-press on the built-in header opens the board's column menu and claims the gesture. */
    private openHeaderMenu(gesture: ContextGesture): boolean {
        const column = this.kanban?.columns.find((c) => c.id === this.columnId);
        if (column) this.kanban?.showColumnContextMenu(gesture.clientX, gesture.clientY, column);
        return true;
    }

    protected override updated(): void {
        this.toggleAttribute('data-over-limit', this.isOverWipLimit);
        this.toggleAttribute('data-drag-over', this.isDragOver);
        this.dataset.columnId = this.columnId;
        const header = this.renderRoot.querySelector<HTMLElement>('.header');
        if (header !== this.gestureTarget) {
            this.stopGesture?.();
            this.gestureTarget = header ?? undefined;
            this.stopGesture = header ? onContextGesture(header, (gesture) => this.openHeaderMenu(gesture)) : undefined;
        }
        for (const part of this.parts) part.requestUpdate();
    }

    private gestureTarget?: HTMLElement;

    /** Marks the column a drop target, but only while the board reports a card being dragged, so files dragged over the board are left to the page. Enter and leave are counted because crossing between cards fires `dragleave` on the column. */
    private readonly onDragEnter = (event: DragEvent) => {
        if (!this.kanban?.draggedCardId) return;
        event.preventDefault();
        this.dragEnterCount++;
        this.isDragOver = true;
    };

    /** Keeps the drop allowed and puts the insertion line at the gap nearest the pointer, found by comparing `clientY` with each card's midpoint. One measurement per 50ms, since `dragover` fires continuously. */
    private readonly onDragOver = (event: DragEvent) => {
        if (!this.kanban?.draggedCardId) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        const now = performance.now();
        if (now - this.lastDragOverTime < 50) return;
        this.lastDragOverTime = now;
        const container = this.renderRoot.querySelector<HTMLElement>('.cards');
        if (!container) {
            this.dropIndicatorIndex = 0;
            this.dropIndicatorTop = 12;
            return;
        }
        const origin = container.getBoundingClientRect().top;
        const cards = [...container.querySelectorAll<HTMLElement>('ge-kanban-card'), ...this.customCards].filter((c) => c.dataset.slot === 'kanban-card');
        const rects = cards.map((card) => card.getBoundingClientRect());
        const index = this.gapIndex(rects, event.clientY);
        this.dropIndicatorIndex = index;
        this.dropIndicatorTop = this.gapTop(rects, index, origin);
    };

    private gapIndex(rects: DOMRect[], clientY: number): number {
        const hit = rects.findIndex((rect) => clientY < rect.top + rect.height / 2);
        return hit === -1 ? rects.length : hit;
    }

    /** Where the line sits, from the container's top: just above the first card, just below the last, or midway through the gap between two. */
    private gapTop(rects: DOMRect[], index: number, origin: number): number {
        if (rects.length === 0) return 12;
        const first = rects[0] as DOMRect;
        if (index === 0) return first.top - origin - 6;
        const prev = rects[index - 1] as DOMRect;
        if (index >= rects.length) return prev.bottom - origin + 5;
        const curr = rects[index] as DOMRect;
        return prev.bottom - origin + (curr.top - prev.bottom) / 2;
    }

    /** Hides the line and highlight only once the pointer has truly left the column, not merely crossed between cards. */
    private readonly onDragLeave = () => {
        this.dragEnterCount--;
        if (this.dragEnterCount > 0) return;
        this.dragEnterCount = 0;
        this.clearDragVisuals();
    };

    /**
     * Touch has no HTML5 drag events, so the card that follows a finger drives the column through these three: show the
     * drop line for a finger at `clientY`, hide it, and drop the card here. A collapsed column takes nothing.
     */
    hoverCard(clientY: number): void {
        if (this.collapsed || !this.kanban?.draggedCardId) return;
        this.isDragOver = true;
        const container = this.renderRoot.querySelector<HTMLElement>('.cards');
        if (!container) {
            this.dropIndicatorIndex = 0;
            this.dropIndicatorTop = 12;
            return;
        }
        const origin = container.getBoundingClientRect().top;
        const cards = [...container.querySelectorAll<HTMLElement>('ge-kanban-card'), ...this.customCards].filter((c) => c.dataset.slot === 'kanban-card');
        const rects = cards.map((card) => card.getBoundingClientRect());
        const index = this.gapIndex(rects, clientY);
        this.dropIndicatorIndex = index;
        this.dropIndicatorTop = this.gapTop(rects, index, origin);
    }

    /** Hides the drop line and highlight; the finger left the column. */
    leaveCard(): void {
        this.dragEnterCount = 0;
        this.clearDragVisuals();
    }

    /** Moves the card here at the drop line, as a mouse drop would. Returns whether the column took it. */
    dropCard(cardId: string): boolean {
        if (this.collapsed || !this.kanban || this.dropIndicatorIndex < 0) return false;
        this.kanban.moveCard(cardId, this.columnId, this.dropIndicatorIndex, this.swimlaneId);
        this.leaveCard();
        return true;
    }

    private clearDragVisuals(): void {
        this.dropIndicatorIndex = -1;
        this.dropIndicatorTop = -1;
        this.isDragOver = false;
    }

    /** Reads the card id from the transfer and asks the board to move it here at the line's index. The board emits the change; nothing moves until you apply it. */
    private readonly onDrop = (event: DragEvent) => {
        event.preventDefault();
        const cardId = event.dataTransfer?.getData('text/plain');
        if (!cardId || !this.kanban) return;
        this.kanban.moveCard(cardId, this.columnId, this.dropIndicatorIndex, this.swimlaneId);
        this.clearDragVisuals();
        this.dragEnterCount = 0;
    };

    private readonly onHeaderSlot = (event: Event) => {
        this.hasCustomHeader = (event.target as HTMLSlotElement).assignedElements().length > 0;
    };

    private readonly onCardSlot = () => {
        this.customCardCount = this.customCards.length;
    };

    private defaultHeader() {
        const over = this.isOverWipLimit;
        const toggleLabel = this.collapsed ? 'Expand column' : 'Collapse column';
        return html`<div class="header" data-slot="kanban-column-header">
            <div class="heading">
                <h3>${this.heading}</h3>
                <ge-badge class="count" label=${String(this.cardCount)} variant=${over ? 'destructive' : 'secondary'}></ge-badge>
                ${this.wipLimit ? html`<span class="limit">${`/ ${this.wipLimit}`}</span>` : nothing}
            </div>
            <div class="tools">
                <button type="button" class="tool" aria-label="Add card" data-slot="kanban-add-card-button" @click=${() => this.onAddCard()}>${PLUS}</button>
                ${this.collapsible
                    ? html`<button type="button" class="tool" aria-label=${toggleLabel} aria-expanded=${!this.collapsed} @click=${() => this.toggleCollapse()}>${CHEVRON}</button>`
                    : nothing}
            </div>
        </div>`;
    }

    private body() {
        const cards = this.visibleCards;
        let content;
        if (this.hasCustomCards) content = nothing;
        else if (cards.length === 0) {
            content = html`<div class="empty" data-slot="kanban-empty-state">
                <p>${this.locale.noCardsYet}</p>
                <ge-button variant="ghost" size="sm" @click=${() => this.onAddCard()}>${this.locale.addACard}</ge-button>
            </div>`;
        } else {
            content = cards.map((card) => html`<ge-kanban-card .card=${card} card-id=${card.id}></ge-kanban-card>`);
        }
        return html`<ge-scroll-area orientation="vertical">
            <div class="cards">
                <div class="indicator" ?data-active=${this.dropIndicatorIndex >= 0} style="top:${this.dropIndicatorTop}px" data-slot="kanban-drop-indicator">
                    <div><span class="dot"></span><span class="bar"></span><span class="dot"></span></div>
                </div>
                ${content}
                <slot @slotchange=${this.onCardSlot}></slot>
            </div>
        </ge-scroll-area>`;
    }

    protected override render() {
        return html`<slot name="header" @slotchange=${this.onHeaderSlot}></slot>${this.hasCustomHeader ? nothing : this.defaultHeader()}<ge-separator></ge-separator>${this.collapsed ? nothing : this.body()}`;
    }
}
