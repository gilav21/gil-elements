import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './result-detail.css?inline';

/**
 * A bordered block of extra information (an error dump, a summary) drawn above a `ge-result`'s actions. It
 * assigns itself to the result's `detail` slot, and keeps screen readers from re-announcing it with the panel.
 *
 * @slot - The detail content.
 */
export class GeResultDetail extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    override connectedCallback(): void {
        super.connectedCallback();
        this.slot = 'detail';
        
        this.dataset.slot = 'result-detail';
        this.setAttribute('aria-live', 'off');
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
