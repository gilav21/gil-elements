import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './input-group-text.css?inline';

/**
 * Muted text inside a `ge-input-group-addon`, such as `https://` or `USD`.
 *
 * @slot - The text.
 */
export class GeInputGroupText extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'input-group-text';
    }

    protected override render() {
        return html`<span data-slot="input-group-text"><slot></slot></span>`;
    }
}
