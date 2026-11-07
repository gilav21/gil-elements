import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './error-page-actions.css?inline';

/**
 * Replaces the two default recovery buttons of a `ge-error-page` with your own. Must be a direct child of the
 * page; it assigns itself to the page's `actions` slot. The page's `go-back` and `go-home` stop firing, so wire
 * your own handlers.
 *
 * @slot - Buttons or links.
 */
export class GeErrorPageActions extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    override connectedCallback(): void {
        super.connectedCallback();
        this.slot = 'actions';
    }

    protected override render() {
        return html`<div class="actions" data-slot="error-page-actions"><slot></slot></div>`;
    }
}
