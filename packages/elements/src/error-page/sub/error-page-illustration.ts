import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './error-page-illustration.css?inline';

/**
 * Replaces the typographic status code of a `ge-error-page` with artwork. Must be a direct child of the page; it
 * assigns itself to the page's `illustration` slot.
 *
 * @slot - An image or SVG.
 */
export class GeErrorPageIllustration extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    override connectedCallback(): void {
        super.connectedCallback();
        this.slot = 'illustration';
    }

    protected override render() {
        return html`<div class="illustration" data-slot="error-page-illustration"><slot></slot></div>`;
    }
}
