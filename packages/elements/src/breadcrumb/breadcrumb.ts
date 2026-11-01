import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './breadcrumb.css?inline';

/**
 * The navigation landmark around a breadcrumb trail. Put a `ge-breadcrumb-list` inside.
 *
 * @slot - A `ge-breadcrumb-list`.
 * @attr {string} aria-label - Name of the landmark. Defaults to "breadcrumb".
 */
export class GeBreadcrumb extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        ariaLabel: { attribute: 'aria-label' },
    };

    declare ariaLabel: string | null;

    constructor() {
        super();
        this.ariaLabel = null;
    }

    protected override render() {
        return html`<nav aria-label=${this.ariaLabel ?? 'breadcrumb'} data-slot="breadcrumb"><slot></slot></nav>`;
    }
}
