import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './pagination-ellipsis.css?inline';

/**
 * Stands in for page numbers that were left out.
 *
 * @attr {string} label - Screen-reader text. Defaults to "More pages".
 */
export class GePaginationEllipsis extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        label: {},
    };

    declare label: string;

    constructor() {
        super();
        this.label = 'More pages';
    }

    protected override render() {
        return html`<span class="dots" data-slot="pagination-ellipsis" aria-hidden="true">
            <svg fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /><circle cx="5" cy="12" r="1.5" /></svg>
            <span class="sr-only">${this.label}</span>
        </span>`;
    }
}
