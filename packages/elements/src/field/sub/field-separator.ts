import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './field-separator.css?inline';

/** A thin rule between fields, with 1rem of space above and below. */
export class GeFieldSeparator extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'field-separator-host';
    }

    protected override render() {
        return html`<hr data-slot="field-separator" />`;
    }
}
