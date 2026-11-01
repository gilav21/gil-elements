import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './pagination.css?inline';

/** The page numbers to show, with `-1` standing for an ellipsis. */
export function pageNumbers(current: number, total: number, siblings: number): number[] {
    if (total <= 0) return [];
    const range = (start: number, end: number): number[] => Array.from({ length: end - start + 1 }, (...[, i]) => start + i);
    // siblings on both sides, first, last, current and two ellipses
    if (total <= siblings * 2 + 5) return range(1, total);
    const left = Math.max(current - siblings, 1);
    const right = Math.min(current + siblings, total);
    const edge = 3 + 2 * siblings;
    // More than siblings*2+5 pages, so the two ends cannot both be close.
    if (left <= 2) return [...range(1, edge), -1, total];
    if (right >= total - 1) return [1, -1, ...range(total - edge + 1, total)];
    return [1, -1, ...range(left, right), -1, total];
}

/**
 * Page navigation. Set `total-pages` (and `current-page`) for the quick form, which builds previous, next, the
 * numbers and ellipses for you; or project a `ge-pagination-content` of your own for full control.
 *
 * @slot - A `ge-pagination-content`, used when `total-pages` is 0.
 * @fires page-change - When the user picks another page; `detail` is its number. Set `current-page` in response.
 * @attr {number} current-page - The page being shown, counting from 1.
 * @attr {number} total-pages - How many pages there are. 0 means custom mode.
 * @attr {number} sibling-count - Page numbers kept on each side of the current one. Defaults to 1.
 * @attr {string} aria-label - Name of the navigation landmark. Defaults to "pagination".
 * @attr {string} previous-label - Text of the previous button. Defaults to "Previous".
 * @attr {string} next-label - Text of the next button. Defaults to "Next".
 * @attr {string} more-label - Screen-reader text of an ellipsis. Defaults to "More pages".
 */
export class GePagination extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        currentPage: { type: Number, attribute: 'current-page', reflect: true },
        totalPages: { type: Number, attribute: 'total-pages', reflect: true },
        siblingCount: { type: Number, attribute: 'sibling-count' },
        ariaLabel: { attribute: 'aria-label' },
        previousLabel: { attribute: 'previous-label' },
        nextLabel: { attribute: 'next-label' },
        moreLabel: { attribute: 'more-label' },
    };

    declare currentPage: number;
    declare totalPages: number;
    declare siblingCount: number;
    declare ariaLabel: string | null;
    declare previousLabel: string;
    declare nextLabel: string;
    declare moreLabel: string;

    constructor() {
        super();
        this.currentPage = 0;
        this.totalPages = 0;
        this.siblingCount = 1;
        this.ariaLabel = null;
        this.previousLabel = 'Previous';
        this.nextLabel = 'Next';
        this.moreLabel = 'More pages';
    }

    /** Ask for `page`; announces it only when it is a different page inside the range. */
    goTo(page: number): void {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;
        this.dispatchEvent(new CustomEvent<number>('page-change', { detail: page, bubbles: true, composed: true }));
    }

    protected override render() {
        return html`<nav role="navigation" aria-label=${this.ariaLabel ?? 'pagination'} data-slot="pagination">
            ${this.totalPages > 0 ? this.renderPages() : html`<slot></slot>`}
        </nav>`;
    }

    private renderPages() {
        const current = this.currentPage;
        return html`<ul data-slot="pagination-content" data-quick>
            <li>
                <ge-pagination-previous label=${this.previousLabel} ?disabled=${current <= 1} @click=${() => this.goTo(current - 1)}></ge-pagination-previous>
            </li>
            ${pageNumbers(current, this.totalPages, this.siblingCount).map((page) =>
                page === -1
                    ? html`<li><ge-pagination-ellipsis label=${this.moreLabel}></ge-pagination-ellipsis></li>`
                    : html`<li>
                          <ge-pagination-link ?active=${page === current} @click=${() => this.goTo(page)}>${page}</ge-pagination-link>
                      </li>`,
            )}
            <li>
                <ge-pagination-next label=${this.nextLabel} ?disabled=${current >= this.totalPages} @click=${() => this.goTo(current + 1)}></ge-pagination-next>
            </li>
        </ul>`;
    }
}
