import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './breadcrumb-ellipsis.css?inline';

/**
 * Stands in for crumbs that were left out.
 *
 * @attr {string} label - Text for screen readers. Defaults to "More".
 * @cssprop --density-button - Size multiplier; falls back to `--density`.
 */
export class GeBreadcrumbEllipsis extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        label: {},
    };

    declare label: string;

    constructor() {
        super();
        this.label = 'More';
    }

    protected override render() {
        return html`<span class="dots" role="presentation" aria-hidden="true" data-slot="breadcrumb-ellipsis">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
            <span class="sr-only">${this.label}</span>
        </span>`;
    }
}
