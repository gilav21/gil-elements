import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { chromeIcon, type ChromeIconName } from '../data-table-icons.js';
import '../../pagination/define.js';
import '../../select/define.js';
import { isRtl } from '../../shared/menu.js';
import { type PageAction, pageSizeTarget, pageTarget, totalPages } from '../data-table-paging.js';
import { resolveDataTableLocale } from '../data-table.locales.js';
import type { PaginationState } from '../data-table.types.js';
import css from './data-table-pager.css?inline';

const sizeList = { fromAttribute: (value: string | null) => (value ?? '').split(/[\s,]+/).map(Number).filter((n) => n > 0) };
const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false' };

/**
 * The data table's pager: a rows-per-page select, "Page X of Y" and four chevron buttons, built on `ge-pagination`
 * (custom mode) and `ge-select`. It is controlled: it never keeps a page, it asks for one and the table feeds the state back.
 *
 * @fires pagination-change - With the clamped `{ pageIndex, pageSize }`; a new page size goes back to page 0.
 * @attr {number} total - Rows across all pages. 0 is one page.
 * @attr {string} page-size-options - Comma list of sizes. Defaults to `10,20,30,40,50`. A size outside it still shows.
 * @attr {boolean} show-page-size-selector - Defaults to true.
 * @csspart base - The wrapper.
 */
export class GeDataTablePager extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        total: { type: Number },
        state: { attribute: false },
        pageSizeOptions: { attribute: 'page-size-options', converter: sizeList },
        showPageSizeSelector: { attribute: 'show-page-size-selector', converter: defaultTrue },
        rowsPerPageLabel: { attribute: 'rows-per-page-label' },
        pageLabel: { attribute: 'page-label' },
        ofLabel: { attribute: 'of-label' },
        firstLabel: { attribute: 'first-label' },
        previousLabel: { attribute: 'previous-label' },
        nextLabel: { attribute: 'next-label' },
        lastLabel: { attribute: 'last-label' },
    };

    declare total: number;
    declare state: PaginationState;
    declare pageSizeOptions: number[];
    declare showPageSizeSelector: boolean;
    declare rowsPerPageLabel: string;
    declare pageLabel: string;
    declare ofLabel: string;
    declare firstLabel: string;
    declare previousLabel: string;
    declare nextLabel: string;
    declare lastLabel: string;

    constructor() {
        super();
        const en = resolveDataTableLocale('en'); // the English there is now: a registered override counts
        this.total = 0;
        this.state = { pageIndex: 0, pageSize: 10 };
        this.pageSizeOptions = [10, 20, 30, 40, 50];
        this.showPageSizeSelector = true;
        this.rowsPerPageLabel = en.rowsPerPageLabel;
        this.pageLabel = en.pageLabel;
        this.ofLabel = en.ofLabel;
        this.firstLabel = en.goToFirstPage;
        this.previousLabel = en.goToPreviousPage;
        this.nextLabel = en.goToNextPage;
        this.lastLabel = en.goToLastPage;
    }

    private emit(state: PaginationState): void {
        this.dispatchEvent(new CustomEvent<PaginationState>('pagination-change', { detail: state }));
    }

    private readonly onSize = (event: CustomEvent<string>): void => this.emit(pageSizeTarget(this.state, event.detail));

    private link(action: PageAction, label: string, icon: ChromeIconName, disabled: boolean, edge = false) {
        return html`<ge-pagination-item class=${edge ? 'edge' : ''}>
            <ge-pagination-link size="icon" ?disabled=${disabled} @click=${() => !disabled && this.emit(pageTarget(this.state, this.total, action))}>
                <span class="sr-only">${label}</span>${chromeIcon(icon, 'sm')}
            </ge-pagination-link>
        </ge-pagination-item>`;
    }

    protected override render() {
        const { state, total } = this;
        const pages = totalPages(total, state.pageSize);
        const canPrevious = state.pageIndex > 0;
        const canNext = state.pageIndex < pages - 1;
        const rtl = isRtl(this);
        const [back, backEnd, forward, forwardEnd]: ChromeIconName[] = rtl ? ['chevron-right', 'chevrons-right', 'chevron-left', 'chevrons-left'] : ['chevron-left', 'chevrons-left', 'chevron-right', 'chevrons-right'];
        return html`<div part="base" data-slot="data-table-pagination">
            <div class="spacer"></div>
            <div class="controls">
                ${this.showPageSizeSelector
                    ? html`<div class="size">
                          <p class="size-label">${this.rowsPerPageLabel}</p>
                          <ge-select value=${String(state.pageSize)} @value-change=${this.onSize}>
                              <ge-select-trigger class="size-trigger" aria-label=${this.rowsPerPageLabel}><ge-select-value placeholder=${String(state.pageSize)}></ge-select-value></ge-select-trigger>
                              <ge-select-content side="top">${this.pageSizeOptions.map((size) => html`<ge-select-item value=${String(size)}>${size}</ge-select-item>`)}</ge-select-content>
                          </ge-select>
                      </div>`
                    : null}
                <ge-pagination>
                    <ge-pagination-content>
                        ${this.link('first', this.firstLabel, backEnd as ChromeIconName, !canPrevious, true)}
                        ${this.link('previous', this.previousLabel, back as ChromeIconName, !canPrevious)}
                        <ge-pagination-item><div class="indicator">${this.pageLabel} ${state.pageIndex + 1} ${this.ofLabel} ${pages}</div></ge-pagination-item>
                        ${this.link('next', this.nextLabel, forward as ChromeIconName, !canNext)}
                        ${this.link('last', this.lastLabel, forwardEnd as ChromeIconName, !canNext, true)}
                    </ge-pagination-content>
                </ge-pagination>
            </div>
        </div>`;
    }
}
