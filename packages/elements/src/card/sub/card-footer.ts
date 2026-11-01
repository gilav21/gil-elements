import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './card-footer.css?inline';

/**
 * The bottom row of a card, usually holding actions.
 *
 * @slot - Anything; items sit in a row.
 * @attr {boolean} bordered - Draw a divider above the footer and add matching top padding.
 */
export class GeCardFooter extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { bordered: { type: Boolean, reflect: true } };

    declare bordered: boolean;

    constructor() {
        super();
        this.bordered = false;
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
