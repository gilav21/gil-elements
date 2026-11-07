import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent, parentOf } from '../../shared/compound.js';
import { readableForeground } from '../../shared/color.js';
import { onContextGesture, type ContextGesture } from '../../shared/touch.js';
import { KANBAN_COLUMN_REGISTER, KANBAN_REGISTER, type KanbanCard, type KanbanColumnHost, type KanbanHost } from '../kanban-types.js';
import type { GeKanbanColumn } from './kanban-column.js';
import css from './kanban-card.css?inline';

/** How long a finger rests on a card before it lifts, and how far it may drift while resting before the touch counts as a scroll. */
const LIFT_MS = 300;
const SLOP_PX = 10;
const INTERACTIVE = 'button, a, input, textarea, select, [contenteditable]';

interface TouchDrag {
    readonly startX: number;
    readonly startY: number;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout> | undefined;
    lifted: boolean;
    moved: boolean;
    ghost: HTMLElement | undefined;
    column: GeKanbanColumn | undefined;
    /** Scrollable ancestors held still while the card is lifted, with the `overflow` they had. */
    frozen: { readonly el: HTMLElement; readonly overflow: string }[];
}

/** The element under a viewport point, looking through every shadow root on the way down. */
function deepElementFromPoint(x: number, y: number): Element | null {
    let found = document.elementFromPoint(x, y);
    while (found?.shadowRoot) {
        const inner = found.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === found) break;
        found = inner;
    }
    return found;
}

/** The nearest `ge-kanban-column` above `node`, crossing shadow roots. */
function columnAbove(node: Element | null): GeKanbanColumn | undefined {
    let current: Node | null = node;
    while (current) {
        if (current instanceof Element && current.localName === 'ge-kanban-column') return current as GeKanbanColumn;
        current = parentOf(current);
    }
    return undefined;
}

/**
 * A card on the board. In simple mode set `card` and it draws the labels, title, description and assignee avatars, with
 * a coloured start border for the priority. Project a `ge-kanban-card-content` for full control; `card` (or `card-id`)
 * is still needed then, since it names the card for dragging and for its context menu.
 *
 * A mouse drags with HTML5 drag and drop. A finger rests on the card for a moment and it lifts (a short buzz, where the
 * device has one): drag it onto a column to move it there, or let go without moving to open the card menu, whose "Move
 * to" submenu also moves the card. A finger that moves before the card lifts just scrolls the board.
 *
 * @slot - A `ge-kanban-card-content`.
 * @attr {string} card-id - Overrides the id that otherwise comes from `card.id`; set it in custom mode when no `card` is bound.
 * @prop {KanbanCard} card - The card to draw.
 */
