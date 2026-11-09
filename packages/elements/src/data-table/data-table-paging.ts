/** The pager's arithmetic, kept apart from the element so node tests cover it. */
import type { PaginationState } from './data-table.types.js';

export type PageAction = 'first' | 'previous' | 'next' | 'last';

/** A non-positive page size counts as 10 here (Angular), so a bad state still gives a page count. */
export function totalPages(total: number, pageSize: number): number {
    return Math.max(1, Math.ceil(total / (pageSize > 0 ? pageSize : 10)));
}

/** The state a pager button asks for, clamped to `[0, totalPages - 1]`. */
export function pageTarget(state: PaginationState, total: number, action: PageAction): PaginationState {
    const last = totalPages(total, state.pageSize) - 1;
    const index = { first: 0, previous: state.pageIndex - 1, next: state.pageIndex + 1, last }[action];
    return { ...state, pageIndex: Math.min(last, Math.max(0, index)) };
}

/** A new page size goes back to page 0; a value that is not a positive number keeps the current size. */
export function pageSizeTarget(state: PaginationState, value: string | number): PaginationState {
    const size = Number(value);
    return { pageIndex: 0, pageSize: size > 0 ? size : state.pageSize };
}
