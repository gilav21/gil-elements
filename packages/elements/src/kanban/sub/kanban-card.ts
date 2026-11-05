import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { readableForeground } from '../../shared/color.js';
import { onContextGesture, type ContextGesture } from '../../shared/touch.js';
import { KANBAN_COLUMN_REGISTER, KANBAN_REGISTER, type KanbanCard, type KanbanColumnHost, type KanbanHost } from '../kanban-types.js';
import css from './kanban-card.css?inline';

/**
 * A card on the board. In simple mode set `card` and it draws the labels, title, description and assignee avatars, with
 * a coloured start border for the priority. Project a `ge-kanban-card-content` for full control; `card` (or `card-id`)
 * is still needed then, since it names the card for dragging and for its context menu.
 *
 * Dragging uses HTML5 drag and drop, which does not fire on touch. A long-press opens the card menu, whose "Move to"
 * submenu moves the card.
 *
 * @slot - A `ge-kanban-card-content`.
 * @attr {string} card-id - Overrides the id that otherwise comes from `card.id`; set it in custom mode when no `card` is bound.
 * @prop {KanbanCard} card - The card to draw.
 */
export class GeKanbanCard extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        card: { attribute: false },
        cardId: { attribute: 'card-id' },
        hasCustomContent: { state: true },
    };

    declare card: KanbanCard | undefined;
    declare cardId: string;
    declare hasCustomContent: boolean;
    private kanban?: KanbanHost;
    private column?: KanbanColumnHost;
    private stopGesture?: () => void;

    constructor() {
        super();
        this.card = undefined;
        this.cardId = '';
        this.hasCustomContent = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'kanban-card';
        this.draggable = true;
        this.kanban = findParent<KanbanHost, GeKanbanCard>(this, KANBAN_REGISTER);
        this.column = findParent<KanbanColumnHost, GeKanbanCard>(this, KANBAN_COLUMN_REGISTER);
        this.kanban?.register(this);
        this.addEventListener('dragstart', this.onDragStart);
        this.addEventListener('dragend', this.onDragEnd);
        this.stopGesture = onContextGesture(this, (gesture) => this.openMenu(gesture));
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('dragstart', this.onDragStart);
        this.removeEventListener('dragend', this.onDragEnd);
        this.stopGesture?.();
        this.kanban?.unregister(this);
        this.kanban = undefined;
        this.column = undefined;
    }

    private get resolvedCardId(): string {
        return this.cardId || this.card?.id || '';
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        void changed;
        const priority = this.card?.priority;
        if (priority) this.dataset.priority = priority;
        else delete this.dataset.priority;
        const id = this.resolvedCardId;
        this.toggleAttribute('data-dragging', id !== '' && this.kanban?.draggedCardId === id);
        this.dataset.cardId = id;
    }

    /** Puts the card id on the transfer as `text/plain` and tells the board a drag is in progress. */
    private readonly onDragStart = (event: DragEvent) => {
        const id = this.resolvedCardId;
        const columnId = this.column?.columnId || this.card?.columnId || '';
        if (!event.dataTransfer || !id) return;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
        this.kanban?.startDrag(id, columnId);
    };

    private readonly onDragEnd = () => this.kanban?.endDrag();

    /** A right-click, the context-menu key or a long-press opens the board's card menu, and claims the gesture so the column and board menus stay shut. */
    private openMenu(gesture: ContextGesture): boolean {
        if (this.card) this.kanban?.showCardContextMenu(gesture.clientX, gesture.clientY, this.card);
        return true;
    }

    private onSlotChange = (event: Event) => {
        const slot = event.target as HTMLSlotElement;
        this.hasCustomContent = slot.assignedElements().some((el) => el.localName === 'ge-kanban-card-content');
    };

    private simple() {
        const card = this.card;
        if (!card) return nothing;
        return html`<div class="simple">
            ${card.labels?.length
                ? html`<div class="labels">
                      ${card.labels.map((label) => html`<ge-badge class="label" label=${label.text} style="background-color:${label.color};color:${readableForeground(label.color)}"></ge-badge>`)}
                  </div>`
                : nothing}
            ${card.title ? html`<p class="title">${card.title}</p>` : nothing}
            ${card.description ? html`<p class="description">${card.description}</p>` : nothing}
            ${card.assignees?.length
                ? html`<div class="assignees">
                      ${card.assignees.map((a) => html`<ge-avatar class="assignee" src=${a.avatar ?? ''} fallback=${a.name.charAt(0).toUpperCase()} alt=${a.name}></ge-avatar>`)}
                  </div>`
                : nothing}
        </div>`;
    }

    protected override render() {
        return html`${this.hasCustomContent ? nothing : this.simple()}<slot @slotchange=${this.onSlotChange}></slot>`;
    }
}