export class GeKanbanCard extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        card: { attribute: false },
        cardId: { attribute: 'card-id' },
        hasCustomContent: { state: true },
    };

    declare card: KanbanCard | undefined;
    declare cardId: string;
    declare hasCustomContent: boolean;
    private kanban?: KanbanHost;
    private stopGesture?: () => void;
    private touchDrag: TouchDrag | undefined;
    private touchEndedAt = 0;

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
        // The request is the registration: the column that answers it adopts this card.
        findParent<KanbanColumnHost, GeKanbanCard>(this, KANBAN_COLUMN_REGISTER);
        this.kanban?.register(this);
        this.addEventListener('dragstart', this.onDragStart);
        this.addEventListener('dragend', this.onDragEnd);
        this.stopGesture = onContextGesture(this, (gesture) => this.openMenu(gesture));
        this.addEventListener('touchstart', this.onTouchStart, { passive: true });
        // Capture, and before the gesture helper's own listener: the browser's long-press `contextmenu` is the lift's, not a menu request.
        this.addEventListener('contextmenu', this.onTouchContextMenu, true);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('dragstart', this.onDragStart);
        this.removeEventListener('dragend', this.onDragEnd);
        this.stopGesture?.();
        this.removeEventListener('touchstart', this.onTouchStart);
        this.removeEventListener('contextmenu', this.onTouchContextMenu, true);
        this.endTouch();
        this.kanban?.unregister(this);
        this.kanban = undefined;
    }

    private get resolvedCardId(): string {
        return this.cardId || this.card?.id || '';
    }

    protected override willUpdate(): void {
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
        if (!event.dataTransfer || !id) return;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
        this.kanban?.startDrag(id);
    };

    private readonly onDragEnd = () => this.kanban?.endDrag();

    /** A right-click, the context-menu key or a long-press opens the board's card menu, and claims the gesture so the column and board menus stay shut. */
    private openMenu(gesture: ContextGesture): boolean {
        // A finger's hold belongs to the lift (see `onTouchStart`); the menu opens when it lets go without dragging.
        if (gesture.viaTouch) return false;
        if (this.card) this.kanban?.showCardContextMenu(gesture.clientX, gesture.clientY, this.card);
        return true;
    }

    // ---- touch drag ---------------------------------------------------------------------------------------

    private readonly onTouchContextMenu = (event: MouseEvent) => {
        // The browser's long-press `contextmenu` can arrive just after the finger is up.
        if (!this.touchDrag && Date.now() - this.touchEndedAt > 700) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    private readonly onTouchStart = (event: TouchEvent) => {
        this.endTouch();
        const finger = event.touches[0];
        if (event.touches.length !== 1 || !finger || !this.resolvedCardId) return;
        if ((event.target as Element | null)?.closest(INTERACTIVE)) return;
        // A card that is draggable would be picked up by the browser after its own hold, on top of ours.
        this.draggable = false;
        const drag: TouchDrag = { startX: finger.clientX, startY: finger.clientY, x: finger.clientX, y: finger.clientY, timer: undefined, lifted: false, moved: false, ghost: undefined, column: undefined, frozen: [] };
        drag.timer = setTimeout(() => this.lift(drag), LIFT_MS);
        this.touchDrag = drag;
        globalThis.addEventListener('touchmove', this.onTouchMove, { passive: false });
        globalThis.addEventListener('touchend', this.onTouchEnd);
        globalThis.addEventListener('touchcancel', this.onTouchCancel);
    };

    /** The hold finished without the finger straying: pick the card up. */
    private lift(drag: TouchDrag): void {
        drag.timer = undefined;
        drag.lifted = true;
        this.kanban?.startDrag(this.resolvedCardId);
        drag.frozen = this.freezeScrolling();
        drag.ghost = this.makeGhost();
        this.moveGhost(drag);
        globalThis.navigator?.vibrate?.(12);
    }

    /**
     * The browser may already be deciding to scroll the board under the finger, and a scroll that has started cannot be
     * cancelled. Every scrollable ancestor is held still for the length of the drag instead.
     */
    private freezeScrolling(): TouchDrag['frozen'] {
        const frozen: TouchDrag['frozen'] = [];
        let parent = parentOf(this);
        while (parent) {
            if (parent instanceof HTMLElement && parent !== document.body && parent !== document.documentElement) {
                const { overflowX, overflowY } = getComputedStyle(parent);
                if (/auto|scroll/.test(overflowX + overflowY)) {
                    frozen.push({ el: parent, overflow: parent.style.overflow });
                    parent.style.overflow = 'hidden';
                }
            }
            parent = parentOf(parent);
        }
        return frozen;
    }

    /** A light stand-in that follows the finger; the card itself stays where it was, dimmed by `data-dragging`. */
    private makeGhost(): HTMLElement {
        const rect = this.getBoundingClientRect();
        const ghost = document.createElement('div');
        ghost.dataset.slot = 'kanban-touch-ghost';
        ghost.setAttribute('aria-hidden', 'true');
        ghost.textContent = this.card?.title ?? '';
        ghost.style.cssText = `position:fixed;z-index:2147483000;left:0;top:0;width:${rect.width}px;min-height:${Math.min(rect.height, 96)}px;box-sizing:border-box;padding:.5rem .75rem;pointer-events:none;overflow:hidden;font:inherit;font-size:.875rem;font-weight:500;border-radius:var(--radius, .5rem);border:1px solid var(--primary, currentColor);background:var(--card, canvas);color:var(--card-foreground, canvastext);box-shadow:0 12px 32px -8px rgb(0 0 0 / .35);opacity:.95;transform-origin:center`;
        document.body.append(ghost);
        return ghost;
    }

    private moveGhost(drag: TouchDrag): void {
        const ghost = drag.ghost;
        if (!ghost) return;
        const width = ghost.offsetWidth;
        ghost.style.transform = `translate(${drag.x - width / 2}px, ${drag.y - 16}px) rotate(1.5deg)`;
    }

    private readonly onTouchMove = (event: TouchEvent) => {
        const drag = this.touchDrag;
        const finger = event.touches[0];
        if (!drag || !finger) return;
        drag.x = finger.clientX;
        drag.y = finger.clientY;
        const travelled = Math.hypot(drag.x - drag.startX, drag.y - drag.startY);
        if (!drag.lifted) {
            // Moving before the hold is up is a scroll (or a second finger a pinch): leave the browser to it.
            if (travelled > SLOP_PX || event.touches.length !== 1) this.endTouch();
            return;
        }
        if (event.cancelable) event.preventDefault();
        if (travelled > SLOP_PX) drag.moved = true;
        this.moveGhost(drag);
        this.hoverColumn(drag);
    };

    private hoverColumn(drag: TouchDrag): void {
        const column = columnAbove(deepElementFromPoint(drag.x, drag.y));
        if (column !== drag.column) drag.column?.leaveCard();
        drag.column = column;
        column?.hoverCard(drag.y);
    }

    private readonly onTouchEnd = () => {
        const drag = this.touchDrag;
        if (!drag) return;
        const id = this.resolvedCardId;
        if (drag.lifted) {
            this.swallowClick();
            if (drag.moved) {
                if (!(drag.column?.dropCard(id) ?? false)) this.kanban?.endDrag();
            } else {
                this.kanban?.endDrag();
                if (this.card) this.kanban?.showCardContextMenu(drag.x, drag.y, this.card);
            }
        }
        this.endTouch();
    };

    private readonly onTouchCancel = () => {
        if (this.touchDrag?.lifted) this.kanban?.endDrag();
        this.endTouch();
    };

    /** The release of a lifted card is not a tap: the click that follows must not open anything under the finger. */
    private swallowClick(): void {
        const stop = (event: Event) => {
            event.stopPropagation();
            event.preventDefault();
            globalThis.removeEventListener('click', stop, true);
        };
        globalThis.addEventListener('click', stop, true);
        setTimeout(() => globalThis.removeEventListener('click', stop, true), 400);
    }

    private endTouch(): void {
        const drag = this.touchDrag;
        if (!drag) return;
        clearTimeout(drag.timer);
        drag.ghost?.remove();
        drag.column?.leaveCard();
        for (const { el, overflow } of drag.frozen) el.style.overflow = overflow;
        this.touchEndedAt = Date.now();
        this.touchDrag = undefined;
        globalThis.removeEventListener('touchmove', this.onTouchMove);
        globalThis.removeEventListener('touchend', this.onTouchEnd);
        globalThis.removeEventListener('touchcancel', this.onTouchCancel);
        // Let the browser's own pending events settle before the card is draggable for a mouse again.
        setTimeout(() => {
            if (!this.touchDrag) this.draggable = true;
        }, 0);
    }

    private readonly onSlotChange = (event: Event) => {
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
