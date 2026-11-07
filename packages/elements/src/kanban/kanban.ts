import { html, nothing, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import { isEditable } from '../shared/shortcut.js';
import { shortcutBindings, type ShortcutComponentHandle } from '../shared/shortcut-bindings.js';
import { onContextGesture, type ContextGesture } from '../shared/touch.js';
import type { ContextMenuItem, GeContextMenu } from '../context-menu/context-menu.js';
import {
    KANBAN_REGISTER,
    type KanbanCard,
    type KanbanCardAddEvent,
    type KanbanCardMoveEvent,
    type KanbanColumn,
    type KanbanColumnDeleteEvent,
    type KanbanHistoryState,
    type KanbanHost,
    type KanbanPart,
    type KanbanSwimlane,
    type KanbanSwimlaneBy,
    type KanbanColumnDialogMode,
} from './kanban-types.js';
import { resolveKanbanLocale, type KanbanLocale } from './kanban.locales.js';
import type { GeKanbanCardDialog, KanbanCardDialogSubmit } from './sub/kanban-card-dialog.js';
import type { GeKanbanColumnDialog, KanbanColumnDialogSubmit } from './sub/kanban-column-dialog.js';
import type { GeKanbanDeleteColumnDialog } from './sub/kanban-delete-column-dialog.js';
import css from './kanban.css?inline';

export * from './kanban-types.js';

interface HistorySnapshot {
    cards: KanbanCard[];
    columns: KanbanColumn[];
}

interface PendingDelete {
    card: KanbanCard;
    timeoutId: ReturnType<typeof setTimeout>;
    countdownIntervalId: ReturnType<typeof setInterval>;
}

const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => (value ? null : 'false') };
const DELETE_DURATION = 6000;
const MAX_HISTORY = 50;
const CHEVRON = html`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>`;
const CLOSE = html`<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`;

/**
 * A kanban board: columns of cards you drag between columns, with context menus, dialogs to add and edit, WIP limits,
 * swimlanes, search, undo and redo, and a soft delete with an undo toast.
 *
 * The board is controlled. It never changes `columns` or `cards`: every change leaves as an event carrying the next
 * array (or, for adds, edits and column changes, the data), and nothing moves until you assign it back.
 *
 * Set `columns` and `cards` and the board draws everything. For a board you lay out by hand, put `ge-kanban-column`
 * children in it; the menus, dialogs, undo and drag coordination still come from the board.
 *
 * Right-click (or long-press) a card for edit, duplicate, move, priority and delete; a column header for add card, rename,
 * WIP limit, move and delete; empty board space for add column. Mod+Z undoes and Mod+Shift+Z redoes (not while typing in a field).
 *
 * @slot - `ge-kanban-column`s, for a board you lay out by hand.
 * @attr {string} search-term - Case-insensitive filter over each card's title, description and label texts. Hidden cards drop out of the count badge, and so out of the WIP-limit check.
 * @attr {string} swimlane-by - Groups cards into horizontal swimlanes by the named card property; a drag across lanes rewrites that property. Set the property to a function to derive lanes instead (a cross-lane drop then only changes the column).
 * @attr {boolean} have-labels - Shows the label editor in the card dialog. On by default; `have-labels="false"` hides it.
 * @attr {boolean} have-assignees - Shows the assignee editor in the card dialog. On by default; `have-assignees="false"` hides it.
 * @attr {string} locale - Locale id or object; defaults to the page's `lang`, then `en`. A right-to-left locale mirrors the board.
 * @prop {KanbanColumn[]} columns - `{ id, title, wipLimit?, order }`, in any order; the board sorts by `order`.
 * @prop {KanbanCard[]} cards - Every card; each is placed by `columnId` and sorted by `order`.
 * @prop {(id: string) => string} swimlaneLabel - Maps a lane id to its heading. Defaults to the id, with the empty lane called "Unassigned".
 * @prop {string[]} initiallyCollapsedSwimlanes - Lanes collapsed on first render.
 * @prop {{ name: string, avatar?: string }[]} assigneeOptions - Known assignees for the card dialog; with any, the field is a multi-select that keeps their avatars.
 * @fires cards-change - The next `cards` array after a move, delete, undo or redo.
 * @fires columns-change - The next `columns` array after a column move, undo or redo.
 * @fires card-moved - Alongside `cards-change` when a card changes position; `detail` is `{ cardId, fromColumnId, toColumnId, newOrder }` (plus the lane ids with swimlanes).
 * @fires card-added - A card was created or duplicated; `detail` has no `id`: mint one and add it yourself.
 * @fires card-updated - `detail` is the whole edited card; replace the matching entry.
 * @fires card-deleted - `detail` is the card id, once the undo toast has expired or been dismissed; `cards-change` already removed it.
 * @fires column-added - `detail` is `{ title, wipLimit?, order }` with no `id`.
 * @fires column-updated - `detail` is the whole column after a rename or WIP-limit change.
 * @fires column-deleted - `detail` is `{ columnId, moveCardsTo? }`; remove the column yourself and move or drop its cards.
 * @fires history-change - `detail` is `{ canUndo, canRedo }`.
 */
