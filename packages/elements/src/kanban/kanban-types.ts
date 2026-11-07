export interface KanbanColumn {
    id: string;
    title: string;
    wipLimit?: number;
    collapsed?: boolean;
    order: number;
}

export type KanbanPriority = 'low' | 'medium' | 'high' | 'urgent';

export type KanbanColumnDialogMode = 'add-column' | 'rename-column' | 'set-wip';

export interface KanbanLabel {
    text: string;
    color: string;
}

export interface KanbanAssignee {
    name: string;
    avatar?: string;
}

export interface KanbanCard {
    id: string;
    columnId: string;
    title: string;
    description?: string;
    priority?: KanbanPriority;
    labels?: KanbanLabel[];
    assignees?: KanbanAssignee[];
    order: number;
}

/** `detail` of `card-moved`. */
export interface KanbanCardMoveEvent {
    cardId: string;
    fromColumnId: string;
    toColumnId: string;
    newOrder: number;
    /** Swimlane the card came from. Present only while `swimlaneBy` is set. */
    fromSwimlaneId?: string;
    /** Swimlane the card landed in. Present only while `swimlaneBy` is set. */
    toSwimlaneId?: string;
}

/**
 * How cards are bucketed into swimlanes, the board's optional second axis.
 *
 * A **string** names a property on the card; that is the form that lets the board reassign the lane on a cross-lane
 * drop, since it knows which field to write. A **function** derives a lane from anything, but the board cannot invert
 * it, so a cross-lane drop keeps the card in its original lane and it is yours to move from `card-updated`.
 */
export type KanbanSwimlaneBy = string | ((card: KanbanCard) => string) | null;

/** One horizontal band of the board, derived from `swimlaneBy`. */
export interface KanbanSwimlane {
    /** The lane's grouping value. Cards with no value land in the `''` lane. */
    id: string;
    /** Heading text: the `id`, unless `swimlaneLabel` supplies something friendlier. */
    label: string;
    /** Cards in this lane across every column, after the search filter. */
    count: number;
}

/** `detail` of `card-added`. */
export interface KanbanCardAddEvent {
    columnId: string;
    title: string;
    description?: string;
    priority?: KanbanPriority;
    labels?: KanbanLabel[];
    assignees?: KanbanAssignee[];
}

/** `detail` of `column-deleted`. */
export interface KanbanColumnDeleteEvent {
    columnId: string;
    moveCardsTo?: string;
}

/** `detail` of `history-change`. */
export interface KanbanHistoryState {
    canUndo: boolean;
    canRedo: boolean;
}

/** What the columns and cards of a board need from it. */
export interface KanbanHost extends HTMLElement {
    readonly draggedCardId: string | null;
    readonly columns: KanbanColumn[];
    getCardsForColumn(columnId: string, swimlaneId?: string): KanbanCard[];
    startDrag(cardId: string): void;
    endDrag(): void;
    moveCard(cardId: string, toColumnId: string, newOrder: number, toSwimlaneId?: string): void;
    onAddCard(columnId?: string): void;
    showCardContextMenu(x: number, y: number, card: KanbanCard): void;
    showColumnContextMenu(x: number, y: number, column: KanbanColumn): void;
    register(part: KanbanPart): void;
    unregister(part: KanbanPart): void;
}

/** A column or card that re-renders when the board's state changes. */
export interface KanbanPart extends HTMLElement {
    requestUpdate(): void;
}

export const KANBAN_REGISTER = 'ge-kanban-register';
export const KANBAN_COLUMN_REGISTER = 'ge-kanban-column-register';

/** What a card needs from its column. */
export interface KanbanColumnHost extends HTMLElement {
    readonly columnId: string;
}
