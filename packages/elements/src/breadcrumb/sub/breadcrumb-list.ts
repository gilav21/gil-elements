import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './breadcrumb-list.css?inline';

/** One entry for data-driven mode. */
export interface BreadcrumbEntry {
    label: string;
    href?: string;
    isCurrentPage?: boolean;
}

const CHEVRON = html`<svg class="chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
</svg>`;

/**
 * The trail itself: a wrapping row of items and separators. Give it `items` for the quick form, or project
 * `ge-breadcrumb-item`s and `ge-breadcrumb-separator`s for full control.
 *
 * @slot - Items and separators, used when `items` is empty.
 * @attr {boolean} skeleton - Shows placeholder crumbs instead.
 * @attr {number} skeleton-count - How many placeholders. Defaults to 3.
 */
export class GeBreadcrumbList extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        items: { attribute: false },
        skeleton: { type: Boolean, reflect: true },
        skeletonCount: { type: Number, attribute: 'skeleton-count' },
    };

    /** Quick form: one crumb per entry, with separators between them. */
    declare items: readonly BreadcrumbEntry[] | undefined;
    declare skeleton: boolean;
    declare skeletonCount: number;

    constructor() {
        super();
        this.items = undefined;
        this.skeleton = false;
        this.skeletonCount = 3;
    }

    protected override render() {
        if (this.skeleton) return this.renderSkeleton();
        if (this.items?.length) return this.renderItems(this.items);
        return html`<slot></slot>`;
    }

    private renderSkeleton() {
        const count = this.skeletonCount;
        return Array.from(
            { length: count },
            (...[, i]) => html`<ge-skeleton class="label"></ge-skeleton>${i < count - 1 ? html`<ge-skeleton class="dot"></ge-skeleton>` : nothing}`,
        );
    }

    private renderItems(items: readonly BreadcrumbEntry[]) {
        return items.map(
            (entry, i) => html`<span class="item" data-slot="breadcrumb-item"
                    >${entry.isCurrentPage
                        ? html`<span class="page" role="link" aria-disabled="true" aria-current="page" data-slot="breadcrumb-page">${entry.label}</span>`
                        : html`<a href=${entry.href || '#'} data-slot="breadcrumb-link">${entry.label}</a>`}</span
                >${i < items.length - 1 ? html`<span class="separator" role="presentation" aria-hidden="true" data-slot="breadcrumb-separator">${CHEVRON}</span>` : nothing}`,
        );
    }
}