export class GeKanban extends UiElement implements KanbanHost {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        columns: { attribute: false },
        cards: { attribute: false },
        searchTerm: { attribute: 'search-term' },
        swimlaneBy: { attribute: 'swimlane-by' },
        swimlaneLabel: { attribute: false },
        initiallyCollapsedSwimlanes: { attribute: false },
        locale: {},
        haveLabels: { attribute: 'have-labels', converter: defaultTrue },
        haveAssignees: { attribute: 'have-assignees', converter: defaultTrue },
        assigneeOptions: { attribute: false },
        draggedCardId: { state: true },
        hasCustomColumns: { state: true },
        collapsedSwimlanes: { state: true },
        deleteToast: { state: true },
    };

    declare columns: KanbanColumn[];
    declare cards: KanbanCard[];
    declare searchTerm: string;
    declare swimlaneBy: KanbanSwimlaneBy;
    declare swimlaneLabel: ((id: string) => string) | null;
    declare initiallyCollapsedSwimlanes: readonly string[];
    declare locale: string | KanbanLocale;
    declare haveLabels: boolean;
    declare haveAssignees: boolean;
    declare assigneeOptions: { name: string; avatar?: string }[];
    /** The id of the card being dragged, or `null`. */
    declare draggedCardId: string | null;
    declare hasCustomColumns: boolean;
    /** Ids of the lanes currently collapsed. */
    declare collapsedSwimlanes: ReadonlySet<string>;
    declare deleteToast: { title: string; countdown: number } | null;

    private readonly parts = new Set<KanbanPart>();
    private readonly undoStack: HistorySnapshot[] = [];
    private redoStack: HistorySnapshot[] = [];
    private readonly pendingDeletes = new Map<string, PendingDelete>();
    private seeded = false;
    private surface?: HTMLElement;
    private stopSurfaceGesture?: () => void;

    constructor() {
        super();
        this.columns = [];
        this.cards = [];
        this.searchTerm = '';
        this.swimlaneBy = null;
        this.swimlaneLabel = null;
        this.initiallyCollapsedSwimlanes = [];
        this.locale = '';
        this.haveLabels = true;
        this.haveAssignees = true;
        this.assigneeOptions = [];
        this.draggedCardId = null;
        this.hasCustomColumns = false;
        this.collapsedSwimlanes = new Set();
        this.deleteToast = null;
        adoptChildren<KanbanHost, KanbanPart>(this, KANBAN_REGISTER, (part) => this.register(part));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.shortcuts = shortcutBindings.registerComponent('kanban', [
            { actionId: 'kanban.undo', description: 'Undo last action', defaultShortcut: 'Mod+Z', category: 'Kanban', scope: 'global', when: this.canHandleKey, handler: () => this.undo() },
            { actionId: 'kanban.redo', description: 'Redo last action', defaultShortcut: 'Mod+Shift+Z', category: 'Kanban', scope: 'global', when: this.canHandleKey, handler: () => this.redo() },
        ]);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.shortcuts?.unregister();
        this.shortcuts = undefined;
        this.stopSurfaceGesture?.();
        this.stopSurfaceGesture = undefined;
        this.surface = undefined;
        this.cancelAllPendingDeletes();
    }

    register(part: KanbanPart): void {
        this.parts.add(part);
    }

    unregister(part: KanbanPart): void {
        this.parts.delete(part);
    }

    private get text(): KanbanLocale {
        return resolveKanbanLocale(this.locale);
    }

    private shortcuts?: ShortcutComponentHandle;

    /** Undo and redo must not steal the browser's own undo from a text field. */
    private readonly canHandleKey = (event: KeyboardEvent) => !isEditable(event.composedPath()[0] ?? null);

    // ---- derived data -------------------------------------------------------------------------------------

    /** The columns sorted by `order`. */
    get sortedColumns(): KanbanColumn[] {
        return [...this.columns].sort((a, b) => a.order - b.order);
    }

    private get filteredCards(): KanbanCard[] {
        const term = this.searchTerm.toLowerCase().trim();
        if (!term) return this.cards;
        return this.cards.filter(
            (card) =>
                card.title.toLowerCase().includes(term) ||
                (card.description?.toLowerCase().includes(term) ?? false) ||
                (card.labels?.some((l) => l.text.toLowerCase().includes(term)) ?? false),
        );
    }

    /** `true` when `swimlaneBy` is set and the board draws lane bands. */
    get hasSwimlanes(): boolean {
        return this.swimlaneBy !== null && this.swimlaneBy !== '';
    }

    /** One card's lane id: `''` when it has no value, or when swimlanes are off. */
    swimlaneIdOf(card: KanbanCard): string {
        const by = this.swimlaneBy;
        if (by === null || by === '') return '';
        if (typeof by === 'function') return by(card) || '';
        const value: unknown = Reflect.get(card, by);
        return typeof value === 'string' ? value : '';
    }

    /** The lanes to draw, in first-seen order with the unnamed lane last, from the filtered cards, so a lane whose cards are all filtered out goes with them. */
    get swimlanes(): KanbanSwimlane[] {
        if (!this.hasSwimlanes) return [];
        const counts = new Map<string, number>();
        for (const card of this.filteredCards) {
            const id = this.swimlaneIdOf(card);
            counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        const named: KanbanSwimlane[] = [];
        let unnamed: KanbanSwimlane | null = null;
        for (const [id, count] of counts) {
            const lane = { id, label: this.swimlaneLabelFor(id), count };
            if (id === '') unnamed = lane;
            else named.push(lane);
        }
        return unnamed === null ? named : [...named, unnamed];
    }

    private swimlaneLabelFor(id: string): string {
        if (this.swimlaneLabel !== null) return this.swimlaneLabel(id);
        return id === '' ? (this.text.unassigned ?? 'Unassigned') : id;
    }

    isSwimlaneCollapsed(id: string): boolean {
        return this.collapsedSwimlanes.has(id);
    }

    /** Collapses or expands one lane, leaving the others alone. */
    toggleSwimlane(id: string): void {
        const next = new Set(this.collapsedSwimlanes);
        if (!next.delete(id)) next.add(id);
        this.collapsedSwimlanes = next;
    }

    /** The column's cards after the search filter, sorted by `order`; `swimlaneId` narrows them to one lane. */
    getCardsForColumn(columnId: string, swimlaneId?: string): KanbanCard[] {
        const inColumn = this.filteredCards.filter((c) => c.columnId === columnId);
        const scoped = swimlaneId === undefined ? inColumn : inColumn.filter((c) => this.swimlaneIdOf(c) === swimlaneId);
        return scoped.sort((a, b) => a.order - b.order);
    }

    // ---- drag and drop ------------------------------------------------------------------------------------

    /** Marks a card as being dragged, so columns accept drops and the source card dims. Called from the card's `dragstart`. */
    startDrag(cardId: string): void {
        this.draggedCardId = cardId;
    }

    /** Clears the drag state; runs on `dragend` and after a move, so a cancelled drag leaves nothing behind. */
    endDrag(): void {
        this.draggedCardId = null;
    }

    /**
     * Places a card at `newOrder` in `toColumnId`, pushing the cards at or after that index down by one. Emits
     * `cards-change` with the next array and `card-moved`, records an undo step and ends the drag, but does not change
     * `cards`. An unknown `cardId` does nothing.
     */
    moveCard(cardId: string, toColumnId: string, newOrder: number, toSwimlaneId?: string): void {
        const card = this.cards.find((c) => c.id === cardId);
        if (!card) return;
        this.captureSnapshot();
        const fromColumnId = card.columnId;
        const fromSwimlaneId = this.swimlaneIdOf(card);
        const updated = this.cards.map((c) => {
            if (c.id === cardId) return this.relocate(c, toColumnId, newOrder, toSwimlaneId);
            if (c.columnId === toColumnId && c.order >= newOrder) return { ...c, order: c.order + 1 };
            return c;
        });
        this.emit('cards-change', updated);
        this.emit<KanbanCardMoveEvent>(
            'card-moved',
            this.hasSwimlanes
                ? { cardId, fromColumnId, toColumnId, newOrder, fromSwimlaneId, toSwimlaneId: toSwimlaneId ?? fromSwimlaneId }
                : { cardId, fromColumnId, toColumnId, newOrder },
        );
        this.endDrag();
    }

    /** The lane field is rewritten only when `swimlaneBy` is a property name: a derived lane cannot be inverted. */
    private relocate(card: KanbanCard, toColumnId: string, newOrder: number, toSwimlaneId?: string): KanbanCard {
        const moved: KanbanCard = { ...card, columnId: toColumnId, order: newOrder };
        const by = this.swimlaneBy;
        if (toSwimlaneId === undefined || typeof by !== 'string' || by === '') return moved;
        return Object.assign(moved, { [by]: toSwimlaneId });
    }

    // ---- context menus ------------------------------------------------------------------------------------

    private menu(name: string): GeContextMenu | null {
        return this.renderRoot.querySelector<GeContextMenu>(`ge-context-menu[data-menu="${name}"]`);
    }

    /** Opens the card menu at viewport coordinates; call it from your own trigger, such as a kebab button. */
    showCardContextMenu(x: number, y: number, card: KanbanCard): void {
        const menu = this.menu('card');
        if (!menu) return;
        menu.items = this.cardMenuItems(card);
        menu.show(x, y, card);
    }

    /** Opens the column menu at viewport coordinates. */
    showColumnContextMenu(x: number, y: number, column: KanbanColumn): void {
        const menu = this.menu('column');
        if (!menu) return;
        menu.items = this.columnMenuItems(column);
        menu.show(x, y, column);
    }

    /** The board menu: a right-click, the context-menu key or a long-press on empty board space. Gestures inside a column are the column's and card's. */
    private openBoardMenu(gesture: ContextGesture): boolean {
        if (gesture.path.some((node) => node instanceof Element && node.localName === 'ge-kanban-column')) return false;
        this.menu('board')?.show(gesture.clientX, gesture.clientY);
        return true;
    }

    private cardMenuItems(card: KanbanCard): ContextMenuItem[] {
        const l = this.text;
        const priorities: { label: string; value: NonNullable<KanbanCard['priority']> | 'none' }[] = [
            { label: l.priorityLow, value: 'low' },
            { label: l.priorityMedium, value: 'medium' },
            { label: l.priorityHigh, value: 'high' },
            { label: l.priorityUrgent, value: 'urgent' },
            { label: l.priorityNone, value: 'none' },
        ];
        return [
            { label: l.editCardMenu, click: () => this.onEditCard(card) },
            { label: l.duplicateCard, click: () => this.onDuplicateCard(card) },
            {
                type: 'sub',
                label: l.moveTo,
                children: this.sortedColumns.map((col) => ({ label: col.title, disabled: col.id === card.columnId, click: () => this.onMoveCardToColumn(card, col.id) })),
            },
            { type: 'sub', label: l.setPriority, children: priorities.map((p) => ({ label: p.label, click: () => this.onSetCardPriority(card, p.value) })) },
            { type: 'separator' },
            { label: l.deleteCardMenu, variant: 'destructive', click: () => this.onDeleteCard(card) },
        ];
    }

    private columnMenuItems(column: KanbanColumn): ContextMenuItem[] {
        const l = this.text;
        return [
            { label: l.addCardMenu, click: () => this.onAddCard(column.id) },
            { type: 'separator' },
            { label: l.renameColumnMenu, click: () => this.onRenameColumn(column) },
            { label: l.setWipLimitMenu, click: () => this.onSetWipLimit(column) },
            { type: 'separator' },
            { label: l.moveLeft, disabled: this.isFirstColumn(column), click: () => this.onMoveColumnLeft(column) },
            { label: l.moveRight, disabled: this.isLastColumnCheck(column), click: () => this.onMoveColumnRight(column) },
            { type: 'separator' },
            { label: l.deleteColumnMenu, variant: 'destructive', click: () => this.onDeleteColumn(column) },
        ];
    }

    /** Whether the column is leftmost in `order`, so it cannot move further left. */
    isFirstColumn(column: KanbanColumn | undefined): boolean {
        if (!column) return true;
        return this.sortedColumns[0]?.id === column.id;
    }

    /** Whether the column is rightmost in `order`. */
    isLastColumnCheck(column: KanbanColumn | undefined): boolean {
        if (!column) return true;
        return this.sortedColumns.at(-1)?.id === column.id;
    }

    // ---- card actions -------------------------------------------------------------------------------------

    private dialog<T extends HTMLElement>(name: string): T | null {
        return this.renderRoot.querySelector<T>(`[data-dialog="${name}"]`);
    }

    /** Opens the card dialog to add a card to `columnId`. Saving fires `card-added`. */
    onAddCard(columnId?: string): void {
        if (!columnId) return;
        this.dialog<GeKanbanCardDialog>('card')?.open('add', columnId);
    }

    /** Opens the card dialog prefilled from `card`. Saving fires `card-updated` with the merged card. */
    onEditCard(card: KanbanCard | undefined): void {
        if (!card) return;
        this.dialog<GeKanbanCardDialog>('card')?.open('edit', card.columnId, card);
    }

    /** Fires `card-added` for a copy of `card` in the same column, titled "… (copy)". You mint the id and add it. */
    onDuplicateCard(card: KanbanCard | undefined): void {
        if (!card) return;
        this.captureSnapshot();
        this.emit<KanbanCardAddEvent>('card-added', {
            columnId: card.columnId,
            title: `${card.title} (copy)`,
            description: card.description,
            priority: card.priority,
            labels: card.labels ? [...card.labels] : undefined,
            assignees: card.assignees ? [...card.assignees] : undefined,
        });
    }

    /** Moves `card` to the end of `targetColumnId`: `cards-change` and `card-moved`. This is the way to move a card on touch, where drag and drop does not fire. */
    onMoveCardToColumn(card: KanbanCard | undefined, targetColumnId: string): void {
        if (!card || card.columnId === targetColumnId) return;
        this.captureSnapshot();
        const newOrder = this.getCardsForColumn(targetColumnId).length;
        this.emit(
            'cards-change',
            this.cards.map((c) => (c.id === card.id ? { ...c, columnId: targetColumnId, order: newOrder } : c)),
        );
        this.emit<KanbanCardMoveEvent>('card-moved', { cardId: card.id, fromColumnId: card.columnId, toColumnId: targetColumnId, newOrder });
    }

    /** Fires `card-updated` with the new priority; `'none'` clears it. */
    onSetCardPriority(card: KanbanCard | undefined, priority: KanbanCard['priority'] | 'none'): void {
        if (!card) return;
        this.captureSnapshot();
        this.emit<KanbanCard>('card-updated', { ...card, priority: priority === 'none' ? undefined : priority });
    }

    /**
     * Soft-deletes a card: `cards-change` without it at once, and a six-second undo toast. `card-deleted`, the signal to
     * delete for real, waits until the countdown ends or the toast is dismissed. Only one delete can be pending; a
     * second finalizes the first.
     */
    onDeleteCard(card: KanbanCard | undefined): void {
        if (!card) return;
        this.captureSnapshot();
        this.emit(
            'cards-change',
            this.cards.filter((c) => c.id !== card.id),
        );
        this.finalizePendingDeletes();
        const total = Math.ceil(DELETE_DURATION / 1000);
        this.deleteToast = { title: card.title, countdown: total };
        const countdownIntervalId = setInterval(() => {
            if (this.deleteToast) this.deleteToast = { ...this.deleteToast, countdown: Math.max(0, this.deleteToast.countdown - 1) };
        }, 1000);
        const timeoutId = setTimeout(() => {
            this.pendingDeletes.delete(card.id);
            this.deleteToast = null;
            clearInterval(countdownIntervalId);
            this.emit('card-deleted', card.id);
        }, DELETE_DURATION);
        this.pendingDeletes.set(card.id, { card, timeoutId, countdownIntervalId });
    }

    /** The toast's Undo: cancels the pending delete and puts the card back at the end of `cards`. `card-deleted` never fires, and the delete's undo step is dropped. */
    undoCardDelete(): void {
        const entry = [...this.pendingDeletes.entries()].pop();
        if (!entry) return;
        const [cardId, pending] = entry;
        clearTimeout(pending.timeoutId);
        clearInterval(pending.countdownIntervalId);
        this.pendingDeletes.delete(cardId);
        this.deleteToast = null;
        this.emit('cards-change', [...this.cards, pending.card]);
        this.undoStack.pop();
        this.emitHistoryState();
    }

    /** The toast's close button: gives up the undo window and finalizes every pending delete, firing `card-deleted` for each. */
    dismissDeleteToast(): void {
        this.finalizePendingDeletes();
    }

    /** Ends the undo window of every pending delete now. A delete whose timer is cancelled without this would never be reported, and the consumer would not know to delete it for real. */
    private finalizePendingDeletes(): void {
        this.deleteToast = null;
        for (const [cardId, pending] of this.pendingDeletes) {
            clearTimeout(pending.timeoutId);
            clearInterval(pending.countdownIntervalId);
            this.pendingDeletes.delete(cardId);
            this.emit('card-deleted', cardId);
        }
    }

    // ---- column actions -----------------------------------------------------------------------------------

    /** Opens the column dialog to add a column. Saving fires `column-added`. */
    onAddColumn(): void {
        this.dialog<GeKanbanColumnDialog>('column')?.openAddColumn();
    }

    onRenameColumn(column: KanbanColumn | undefined): void {
        if (column) this.dialog<GeKanbanColumnDialog>('column')?.openRenameColumn(column);
    }

    /** Opens the WIP-limit dialog. An empty or non-positive entry clears the limit; going over a limit only restyles the column. */
    onSetWipLimit(column: KanbanColumn | undefined): void {
        if (column) this.dialog<GeKanbanColumnDialog>('column')?.openSetWip(column);
    }

    /** Swaps the column's `order` with its left neighbour and fires `columns-change`. "Left" is board order, so in RTL it moves right. */
    onMoveColumnLeft(column: KanbanColumn | undefined): void {
        this.swapColumn(column, -1);
    }

    /** Mirror of `onMoveColumnLeft`. */
    onMoveColumnRight(column: KanbanColumn | undefined): void {
        this.swapColumn(column, 1);
    }

    private swapColumn(column: KanbanColumn | undefined, direction: 1 | -1): void {
        if (!column) return;
        const sorted = this.sortedColumns;
        const index = sorted.findIndex((c) => c.id === column.id);
        const neighbour = sorted[index + direction];
        if (index < 0 || !neighbour) return;
        this.captureSnapshot();
        this.emit(
            'columns-change',
            this.columns.map((c) => {
                if (c.id === column.id) return { ...c, order: neighbour.order };
                if (c.id === neighbour.id) return { ...c, order: column.order };
                return c;
            }),
        );
    }

    /** Opens the confirmation, which asks where to send the cards when the column has any. Nothing fires until the user confirms. */
    onDeleteColumn(column: KanbanColumn | undefined): void {
        if (!column) return;
        const count = this.cards.filter((c) => c.columnId === column.id).length;
        this.dialog<GeKanbanDeleteColumnDialog>('delete-column')?.open(column, count);
    }

    // ---- dialog results -----------------------------------------------------------------------------------

    private readonly onCardSubmitted = (event: Event) => {
        const { mode, card, data } = (event as CustomEvent<KanbanCardDialogSubmit>).detail;
        this.captureSnapshot();
        if (mode === 'add') {
            this.emit<KanbanCardAddEvent>('card-added', data);
        } else if (card) {
            this.emit<KanbanCard>('card-updated', { ...card, title: data.title, description: data.description, priority: data.priority, labels: data.labels, assignees: data.assignees });
        }
    };

    private readonly onColumnSubmitted = (event: Event) => {
        const { mode, name, wipLimit, columnId } = (event as CustomEvent<KanbanColumnDialogSubmit>).detail;
        this.captureSnapshot();
        if (mode === 'add-column') {
            this.emit<Omit<KanbanColumn, 'id'>>('column-added', { title: name ?? '', wipLimit, order: this.columns.length });
            return;
        }
        const existing = this.columns.find((c) => c.id === columnId);
        if (!existing) return;
        const mapped: Record<Exclude<KanbanColumnDialogMode, 'add-column'>, KanbanColumn> = {
            'rename-column': { ...existing, title: name ?? existing.title },
            'set-wip': { ...existing, wipLimit },
        };
        this.emit<KanbanColumn>('column-updated', mapped[mode]);
    };

    private readonly onDeleteColumnConfirmed = (event: Event) => {
        this.captureSnapshot();
        this.emit<KanbanColumnDeleteEvent>('column-deleted', (event as CustomEvent<KanbanColumnDeleteEvent>).detail);
    };

    // ---- history ------------------------------------------------------------------------------------------

    private captureSnapshot(): void {
        this.undoStack.push({ cards: [...this.cards], columns: [...this.columns] });
        if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
        this.redoStack = [];
        this.emitHistoryState();
    }

    /**
     * Restores the previous snapshot and fires both `cards-change` and `columns-change`: apply both. History holds 50
     * steps and snapshots the state before each action. A pending delete is abandoned, not finalized.
     */
    undo(): void {
        const snapshot = this.undoStack.pop();
        if (!snapshot) return;
        this.cancelAllPendingDeletes();
        this.redoStack.push({ cards: [...this.cards], columns: [...this.columns] });
        this.emit('cards-change', snapshot.cards);
        this.emit('columns-change', snapshot.columns);
        this.emitHistoryState();
    }

    /** Reapplies the last undone snapshot. Any new action clears the redo stack. */
    redo(): void {
        const snapshot = this.redoStack.pop();
        if (!snapshot) return;
        this.cancelAllPendingDeletes();
        this.undoStack.push({ cards: [...this.cards], columns: [...this.columns] });
        this.emit('cards-change', snapshot.cards);
        this.emit('columns-change', snapshot.columns);
        this.emitHistoryState();
    }

    private emitHistoryState(): void {
        this.emit<KanbanHistoryState>('history-change', { canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 });
    }

    private cancelAllPendingDeletes(): void {
        for (const pending of this.pendingDeletes.values()) {
            clearTimeout(pending.timeoutId);
            clearInterval(pending.countdownIntervalId);
        }
        this.pendingDeletes.clear();
        this.deleteToast = null;
    }

    private emit<T>(name: string, detail: T): void {
        this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
    }

    // ---- rendering ----------------------------------------------------------------------------------------

    protected override willUpdate(changed: PropertyValues<this>): void {
        // Seeded once: reapplying on every change would shut a lane the user opened.
        if (changed.has('initiallyCollapsedSwimlanes') && !this.seeded && this.initiallyCollapsedSwimlanes.length > 0) {
            this.seeded = true;
            this.collapsedSwimlanes = new Set(this.initiallyCollapsedSwimlanes);
        }
    }

    protected override updated(): void {
        const surface = this.renderRoot.querySelector<HTMLElement>('[data-surface]') ?? undefined;
        if (surface !== this.surface) {
            this.stopSurfaceGesture?.();
            this.surface = surface;
            this.stopSurfaceGesture = surface ? onContextGesture(surface, (gesture) => this.openBoardMenu(gesture)) : undefined;
        }
        for (const part of this.parts) part.requestUpdate();
    }

    private readonly onSlotChange = (event: Event) => {
        this.hasCustomColumns = (event.target as HTMLSlotElement).assignedElements().some((el) => el.localName === 'ge-kanban-column');
    };

    private columnTemplate(col: KanbanColumn, swimlaneId?: string): TemplateResult {
        return html`<ge-kanban-column column-id=${col.id} heading=${col.title} .swimlaneId=${swimlaneId} .wipLimit=${col.wipLimit} .locale=${this.text}></ge-kanban-column>`;
    }

    private lanes(): TemplateResult {
        return html`<div class="lanes" data-surface data-slot="kanban-swimlanes">
            ${this.swimlanes.map((lane) => {
                const collapsed = this.isSwimlaneCollapsed(lane.id);
                return html`<section class="lane" data-slot="kanban-swimlane" data-swimlane-id=${lane.id} ?data-collapsed=${collapsed}>
                    <button type="button" class="lane-header" data-slot="kanban-swimlane-header" aria-expanded=${!collapsed} @click=${() => this.toggleSwimlane(lane.id)}>
                        ${CHEVRON}<span class="lane-name">${lane.label}</span>
                        <ge-badge class="lane-count" label=${String(lane.count)} variant="secondary"></ge-badge>
                    </button>
                    ${collapsed ? nothing : html`<div class="strip" data-slot="kanban">${this.sortedColumns.map((col) => this.columnTemplate(col, lane.id))}</div>`}
                </section>`;
            })}
        </div>`;
    }

    private toast(): TemplateResult | typeof nothing {
        const toast = this.deleteToast;
        if (!toast) return nothing;
        const l = this.text;
        const total = Math.ceil(DELETE_DURATION / 1000);
        const percent = Math.max(0, (toast.countdown / total) * 100);
        return html`<div class="toast" data-slot="kanban-delete-toast">
            <div class="toast-card">
                <div class="toast-text">
                    <div class="toast-title">${l.cardDeleted}</div>
                    <div class="toast-body">"${toast.title}" ${l.cardRemovedDescription}</div>
                </div>
                <ge-button variant="outline" size="sm" @click=${() => this.undoCardDelete()}>
                    ${l.undo}${toast.countdown > 0 ? html`<span class="countdown">(${toast.countdown}s)</span>` : nothing}
                </ge-button>
                <button type="button" class="toast-close" aria-label="Close" @click=${() => this.dismissDeleteToast()}>${CLOSE}</button>
                <div class="toast-progress"><div style="width:${percent}%"></div></div>
            </div>
        </div>`;
    }

    protected override render() {
        const l = this.text;
        let board: TemplateResult;
        if (this.hasCustomColumns) board = html`<div class="strip" data-surface data-slot="kanban"><slot @slotchange=${this.onSlotChange}></slot></div>`;
        else if (this.hasSwimlanes) board = this.lanes();
        else board = html`<div class="strip" data-surface data-slot="kanban">${this.sortedColumns.map((col) => this.columnTemplate(col))}<slot @slotchange=${this.onSlotChange}></slot></div>`;
        return html`<div dir=${l.rtl ? 'rtl' : 'ltr'}>
            ${board} ${this.toast()}
            <ge-context-menu data-menu="card"></ge-context-menu>
            <ge-context-menu data-menu="column"></ge-context-menu>
            <ge-context-menu data-menu="board" .items=${[{ label: l.addColumnMenu, click: () => this.onAddColumn() }]}></ge-context-menu>
            <ge-kanban-card-dialog
                data-dialog="card"
                .locale=${l}
                .haveLabels=${this.haveLabels}
                .haveAssignees=${this.haveAssignees}
                .assigneeOptions=${this.assigneeOptions}
                @submitted=${this.onCardSubmitted}
            ></ge-kanban-card-dialog>
            <ge-kanban-column-dialog data-dialog="column" .locale=${l} @submitted=${this.onColumnSubmitted}></ge-kanban-column-dialog>
            <ge-kanban-delete-column-dialog data-dialog="delete-column" .locale=${l} .columns=${this.columns} @confirmed=${this.onDeleteColumnConfirmed}></ge-kanban-delete-column-dialog>
        </div>`;
    }
}
